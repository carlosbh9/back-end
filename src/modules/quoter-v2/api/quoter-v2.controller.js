const quoterV2Service = require('../application/services/quoter-v2.service');
const quoterV2PricingService = require('../application/services/quoter-v2-pricing.service');
const quoterV2ReviewService = require('../application/services/quoter-v2-review.service');
const { QUOTE_V2_STATUSES, QUOTER_V2_SORT_FIELDS } = require('../domain/quoter-v2.types');
const QuoterV2 = require('../infrastructure/mongoose/quoter-v2.schema');
const Contact = require('../../../models/contact.schema');
const BookingFile = require('../../../models/booking_file.schema');
const User = require('../../../models/user.schema');
const serviceOrderOrchestrator = require('../../../Services/service-orders/service-order.orchestrator');
const bookingFileSummaryService = require('../../../Services/booking-files/booking-file-summary.service');
const { buildOperationalItineraryFromSnapshot } = require('../../../Services/booking-files/booking-file-operational-itinerary.service');
const bookingFileSaleNotificationService = require('../../../Services/booking-files/booking-file-sale-notification.service');
const tariffV2Service = require('../../tariff-v2/application/services/tariff-v2.service');
const {
  buildContactAccessFilter,
  findAccessibleContactById,
} = require('../../../Services/contacts/contact-access.service');
const { createHttpError, sendError } = require('../../../utils/httpError');
const { createValidator, isPlainObject, isValidObjectId } = require('../../../utils/requestValidation');

const CONTACT_STATUSES = ['WIP', 'HOLD', 'SOLD', 'LOST'];

function validateTravelDate(travelDate, validator, field = 'travelDate') {
  validator.optionalObject(field, travelDate);
  if (!isPlainObject(travelDate)) {
    return;
  }

  validator.optionalDate(`${field}.start`, travelDate.start, { allowEmpty: true });
  validator.optionalDate(`${field}.end`, travelDate.end, { allowEmpty: true });
}

function validateQuoterPayload(body, { partial = false } = {}) {
  const validator = createValidator({
    message: partial ? 'Invalid quoter update payload' : 'Invalid quoter payload',
    errorCode: partial ? 'QUOTER_V2_UPDATE_VALIDATION_FAILED' : 'QUOTER_V2_CREATE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  if (partial && !Object.keys(body).length) {
    validator.addIssue('body', 'body must not be empty');
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, 'contact_id') || Object.prototype.hasOwnProperty.call(body, 'guest')) {
    validator.requireAtLeastOne(['contact_id', 'guest'], body);
  }

  validator.optionalObjectId('contact_id', body.contact_id);
  validator.optionalString('guest', body.guest, { allowEmpty: false });
  validator.optionalString('name_quoter', body.name_quoter);
  validator.optionalString('accomodations', body.accomodations);
  validator.optionalString('totalNights', body.totalNights);
  validator.optionalString('travel_agent', body.travel_agent);
  validator.optionalString('exchange_rate', body.exchange_rate);
  validator.optionalNumber('number_paxs', body.number_paxs, { min: 0 });
  validator.optionalNumberArray('children_ages', body.children_ages, { min: 0 });
  validator.optionalStringArray('destinations', body.destinations);
  validator.optionalArray('services', body.services);
  validator.optionalArray('hotels', body.hotels);
  validator.optionalArray('flights', body.flights);
  validator.optionalArray('operators', body.operators);
  validator.optionalArray('cruises', body.cruises);
  validator.optionalObject('total_prices', body.total_prices);

  validateTravelDate(body.travelDate, validator);
  validator.assert();
}

function validateConfirmSalePayload(body) {
  const validator = createValidator({
    message: 'Invalid confirm sale payload',
    errorCode: 'QUOTER_V2_CONFIRM_SALE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.optionalString('fileCode', body.fileCode, { allowEmpty: false });
  validator.optionalStringArray('notifyEmails', body.notifyEmails);
  if (Array.isArray(body.notifyEmails)) {
    body.notifyEmails.forEach((email, index) => {
      if (typeof email !== 'string' || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        validator.addIssue(`notifyEmails[${index}]`, `notifyEmails[${index}] must be a valid email`, email);
      }
    });
  }
  validator.optionalObjectIdArray('notifyUserIds', body.notifyUserIds);
  validator.assert();
}

function validateRevertSalePayload(body) {
  const validator = createValidator({
    message: 'Invalid revert sale payload',
    errorCode: 'QUOTER_V2_REVERT_SALE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.requireNonEmptyString('targetStatus', body.targetStatus);
  validator.optionalEnum('targetStatus', body.targetStatus, CONTACT_STATUSES);
  validator.optionalString('reason', body.reason);
  validator.assert();
}

function validateCalculatePricesPayload(body) {
  const validator = createValidator({
    message: 'Invalid calculate prices payload',
    errorCode: 'QUOTER_V2_PRICE_CALCULATION_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  validator.optionalNumber('number_paxs', body.number_paxs, { min: 1 });
  validator.optionalNumberArray('children_ages', body.children_ages, { min: 0 });
  validator.optionalObjectId('masterQuoterId', body.masterQuoterId);
  validator.optionalArray('items', body.items);
  validator.requireAtLeastOne(['masterQuoterId', 'items'], body);
  validator.assert();
}

function normalizeFileCode(value = '') {
  return String(value).trim().toUpperCase();
}

function normalizeStringList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeLineContract(item) {
  if (!isPlainObject(item)) {
    return item;
  }

  const normalized = { ...item };
  if (!Object.prototype.hasOwnProperty.call(normalized, 'price_base')
    && Object.prototype.hasOwnProperty.call(normalized, 'price_conf')) {
    normalized.price_base = normalized.price_conf;
  }

  delete normalized.price_conf;
  return normalized;
}

function normalizeTariffItemId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeServiceContract(item) {
  const normalized = normalizeLineContract(item);
  if (!isPlainObject(normalized)) {
    return normalized;
  }

  const tariffItemId = normalizeTariffItemId(normalized.tariff_item_id);
  if (tariffItemId) {
    normalized.tariff_item_id = tariffItemId;
  } else {
    delete normalized.tariff_item_id;
  }

  return normalized;
}

function normalizeHotelContract(item) {
  if (!isPlainObject(item)) {
    return item;
  }

  const normalized = { ...item };
  const tariffItemId = normalizeTariffItemId(normalized.tariff_item_id);
  if (tariffItemId) {
    normalized.tariff_item_id = tariffItemId;
  } else {
    delete normalized.tariff_item_id;
  }

  if (tariffItemId && !normalized.price_source) {
    normalized.price_source = 'tariff';
  }

  return normalized;
}

function normalizeOperatorContract(item) {
  if (!isPlainObject(item)) {
    return item;
  }

  const normalized = { ...item };
  const tariffItemId = normalizeTariffItemId(normalized.tariff_item_id);
  if (tariffItemId) {
    normalized.tariff_item_id = tariffItemId;
  } else {
    delete normalized.tariff_item_id;
  }

  return normalized;
}

function collectTariffReferences(body = {}) {
  const references = [];

  (body.services || []).forEach((day, dayIndex) => {
    if (!isPlainObject(day) || !Array.isArray(day.services)) {
      return;
    }

    day.services.forEach((service, serviceIndex) => {
      const tariffItemId = normalizeTariffItemId(service?.tariff_item_id);
      if (!tariffItemId) {
        return;
      }

      references.push({
        section: 'services',
        path: `services[${dayIndex}].services[${serviceIndex}].tariff_item_id`,
        tariff_item_id: tariffItemId,
      });
    });
  });

  (body.hotels || []).forEach((hotel, hotelIndex) => {
    const tariffItemId = normalizeTariffItemId(hotel?.tariff_item_id);
    if (!tariffItemId) {
      return;
    }

    references.push({
      section: 'hotels',
      path: `hotels[${hotelIndex}].tariff_item_id`,
      tariff_item_id: tariffItemId,
    });
  });

  (body.operators || []).forEach((operator, operatorIndex) => {
    const tariffItemId = normalizeTariffItemId(operator?.tariff_item_id);
    if (!tariffItemId) {
      return;
    }

    references.push({
      section: 'operators',
      path: `operators[${operatorIndex}].tariff_item_id`,
      tariff_item_id: tariffItemId,
    });
  });

  return references;
}

async function assertValidTariffReferences(body = {}) {
  const references = collectTariffReferences(body);
  if (!references.length) {
    return;
  }

  const invalidIdReferences = references.filter((reference) => !isValidObjectId(reference.tariff_item_id));
  if (invalidIdReferences.length) {
    throw createHttpError(
      400,
      'Quoter contains invalid tariff references',
      'QUOTER_V2_INVALID_TARIFF_REFERENCES',
      {
        invalidTariffReferences: invalidIdReferences.map((reference) => ({
          section: reference.section,
          path: reference.path,
          tariff_item_id: reference.tariff_item_id,
          reason: 'INVALID_ID',
        })),
      },
    );
  }

  const existingTariffItems = await tariffV2Service.findExistingItemsByIds(
    references.map((reference) => reference.tariff_item_id),
  );
  const existingTariffIds = new Set(existingTariffItems.map((item) => String(item._id)));

  const missingReferences = references.filter((reference) => !existingTariffIds.has(reference.tariff_item_id));
  if (missingReferences.length) {
    throw createHttpError(
      400,
      'Quoter contains tariff references that do not exist',
      'QUOTER_V2_INVALID_TARIFF_REFERENCES',
      {
        invalidTariffReferences: missingReferences.map((reference) => ({
          section: reference.section,
          path: reference.path,
          tariff_item_id: reference.tariff_item_id,
          reason: 'NOT_FOUND',
        })),
      },
    );
  }
}

function normalizeQuoterContract(body = {}) {
  if (!isPlainObject(body)) {
    return body;
  }

  const normalized = { ...body };
  if (!normalized.name_quoter && normalized.name_version) {
    normalized.name_quoter = normalized.name_version;
  }

  delete normalized.name_version;

  if (Array.isArray(normalized.flights)) {
    normalized.flights = normalized.flights.map(normalizeLineContract);
  }

  if (Array.isArray(normalized.cruises)) {
    normalized.cruises = normalized.cruises.map(normalizeLineContract);
  }

  if (Array.isArray(normalized.services)) {
    normalized.services = normalized.services.map((day) => {
      if (!isPlainObject(day)) {
        return day;
      }

      return {
        ...day,
        services: Array.isArray(day.services) ? day.services.map(normalizeServiceContract) : day.services,
      };
    });
  }

  if (Array.isArray(normalized.hotels)) {
    normalized.hotels = normalized.hotels.map(normalizeHotelContract);
  }

  if (Array.isArray(normalized.operators)) {
    normalized.operators = normalized.operators.map(normalizeOperatorContract);
  }

  return normalized;
}

function buildBookingSnapshot(quoter) {
  return {
    services: quoter.services || [],
    hotels: quoter.hotels || [],
    flights: quoter.flights || [],
    operators: quoter.operators || [],
    cruises: quoter.cruises || [],
    total_prices: quoter.total_prices || {},
  };
}

function normalizeCotizationStatus(contact, soldQuoterId) {
  if (!Array.isArray(contact.cotizations)) {
    return;
  }

  contact.cotizations = contact.cotizations.map((item) => {
    const source = item.toObject ? item.toObject() : item;
    return {
      ...source,
      status: String(source.quoter_id) === String(soldQuoterId) ? 'SOLD' : 'WIP',
    };
  });
}

function deriveContactStatusFromCotizations(cotizations = []) {
  const statuses = Array.isArray(cotizations)
    ? cotizations.map((item) => String(item?.status || '').toUpperCase())
    : [];

  if (statuses.includes('SOLD')) return 'SOLD';
  if (statuses.includes('WIP')) return 'WIP';
  if (statuses.includes('HOLD')) return 'HOLD';
  if (statuses.includes('LOST')) return 'LOST';
  return 'WIP';
}

async function resolveContactForQuote(body = {}, user = null) {
  if (body.contact_id) {
    const contact = await findAccessibleContactById(body.contact_id, user, '_id owner');
    if (!contact) {
      throw createHttpError(400, 'contact_id is invalid or not accessible for this user', 'QUOTER_V2_CONTACT_INVALID');
    }

    return contact._id;
  }

  const guestName = String(body.guest || '').trim();
  if (!guestName) {
    throw createHttpError(400, 'guest is required', 'QUOTER_V2_GUEST_REQUIRED');
  }

  let contact = await Contact.findOne(buildContactAccessFilter(user, { name: guestName })).select('_id owner');
  if (!contact) {
    if (!user?.id) {
      throw createHttpError(400, 'contact_id or authenticated user is required', 'QUOTER_V2_CONTACT_REQUIRED');
    }

    contact = await Contact.create({
      name: guestName,
      td_designed: user.username || '',
      owner: user.id,
    });
  }

  return contact._id;
}

class QuoterV2Controller {
  async getOptions(req, res) {
    return res.status(200).json({
      statuses: Object.values(QUOTE_V2_STATUSES),
      sortFields: QUOTER_V2_SORT_FIELDS,
      hotelRateTypes: ['confidential', 'rack'],
      placements: ['services', 'options'],
    });
  }

  async list(req, res) {
    try {
      const result = await quoterV2Service.list(req.query);
      return res.status(200).json(result);
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error listing quoters v2',
        errorCode: 'QUOTER_V2_LIST_FAILED',
      });
    }
  }

  async getById(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Quoter V2 id is invalid', 'QUOTER_V2_ID_INVALID'));
      }

      const item = await quoterV2Service.getById(req.params.id);
      if (!item) {
        return sendError(res, createHttpError(404, 'Quoter V2 not found', 'QUOTER_V2_NOT_FOUND'));
      }
      return res.status(200).json(item);
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error loading quoter v2',
        errorCode: 'QUOTER_V2_FETCH_FAILED',
      });
    }
  }

  async create(req, res) {
    try {
      const payload = normalizeQuoterContract(req.body);
      validateQuoterPayload(payload);
      await assertValidTariffReferences(payload);

      const contactId = await resolveContactForQuote(payload, req.user);
      const created = await quoterV2Service.create({
        ...payload,
        contact_id: contactId,
      });
      return res.status(201).json(created);
    } catch (error) {
      return sendError(res, error, {
        status: 400,
        message: 'Error creating quoter v2',
        errorCode: 'QUOTER_V2_CREATE_FAILED',
      });
    }
  }

  async update(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Quoter V2 id is invalid', 'QUOTER_V2_ID_INVALID'));
      }

      const payload = normalizeQuoterContract(req.body);
      validateQuoterPayload(payload, { partial: true });
      await assertValidTariffReferences(payload);

      const contactId = payload.contact_id || await resolveContactForQuote(payload, req.user);
      const updated = await quoterV2Service.update(req.params.id, {
        ...payload,
        contact_id: contactId,
      });
      if (!updated) {
        return sendError(res, createHttpError(404, 'Quoter V2 not found', 'QUOTER_V2_NOT_FOUND'));
      }
      return res.status(200).json(updated);
    } catch (error) {
      return sendError(res, error, {
        status: 400,
        message: 'Error updating quoter v2',
        errorCode: 'QUOTER_V2_UPDATE_FAILED',
      });
    }
  }

  async remove(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Quoter V2 id is invalid', 'QUOTER_V2_ID_INVALID'));
      }

      const deleted = await quoterV2Service.remove(req.params.id);
      if (!deleted) {
        return sendError(res, createHttpError(404, 'Quoter V2 not found', 'QUOTER_V2_NOT_FOUND'));
      }
      return res.status(200).json(deleted);
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error deleting quoter v2',
        errorCode: 'QUOTER_V2_DELETE_FAILED',
      });
    }
  }

  async confirmSale(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Quoter V2 id is invalid', 'QUOTER_V2_ID_INVALID'));
      }

      validateConfirmSalePayload(req.body || {});

      const requestedFileCode = normalizeFileCode(req.body?.fileCode);
      const notifyEmails = normalizeStringList(req.body?.notifyEmails).map((email) => email.toLowerCase());
      const notifyUserIds = normalizeStringList(req.body?.notifyUserIds);
      const quoter = await QuoterV2.findById(req.params.id);
      if (!quoter) {
        return sendError(res, createHttpError(404, 'Quoter V2 not found', 'QUOTER_V2_NOT_FOUND'));
      }

      const contact = await Contact.findOne({ 'cotizations.quoter_id': quoter._id });
      if (!contact) {
        return sendError(res, createHttpError(400, 'Contact not found for this quoter', 'QUOTER_V2_CONTACT_NOT_FOUND'));
      }

      const changedBy = req.user?.id || null;
      const changedByUser = changedBy
        ? await User.findById(changedBy).select('name username')
        : null;
      const existingBookingFile = quoter.booking_file_id
        ? await BookingFile.findById(quoter.booking_file_id)
        : await BookingFile.findOne({ quoter_id: quoter._id });

      const fileCode = requestedFileCode || existingBookingFile?.fileCode || '';
      if (!fileCode) {
        return sendError(res, createHttpError(400, 'fileCode is required to confirm sale', 'QUOTER_V2_FILE_CODE_REQUIRED'));
      }

      const duplicatedFile = await BookingFile.findOne({
        fileCode,
        ...(existingBookingFile?._id ? { _id: { $ne: existingBookingFile._id } } : {}),
      }).select('_id fileCode');

      if (duplicatedFile) {
        return sendError(res, createHttpError(409, `File code ${fileCode} is already in use`, 'BOOKING_FILE_CODE_ALREADY_IN_USE'));
      }

      const itinerarySnapshot = buildBookingSnapshot(quoter);

      const bookingPayload = {
        contact_id: contact._id,
        fileCode,
        guest: quoter.guest || contact.name || '',
        travel_date_start: quoter.travelDate?.start || '',
        travel_date_end: quoter.travelDate?.end || '',
        destinations: quoter.destinations || [],
        pax_summary: {
          number_paxs: quoter.number_paxs || 0,
          children_ages: quoter.children_ages || [],
        },
        sales_snapshot: {
          quoter_id: quoter._id,
          status: 'SOLD',
          soldAt: new Date().toISOString(),
          total_prices: quoter.total_prices || {},
        },
        itinerary_snapshot: itinerarySnapshot,
        operational_itinerary: buildOperationalItineraryFromSnapshot(itinerarySnapshot, changedBy),
        updatedBy: changedBy,
      };

      let bookingFile;
      if (existingBookingFile) {
        bookingFile = await BookingFile.findByIdAndUpdate(
          existingBookingFile._id,
          { $set: bookingPayload },
          { new: true, runValidators: true }
        );
      } else {
        bookingFile = await BookingFile.create({
          quoter_id: quoter._id,
          createdBy: changedBy,
          ...bookingPayload,
        });
      }

      quoter.status = 'SOLD';
      quoter.soldAt = quoter.soldAt || new Date();
      quoter.soldBy = quoter.soldBy || changedBy;
      quoter.booking_file_id = bookingFile._id;
      await quoter.save();

      contact.soldQuoterId = quoter._id;
      contact.status = 'SOLD';
      normalizeCotizationStatus(contact, quoter._id);
      await contact.save();

      const ordersResult = await serviceOrderOrchestrator.createOrdersForContactSold({
        contactId: String(contact._id),
        soldQuoterId: String(quoter._id),
        fileId: String(bookingFile._id),
        changedBy,
      });

      const serviceOrderIds = (ordersResult.orders || []).map((order) => order._id);
      bookingFile = await BookingFile.findByIdAndUpdate(
        bookingFile._id,
        { $set: { service_order_ids: serviceOrderIds, updatedBy: changedBy } },
        { new: true }
      );
      bookingFile = await bookingFileSummaryService.recalculateFileSummary(String(bookingFile._id), { updatedBy: changedBy });

      let notification = {
        sent: false,
        skipped: true,
        reason: 'Notification not attempted',
      };

      try {
        notification = await bookingFileSaleNotificationService.notifySaleConfirmed({
          bookingFile,
          contact,
          quoter,
          changedByUser,
          notifyEmails,
          notifyUserIds,
        });
      } catch (notificationError) {
        notification = {
          sent: false,
          skipped: true,
          reason: notificationError.message,
        };
        console.error('[booking-file-sale-notification] Error sending email', notificationError);
      }

      return res.status(200).json({
        message: 'Sale confirmed successfully',
        quoter,
        bookingFile,
        notification,
        serviceOrders: {
          businessEventId: ordersResult.businessEventId,
          createdCount: ordersResult.createdCount,
        },
      });
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error confirming sale',
        errorCode: 'QUOTER_V2_CONFIRM_SALE_FAILED',
      });
    }
  }

  async revertSale(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Quoter V2 id is invalid', 'QUOTER_V2_ID_INVALID'));
      }

      validateRevertSalePayload(req.body || {});

      const targetStatus = String(req.body?.targetStatus || '').toUpperCase();
      if (!['WIP', 'HOLD', 'LOST'].includes(targetStatus)) {
        return sendError(res, createHttpError(400, 'targetStatus must be WIP, HOLD, or LOST', 'QUOTER_V2_TARGET_STATUS_INVALID'));
      }

      const quoter = await QuoterV2.findById(req.params.id);
      if (!quoter) {
        return sendError(res, createHttpError(404, 'Quoter V2 not found', 'QUOTER_V2_NOT_FOUND'));
      }

      if (quoter.status !== 'SOLD') {
        return sendError(res, createHttpError(400, 'Only sold quoters can be reverted with this action', 'QUOTER_V2_NOT_SOLD'));
      }

      const contact = await Contact.findById(quoter.contact_id);
      if (!contact) {
        return sendError(res, createHttpError(400, 'Contact not found for this quoter', 'QUOTER_V2_CONTACT_NOT_FOUND'));
      }

      const changedBy = req.user?.id || null;
      const now = new Date();
      const reason = String(req.body?.reason || '').trim() || `Quote reverted from SOLD to ${targetStatus}`;
      const bookingFile = quoter.booking_file_id
        ? await BookingFile.findById(quoter.booking_file_id)
        : await BookingFile.findOne({ quoter_id: quoter._id });

      const businessEventId = serviceOrderOrchestrator.buildBusinessEventId({
        contactId: String(contact._id),
        soldQuoterId: String(quoter._id),
      });

      await serviceOrderOrchestrator.cancelOrdersForBusinessEvent({
        businessEventId,
        reason,
        changedBy,
      });

      if (bookingFile) {
        bookingFile.is_cancelled = true;
        bookingFile.cancel_reason = reason;
        bookingFile.cancelled_at = now;
        bookingFile.overall_status = 'CANCELLED';
        bookingFile.operations_status = 'CANCELLED';
        bookingFile.reservations_status = 'CANCELLED';
        bookingFile.payments_status = 'CANCELLED';
        bookingFile.deliverables_status = 'CANCELLED';
        bookingFile.last_activity_at = now;
        bookingFile.updatedBy = changedBy;
        if (bookingFile.sales_snapshot && typeof bookingFile.sales_snapshot === 'object') {
          bookingFile.sales_snapshot = {
            ...bookingFile.sales_snapshot,
            status: 'CANCELLED',
            cancelledAt: now.toISOString(),
            cancelReason: reason,
          };
        }
        await bookingFile.save();
      }

      quoter.status = 'CANCELLED';
      quoter.soldAt = null;
      quoter.soldBy = null;
      await quoter.save();

      if (Array.isArray(contact.cotizations)) {
        contact.cotizations = contact.cotizations.map((item) => {
          const source = item.toObject ? item.toObject() : item;
          if (String(source.quoter_id) !== String(quoter._id)) {
            return source;
          }
          return {
            ...source,
            status: targetStatus,
          };
        });
      }

      if (String(contact.soldQuoterId || '') === String(quoter._id)) {
        contact.soldQuoterId = null;
      }
      contact.status = deriveContactStatusFromCotizations(contact.cotizations || []);
      await contact.save();

      return res.status(200).json({
        message: `Sale reverted to ${targetStatus}`,
        quoter,
        contact,
        bookingFile,
      });
    } catch (error) {
      return sendError(res, error, {
        status: 500,
        message: 'Error reverting sale',
        errorCode: 'QUOTER_V2_REVERT_SALE_FAILED',
      });
    }
  }

  async reviewQuote(req, res) {
    try {
      if (!isValidObjectId(req.params.id)) {
        return sendError(res, createHttpError(400, 'Quoter V2 id is invalid', 'QUOTER_V2_ID_INVALID'));
      }

      const result = await quoterV2ReviewService.reviewQuote(req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      if (error.message === 'QUOTER_V2_NOT_FOUND') {
        return sendError(res, createHttpError(404, 'Quoter V2 not found', 'QUOTER_V2_NOT_FOUND'));
      }

      if (error.code === 'OPENAI_NOT_CONFIGURED') {
        return sendError(res, createHttpError(503, 'OpenAI review is not configured', 'QUOTER_V2_REVIEW_NOT_CONFIGURED'));
      }

      if (error.code === 'OPENAI_TIMEOUT') {
        return sendError(res, createHttpError(504, 'OpenAI review timed out', 'QUOTER_V2_REVIEW_TIMEOUT'));
      }

      return sendError(res, error, {
        status: 500,
        message: 'Error reviewing quoter v2',
        errorCode: 'QUOTER_V2_REVIEW_FAILED',
      });
    }
  }

  async calculatePrices(req, res) {
    try {
      const body = req.body || {};
      validateCalculatePricesPayload(body);

      if (!body.number_paxs || Number(body.number_paxs) < 1) {
        return sendError(res, createHttpError(400, 'number_paxs must be at least 1', 'QUOTER_V2_NUMBER_PAXS_INVALID'));
      }

      const result = await quoterV2PricingService.calculatePrices(body);
      return res.status(200).json(result);
    } catch (error) {
      return sendError(res, error, {
        status: 400,
        message: 'Error calculating quoter-v2 prices',
        errorCode: 'QUOTER_V2_PRICE_CALCULATION_FAILED',
      });
    }
  }
}

module.exports = new QuoterV2Controller();
