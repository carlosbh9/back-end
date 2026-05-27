const express = require('express');
const crypto = require('crypto');
const PublicBookingLink = require('../../models/publicBookingLink.schema');
const BookingFile = require('../../models/booking_file.schema');
const bookingFileSummaryService = require('../../Services/booking-files/booking-file-summary.service');
const bookingFilePassengerOperationsService = require('../../Services/booking-files/booking-file-passenger-operations.service');
const { authenticate } = require('../../middlewares/auth');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const User = require('../../models/user.schema');
const path = require('path');
const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
});

const PASSPORT_BUCKET = process.env.S3_PASSPORT_BUCKET;
const PRESIGN_EXPIRES = Number(process.env.S3_PRESIGN_EXPIRES_SECONDS || 600);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error(`Invalid contentType: ${file.mimetype}`));
    }
    cb(null, true);
  }
});


const DEFAULT_TTL_HOURS = 72;
const DEFAULT_PUBLIC_APP_URL = 'http://localhost:4200';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getPublicAppBaseUrl() {
  const raw = String(process.env.PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL).trim();
  try {
    const parsed = new URL(raw);
    let path = parsed.pathname.replace(/\/+$/, '');
    const invalidAppPaths = ['/dashboard', '/login', '/booking-form-public'];
    if (invalidAppPaths.some((invalidPath) => path.startsWith(invalidPath))) {
      path = '';
    }
    return `${parsed.origin}${path}`;
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function normalizeClientId(clientId) {
  return String(clientId || '').trim();
}

function buildPublicUrl(token, clientId = '') {
  const baseUrl = getPublicAppBaseUrl();
  const cleanClientId = normalizeClientId(clientId);
  const query = cleanClientId ? `?clientId=${encodeURIComponent(cleanClientId)}` : '';
  return `${baseUrl}/booking-form-public/${token}${query}`;
}

function extractTokenFromPublicUrl(publicUrl = '') {
  try {
    const parsed = new URL(publicUrl);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const token = pathParts[pathParts.length - 1] || '';
    return token;
  } catch {
    return '';
  }
}

function isLinkActive(link) {
  if (!link) return false;
  if (link.status !== 'active') return false;
  if (link.usedAt) return false;
  if (new Date(link.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

function buildBookingAssetsPrefix({ clientId, token }) {
  const safeClientId = normalizeClientId(clientId) || 'no-client';
  return `public-booking/${safeClientId}/${token}`;
}

function buildPassportKey({ clientId, token, originalName }) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    const err = new Error(`Invalid file extension: ${ext}`);
    err.status = 400;
    throw err;
  }

  const uuid = crypto.randomUUID();
  return `${buildBookingAssetsPrefix({ clientId, token })}/${uuid}${ext}`;
}

async function deleteS3Prefix(prefix) {
  if (!PASSPORT_BUCKET || !prefix) return;

  let continuationToken;

  do {
    const listed = await s3.send(new ListObjectsV2Command({
      Bucket: PASSPORT_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));

    const objects = (listed.Contents || [])
      .map((item) => item.Key)
      .filter(Boolean)
      .map((Key) => ({ Key }));

    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: PASSPORT_BUCKET,
        Delete: { Objects: objects, Quiet: true }
      }));
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function normalizeDateOrNull(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasAnyText(values = []) {
  return values.some((value) => normalizeText(value));
}

function normalizePassengerMatchKey(firstName = '', lastName = '', passport = '') {
  const normalizedPassport = normalizeText(passport).toLowerCase();
  if (normalizedPassport) {
    return `passport:${normalizedPassport}`;
  }

  const fullName = [firstName, lastName]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
    .join(' ');

  return fullName ? `name:${fullName}` : '';
}

function buildExistingPassengerIndexes(passengers = []) {
  const byKey = new Map();

  passengers.forEach((passenger, index) => {
    const key = normalizePassengerMatchKey(
      passenger?.guest?.firstname,
      passenger?.guest?.lastname,
      passenger?.guest?.passport
    );

    if (key && !byKey.has(key)) {
      byKey.set(key, index);
    }
  });

  return byKey;
}

function mapPublicGuestToBookingFormPassenger(guest = {}, existingPassenger = {}) {
  const existingGuest = existingPassenger?.guest || {};
  const existingHealth = existingPassenger?.health || {};
  const existingPhysical = existingPassenger?.physicalinfo || {};
  const existingInsurance = existingPassenger?.insurance || {};
  const existingComplementary = existingPassenger?.complementaryInfo || {};
  const existingEmergency = existingPassenger?.econtact || {};

  return {
    guest: {
      ...existingGuest,
      firstname: normalizeText(guest.firstName),
      lastname: normalizeText(guest.lastName),
      birthdate: normalizeDateOrNull(guest.birthDate),
      expirydate: normalizeDateOrNull(guest.expiryDate),
      gender: normalizeText(guest.gender),
      nationality: normalizeText(guest.nationality),
      passport: normalizeText(guest.passportNumber),
      passportfile: normalizeText(guest.passportFileName),
      passportkey: normalizeText(guest.passportKey),
    },
    econtact: {
      ...existingEmergency,
    },
    health: {
      ...existingHealth,
      allergies: normalizeText(guest.dietary?.allergies),
      dietaryreq: normalizeText(guest.dietary?.dietary),
      medicalcondition: normalizeText(guest.dietary?.medical),
    },
    insurance: {
      ...existingInsurance,
    },
    physicalinfo: {
      ...existingPhysical,
      height: normalizeText(guest.physical?.height),
      weight: normalizeText(guest.physical?.weight),
      shoeSize: normalizeText(guest.physical?.shoeSize),
    },
    complementaryInfo: {
      ...existingComplementary,
    },
    notes: normalizeText(guest.notes),
  };
}

function mapFlightsToBookingForm(submission = {}) {
  const internationalFlights = Array.isArray(submission?.internationalFlights?.flights)
    ? submission.internationalFlights.flights
    : [];
  const domesticFlights = Array.isArray(submission?.ownMadeReservations?.domesticFlights)
    ? submission.ownMadeReservations.domesticFlights
    : [];

  const mapFlight = (flight = {}, type = '') => ({
    type,
    flightnumber: normalizeText(flight.flightNumber),
    departuredate: normalizeDateOrNull(flight.departureDate),
    departuretime: normalizeText(flight.departureTime),
    arrivaldate: normalizeDateOrNull(flight.arrivalDate),
    arrivaltime: normalizeText(flight.arrivalTime),
    departureairport: normalizeText(flight.departureAirport),
    arrivalairport: normalizeText(flight.arrivalAirport),
    recordlocator: normalizeText(flight.bookingCode),
    route: '',
    extrainfo: '',
  });

  return [
    ...internationalFlights
      .filter((flight) => hasAnyText(Object.values(flight || {})))
      .map((flight) => mapFlight(flight, 'International')),
    ...domesticFlights
      .filter((flight) => hasAnyText(Object.values(flight || {})))
      .map((flight) => mapFlight(flight, 'Domestic')),
  ];
}

function mapRoomsToBookingForm(submission = {}) {
  const rooms = Array.isArray(submission?.rooms) ? submission.rooms : [];
  return rooms
    .filter((room) => hasAnyText([room?.guestNames, room?.roomType, room?.notes]))
    .map((room) => ({
      guestNames: normalizeText(room.guestNames),
      roomType: normalizeText(room.roomType),
      notes: normalizeText(room.notes),
    }));
}

function mapRestaurantsToBookingForm(submission = {}) {
  const restaurants = Array.isArray(submission?.ownMadeReservations?.restaurants)
    ? submission.ownMadeReservations.restaurants
    : [];

  return restaurants
    .filter((restaurant) => hasAnyText([restaurant?.name, restaurant?.destination, restaurant?.date, restaurant?.time]))
    .map((restaurant) => ({
      name: normalizeText(restaurant.name),
      destination: normalizeText(restaurant.destination),
      date: normalizeDateOrNull(restaurant.date),
      time: normalizeText(restaurant.time),
    }));
}

function mapYourContactPeople(submission = {}) {
  const contacts = Array.isArray(submission?.yourContact?.contacts) ? submission.yourContact.contacts : [];
  return contacts
    .filter((contact) => hasAnyText([contact?.guest, contact?.occupation, contact?.phone, contact?.email]))
    .map((contact) => ({
      guest: normalizeText(contact.guest),
      occupation: normalizeText(contact.occupation),
      phone: normalizeText(contact.phone),
      email: normalizeText(contact.email),
    }));
}

function mergeBookingFormFromSubmission(existingBookingForm = {}, submission = {}, { clientId = '', token = '', submittedAt = null } = {}) {
  const nextClientId = normalizeClientId(clientId || submission?.tracking?.clientId || '');
  const existingPassengers = Array.isArray(existingBookingForm?.infopax) ? existingBookingForm.infopax : [];
  const existingPassengerIndexes = buildExistingPassengerIndexes(existingPassengers);
  const guests = Array.isArray(submission?.guests) ? submission.guests : [];
  const usedPassengerIndexes = new Set();

  const infopax = guests.map((guest, index) => {
    const matchKey = normalizePassengerMatchKey(guest?.firstName, guest?.lastName, guest?.passportNumber);
    const matchedIndex = matchKey && existingPassengerIndexes.has(matchKey)
      ? existingPassengerIndexes.get(matchKey)
      : index < existingPassengers.length
        ? index
        : -1;

    const existingPassenger = matchedIndex >= 0 && !usedPassengerIndexes.has(matchedIndex)
      ? existingPassengers[matchedIndex]
      : {};

    if (matchedIndex >= 0) {
      usedPassengerIndexes.add(matchedIndex);
    }

    return mapPublicGuestToBookingFormPassenger(guest, existingPassenger);
  });

  return {
    ...existingBookingForm,
    meta: {
      ...(existingBookingForm?.meta || {}),
      source: 'public-link',
      clientId: nextClientId,
      publicLinkToken: normalizeText(token),
      submittedAt: submittedAt || existingBookingForm?.meta?.submittedAt || null,
      lastUpdatedAt: new Date(),
      status: 'SUBMITTED',
    },
    infopax,
    emergencyContact: {
      ...(existingBookingForm?.emergencyContact || {}),
      name: normalizeText(submission?.emergencyContact?.name),
      relationship: normalizeText(submission?.emergencyContact?.relationship),
      homePhone: normalizeText(submission?.emergencyContact?.homePhone),
      cellPhone: normalizeText(submission?.emergencyContact?.cellPhone),
    },
    yourContact: {
      ...(existingBookingForm?.yourContact || {}),
      street: normalizeText(submission?.yourContact?.street),
      city: normalizeText(submission?.yourContact?.city),
      state: normalizeText(submission?.yourContact?.state),
      zip: normalizeText(submission?.yourContact?.zip),
      email: normalizeText(submission?.yourContact?.email),
      homePhone: normalizeText(submission?.yourContact?.homePhone),
      cellPhone: normalizeText(submission?.yourContact?.cellPhone),
      contacts: mapYourContactPeople(submission),
    },
    travelInsurance: {
      ...(existingBookingForm?.travelInsurance || {}),
      companyName: normalizeText(submission?.travelInsurance?.companyName),
      policyNumber: normalizeText(submission?.travelInsurance?.policyNumber),
    },
    resvflights: mapFlightsToBookingForm(submission),
    resvroom: mapRoomsToBookingForm(submission),
    resvrestaurants: mapRestaurantsToBookingForm(submission),
    resvhotels: Array.isArray(existingBookingForm?.resvhotels) ? existingBookingForm.resvhotels : [],
    resvservices: Array.isArray(existingBookingForm?.resvservices) ? existingBookingForm.resvservices : [],
    additionalInfo: normalizeText(submission?.additionalInfo),
  };
}

async function syncBookingFileBookingFormFromSubmission({ clientId = '', token = '', submission = {}, submittedAt = null } = {}) {
  const linkedFileId = await bookingFilePassengerOperationsService.resolveBookingFileIdByClientId(
    clientId || submission?.tracking?.clientId || ''
  );

  if (!linkedFileId) {
    return null;
  }

  const bookingFile = await BookingFile.findById(linkedFileId);
  if (!bookingFile) {
    return null;
  }

  bookingFile.booking_form = mergeBookingFormFromSubmission(
    bookingFile.booking_form || {},
    submission,
    {
      clientId,
      token,
      submittedAt,
    }
  );

  await bookingFile.save();
  return String(bookingFile._id);
}


router.post('/public-booking-links', authenticate, async (req, res) => {
  try {
    const { clientId = '', expiresInHours = DEFAULT_TTL_HOURS } = req.body || {};
    const cleanClientId = normalizeClientId(clientId);
    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const publicUrl = buildPublicUrl(token, cleanClientId);

    const ttlHours = Number(expiresInHours);
    const safeTtlHours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_TTL_HOURS;

    const expiresAt = new Date(Date.now() + safeTtlHours * 60 * 60 * 1000);

    await PublicBookingLink.create({
      tokenHash,
      clientId: cleanClientId,
      createdBy: req.user.id,
      expiresAt,
      publicUrl
    });

    res.status(201).json({
      token,
      publicUrl,
      expiresAt,
      clientId: cleanClientId
    });
  } catch (error) {
    console.error('Error creating public booking link:', error);
    res.status(500).json({ message: 'Error creating public booking link' });
  }
});

router.get('/public-booking-links/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    const link = await PublicBookingLink.findOne({ tokenHash }).select('clientId expiresAt usedAt status');

    if (!link) {
      return res.status(404).json({ valid: false, message: 'Invalid link' });
    }

    const active = isLinkActive(link);
    if (!active) {
      if (link.status === 'active' && new Date(link.expiresAt).getTime() <= Date.now()) {
        link.status = 'expired';
        await link.save();
      }
      return res.status(410).json({ valid: false, message: 'Expired or used link' });
    }

    res.status(200).json({
      valid: true,
      clientId: link.clientId || '',
      expiresAt: link.expiresAt
    });
  } catch (error) {
    console.error('Error validating public booking link:', error);
    res.status(500).json({ valid: false, message: 'Error validating link' });
  }
});


router.post('/public-booking-links/:token/presign-passport', async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    const link = await PublicBookingLink.findOne({ tokenHash }).select('clientId expiresAt usedAt status');

    if (!link) return res.status(404).json({ ok: false, message: 'Invalid link' });
    if (!isLinkActive(link)) {
      if (link.status === 'active' && new Date(link.expiresAt).getTime() <= Date.now()) {
        link.status = 'expired';
        await link.save();
      }
      return res.status(410).json({ ok: false, message: 'Expired or used link' });
    }

    const { fileName, contentType } = req.body || {};
    if (!fileName || !contentType) {
      return res.status(400).json({ ok: false, message: 'fileName and contentType are required' });
    }
    if (!ALLOWED_MIME.has(contentType)) {
      return res.status(400).json({ ok: false, message: `Invalid contentType: ${contentType}` });
    }

    const key = buildPassportKey({
      clientId: link.clientId,
      token,
      originalName: fileName
    });

    const cmd = new PutObjectCommand({
      Bucket: PASSPORT_BUCKET,
      Key: key,
      ContentType: contentType,
      //ServerSideEncryption: 'AES256',
      // Metadata: {
      //   token: String(token),
      //   guestIndex: String(guestIndex),
      // }
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_EXPIRES });
    return res.status(200).json({
      ok: true,
      key,
      uploadUrl,
      expiresIn: PRESIGN_EXPIRES
    });
  } catch (error) {
    console.error('Error presigning passport upload:', error);
    res.status(error.status || 500).json({ ok: false, message: error.message || 'Error presigning upload' });
  }
});

router.post('/public-booking-links/:token/submit', upload.any(), async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    // 1) Buscar link primero
    const link = await PublicBookingLink.findOne({ tokenHash });
    if (!link) {
      return res.status(404).json({ ok: false, message: 'Invalid link' });
    }

    // 2) Validar estado/expiración
    if (!isLinkActive(link)) {
      if (link.status === 'active' && new Date(link.expiresAt).getTime() <= Date.now()) {
        link.status = 'expired';
        await link.save();
      }
      return res.status(410).json({ ok: false, message: 'Expired or used link' });
    }

    // 3) Cargar user (ahora sí, porque link existe)
    const user = await User.findById(link.createdBy).select('username name').lean();
    if (!user) {
      return res.status(500).json({ ok: false, message: 'User not found' });
    }

    // 4) Tomar submission (payload JSON para multipart, o body directo para compatibilidad)
    const submission = typeof req.body?.payload === 'string'
      ? JSON.parse(req.body.payload || '{}')
      : (req.body || {});
    const guests = Array.isArray(submission.guests) ? submission.guests : [];

    if (!guests.length) {
      return res.status(400).json({ ok: false, message: 'Guests are required' });
    }

    const filesByGuest = new Map();
    const files = Array.isArray(req.files) ? req.files : [];
    for (const file of files) {
      const match = String(file.fieldname || '').match(/^passportFile_(\d+)$/);
      if (!match) continue;
      filesByGuest.set(Number(match[1]), file);
    }

    // 5) Subir passport de cada guest a S3 dentro del submit
    for (let i = 0; i < guests.length; i++) {
      const file = filesByGuest.get(i);
      if (!file) {
        return res.status(400).json({ ok: false, message: `Guest ${i + 1} passport file is missing` });
      }

      const passportKey = buildPassportKey({
        clientId: link.clientId,
        token,
        originalName: file.originalname
      });

      try {
        await s3.send(new PutObjectCommand({
          Bucket: PASSPORT_BUCKET,
          Key: passportKey,
          Body: file.buffer,
          ContentType: file.mimetype
        }));
        guests[i].passportKey = passportKey;
        guests[i].passportFileName = file.originalname;
      } catch (e) {
        console.error('S3 PutObject failed:', passportKey, e);
        return res.status(400).json({
          ok: false,
          message: `Guest ${i + 1} passport upload failed. Please try again.`,
        });
      }
    }

    // 6) Guardar submission y marcar link como used (recién ahora)
    link.submission = submission;
    link.usedAt = new Date();
    link.status = 'used';
    await link.save();

    const linkedFileId = await syncBookingFileBookingFormFromSubmission({
      clientId: link.clientId,
      token,
      submission,
      submittedAt: link.usedAt,
    });

    if (linkedFileId) {
      await bookingFileSummaryService.recalculateFileSummary(linkedFileId);
    }

    // 7) Notificar Power Automate
    await fetch(process.env.POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: link.clientId,
        submittedAt: link.usedAt.toISOString(),
        status: link.status,
        submission: link.submission,
        toEmail: user.username,
        toName: user.name,
      }),
    });

    //clientid, token,submittedat,expiresat,sytatus,toemail,toname
    return res.status(200).json({ ok: true, message: 'Form submitted successfully' });
  } catch (error) {
    console.error('Error submitting public booking form:', error);
    return res.status(500).json({ ok: false, message: 'Error submitting form' });
  }
});


router.get('/public-booking-links', authenticate, async (req, res) => {
  try {
    const { clientId = '', status = '', includeSubmission = '0' } = req.query || {};
    const cleanClientId = normalizeClientId(clientId);
    const cleanStatus = String(status || '').trim();

    const query = {};
    if (cleanClientId) query.clientId = cleanClientId;
    if (cleanStatus) query.status = cleanStatus;

    const wantSubmission = String(includeSubmission) === '1';

    const baseSelect = 'clientId expiresAt usedAt status createdAt updatedAt publicUrl';
    const select = wantSubmission ? `${baseSelect} submission` : baseSelect;

    const links = await PublicBookingLink.find(query)
      .select(select)
      .sort({ createdAt: -1 })
      .lean();

    const linksWithComputedFields = links.map((link) => ({
      ...link,
      token: extractTokenFromPublicUrl(link.publicUrl || ''),
      submittedAt: link.usedAt || null,
      submitted: !!link.usedAt,
      publicUrl: link.publicUrl || '',
      submission: wantSubmission ? (link.submission || null) : undefined, // o lo omites
      guestsCount: Array.isArray(link.submission?.guests) ? link.submission.guests.length : undefined
    }));

    res.status(200).json(linksWithComputedFields);
  } catch (error) {
    console.error('Error listing public booking links:', error);
    res.status(500).json({ message: 'Error listing public booking links' });
  }
});

router.get('/public-booking-links/:token/detail', authenticate, async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const link = await PublicBookingLink.findOne({ tokenHash })
      .select('clientId expiresAt usedAt status createdAt updatedAt publicUrl submission')
      .lean();

    if (!link) return res.status(404).json({ ok: false, message: 'Link not found' });

    return res.status(200).json({
      ok: true,
      token,
      clientId: link.clientId || '',
      status: link.status || 'unknown',
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      submittedAt: link.usedAt || null,
      publicUrl: link.publicUrl || '',
      submission: link.submission || null
    });
  } catch (error) {
    console.error('Error reading public booking link detail:', error);
    return res.status(500).json({ ok: false, message: 'Error loading detail' });
  }
});


// UPDATE (dashboard/admin)
router.put('/public-booking-links/:token', authenticate, async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);

    const link = await PublicBookingLink.findOne({ tokenHash });
    if (!link) {
      return res.status(404).json({ ok: false, message: 'Link not found' });
    }

    const {
      clientId,
      status,
      expiresAt,
      submission
    } = req.body || {};

    if (clientId !== undefined) {
      link.clientId = normalizeClientId(clientId);
    }

    if (status !== undefined) {
      const allowed = ['active', 'used', 'revoked', 'expired'];
      if (!allowed.includes(String(status))) {
        return res.status(400).json({ ok: false, message: 'Invalid status' });
      }
      link.status = String(status);
      if (link.status === 'used' && !link.usedAt) link.usedAt = new Date();
      if (link.status === 'active') link.usedAt = null;
    }

    if (expiresAt !== undefined) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ ok: false, message: 'Invalid expiresAt' });
      }
      link.expiresAt = parsed;
    }

    if (submission !== undefined) {
      link.submission = submission;
    }

    await link.save();

    if (submission !== undefined || clientId !== undefined) {
      const linkedFileId = await syncBookingFileBookingFormFromSubmission({
        clientId: link.clientId,
        token,
        submission: link.submission || {},
        submittedAt: link.usedAt,
      });

      if (linkedFileId) {
        await bookingFileSummaryService.recalculateFileSummary(linkedFileId, {
          updatedBy: req.user?.id || null,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      message: 'Link updated successfully',
      data: {
        clientId: link.clientId,
        status: link.status,
        expiresAt: link.expiresAt,
        usedAt: link.usedAt,
        submission: link.submission || null
      }
    });
  } catch (error) {
    console.error('Error updating public booking link:', error);
    return res.status(500).json({ ok: false, message: 'Error updating public booking link' });
  }
});


// DELETE (dashboard/admin)
router.delete('/public-booking-links/:token', authenticate, async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = hashToken(token);
    const existing = await PublicBookingLink.findOne({ tokenHash }).select('clientId').lean();
    if (!existing) {
      return res.status(404).json({ ok: false, message: 'Link not found' });
    }

    const assetsPrefix = buildBookingAssetsPrefix({ clientId: existing.clientId, token });

    await deleteS3Prefix(assetsPrefix);
    await PublicBookingLink.deleteOne({ tokenHash });

    return res.status(200).json({ ok: true, message: 'Link deleted successfully' });
  } catch (error) {
    console.error('Error deleting public booking link:', error);
    return res.status(500).json({ ok: false, message: 'Error deleting public booking link' });
  }
});

module.exports = router;
