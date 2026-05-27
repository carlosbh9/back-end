const BookingFile = require('../../models/booking_file.schema');
const PublicBookingLink = require('../../models/publicBookingLink.schema');

class BookingFilePassengerOperationsService {
  normalizeText(value = '') {
    return String(value || '').trim();
  }

  normalizeDate(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  toDateKey(value) {
    const parsed = this.normalizeDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : '';
  }

  isObjectId(value = '') {
    return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim());
  }

  getFileReferenceCandidates(file = {}) {
    const values = [
      file.fileCode,
      file._id,
      file.quoter_id?._id || file.quoter_id,
      file.contact_id?._id || file.contact_id,
    ];

    return [...new Set(values.map((value) => this.normalizeText(value)).filter(Boolean))];
  }

  getSubmissionGuests(link = {}) {
    return Array.isArray(link?.submission?.guests) ? link.submission.guests : [];
  }

  getSubmissionRooms(link = {}) {
    return Array.isArray(link?.submission?.rooms) ? link.submission.rooms : [];
  }

  getInternationalFlights(link = {}) {
    const flights = link?.submission?.internationalFlights?.flights;
    return Array.isArray(flights) ? flights : [];
  }

  getDomesticFlights(link = {}) {
    const flights = link?.submission?.ownMadeReservations?.domesticFlights;
    if (Array.isArray(flights)) return flights;
    const legacy = link?.submission?.ownMadeReservations?.domesticFlight;
    return legacy ? [legacy] : [];
  }

  normalizeGuestNameParts(guest = {}) {
    const firstName = this.normalizeText(guest.firstName);
    const lastName = this.normalizeText(guest.lastName);
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    return { firstName, lastName, fullName };
  }

  normalizeGuestNameForMatch(value = '') {
    return this.normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
  }

  findRoomAssignment(guest = {}, rooms = []) {
    const { fullName, firstName, lastName } = this.normalizeGuestNameParts(guest);
    const candidates = [
      this.normalizeGuestNameForMatch(fullName),
      this.normalizeGuestNameForMatch(firstName),
      this.normalizeGuestNameForMatch(lastName),
    ].filter(Boolean);

    return rooms.find((room) => {
      const guestNames = this.normalizeGuestNameForMatch(room?.guestNames || '');
      if (!guestNames) return false;
      return candidates.some((candidate) => guestNames.includes(candidate));
    }) || null;
  }

  buildPassengerEntry(guest = {}, rooms = [], index = 0) {
    const names = this.normalizeGuestNameParts(guest);
    const room = this.findRoomAssignment(guest, rooms);
    const missing = [];

    if (!names.firstName) missing.push('first_name');
    if (!names.lastName) missing.push('last_name');
    if (!this.normalizeText(guest.passportNumber)) missing.push('passport_number');
    if (!this.normalizeText(guest.nationality)) missing.push('nationality');
    if (!this.normalizeText(guest.birthDate)) missing.push('birth_date');
    if (!this.normalizeText(guest.expiryDate)) missing.push('passport_expiry');
    if (!this.normalizeText(guest.passportKey) && !this.normalizeText(guest.passportFileName)) missing.push('passport_file');

    const dietary = this.normalizeText(guest.dietary?.dietary);
    const medical = this.normalizeText(guest.dietary?.medical);
    const allergies = this.normalizeText(guest.dietary?.allergies);
    const specialFlags = [];
    if (dietary) specialFlags.push('dietary');
    if (medical) specialFlags.push('medical');
    if (allergies) specialFlags.push('allergies');

    const documentationStatus = missing.length
      ? this.normalizeText(guest.passportFileName) || this.normalizeText(guest.passportKey)
        ? 'INCOMPLETE'
        : 'MISSING_PASSPORT'
      : 'COMPLETE';
    const roomLabelBase = this.normalizeText(room?.roomType);
    const roomLabelNotes = this.normalizeText(room?.notes);

    return {
      passenger_id: `guest-${index + 1}`,
      display_name: names.fullName || `Guest ${index + 1}`,
      first_name: names.firstName,
      last_name: names.lastName,
      passport_number: this.normalizeText(guest.passportNumber),
      passport_file_name: this.normalizeText(guest.passportFileName),
      passport_key: this.normalizeText(guest.passportKey),
      nationality: this.normalizeText(guest.nationality),
      birth_date: this.normalizeText(guest.birthDate),
      passport_expiry: this.normalizeText(guest.expiryDate),
      gender: this.normalizeText(guest.gender),
      notes: this.normalizeText(guest.notes),
      dietary,
      medical,
      allergies,
      height: this.normalizeText(guest.physical?.height),
      weight: this.normalizeText(guest.physical?.weight),
      shoe_size: this.normalizeText(guest.physical?.shoeSize),
      documentation_status: documentationStatus,
      rooming_status: room ? 'ASSIGNED' : 'UNASSIGNED',
      room_label: roomLabelBase ? `${roomLabelBase}${roomLabelNotes ? ` | ${roomLabelNotes}` : ''}` : '',
      missing_required_fields: missing,
      special_flags: specialFlags,
    };
  }

  buildFlightEntry(flight = {}, scope = 'INTERNATIONAL', index = 0) {
    return {
      flight_id: `${scope.toLowerCase()}-${index + 1}`,
      scope,
      flight_number: this.normalizeText(flight.flightNumber),
      departure_date: this.normalizeText(flight.departureDate),
      departure_time: this.normalizeText(flight.departureTime),
      arrival_date: this.normalizeText(flight.arrivalDate),
      arrival_time: this.normalizeText(flight.arrivalTime),
      departure_airport: this.normalizeText(flight.departureAirport),
      arrival_airport: this.normalizeText(flight.arrivalAirport),
      booking_code: this.normalizeText(flight.bookingCode),
    };
  }

  deriveCriticalMissing(passengers = [], emergencyContact = {}) {
    const missing = [];
    if (passengers.some((passenger) => passenger.documentation_status !== 'COMPLETE')) {
      missing.push('passenger_documentation');
    }
    if (passengers.some((passenger) => passenger.rooming_status === 'UNASSIGNED') && passengers.length > 1) {
      missing.push('rooming_assignment');
    }
    if (!this.normalizeText(emergencyContact?.name) || !this.normalizeText(emergencyContact?.cellPhone)) {
      missing.push('emergency_contact');
    }
    return missing;
  }

  buildPassengerInfoStatus({ file = {}, existingStatus = {}, hub = null } = {}) {
    const current = {
      status: existingStatus?.status || 'NOT_SENT',
      completion_percentage: Number(existingStatus?.completion_percentage) || 0,
      missing_required_fields: Array.isArray(existingStatus?.missing_required_fields) ? existingStatus.missing_required_fields : [],
      last_reminder_at: existingStatus?.last_reminder_at || null,
      reminder_count: Number(existingStatus?.reminder_count) || 0,
      validated_at: existingStatus?.validated_at || null,
      validated_by: existingStatus?.validated_by || null,
      notes: existingStatus?.notes || '',
    };

    if (!hub?.submission?.submitted_at) {
      return current;
    }

    const passengerCount = hub.summary.total_passengers || 0;
    const completed = hub.summary.complete_passengers || 0;
    const emergencyReady = hub.summary.emergency_contact_ready ? 1 : 0;
    const roomingReady = passengerCount <= 1 || hub.summary.rooming_pending === 0 ? 1 : 0;
    const denominator = passengerCount + 2;
    const completion = denominator > 0
      ? Math.round(((
        completed + emergencyReady + roomingReady
      ) / denominator) * 100)
      : 0;
    const missingRequiredFields = Array.isArray(hub.summary.critical_missing_fields)
      ? hub.summary.critical_missing_fields
      : [];
    const hasMissingRequiredFields = missingRequiredFields.length > 0;

    return {
      ...current,
      status: completion >= 100 && !hasMissingRequiredFields
        ? 'COMPLETED'
        : completion > 0
          ? 'IN_PROGRESS'
          : current.status,
      completion_percentage: completion,
      missing_required_fields: missingRequiredFields,
      notes: hasMissingRequiredFields
        ? `Passenger operations hub detected gaps: ${missingRequiredFields.join(', ')}`
        : '',
    };
  }

  async findLatestSubmissionForFile(file = {}) {
    const candidates = this.getFileReferenceCandidates(file);
    if (!candidates.length) return null;

    return PublicBookingLink.findOne({
      status: 'used',
      $or: [
        { clientId: { $in: candidates } },
        { 'submission.tracking.clientId': { $in: candidates } },
      ],
    })
      .sort({ usedAt: -1, updatedAt: -1 })
      .lean();
  }

  async resolveBookingFileIdByClientId(clientId = '') {
    const normalized = this.normalizeText(clientId);
    if (!normalized) return null;

    const query = [{ fileCode: normalized }];
    if (this.isObjectId(normalized)) {
      query.push({ _id: normalized }, { quoter_id: normalized }, { contact_id: normalized });
    }

    const item = await BookingFile.findOne({ $or: query }).select('_id').lean();
    return item?._id ? String(item._id) : null;
  }

  async buildPassengerOperationsHub(file = {}) {
    const link = await this.findLatestSubmissionForFile(file);
    const guests = this.getSubmissionGuests(link);
    const rooms = this.getSubmissionRooms(link);
    const internationalFlights = this.getInternationalFlights(link);
    const domesticFlights = this.getDomesticFlights(link);
    const passengers = guests.map((guest, index) => this.buildPassengerEntry(guest, rooms, index));
    const emergencyContact = link?.submission?.emergencyContact || {};
    const emergencyContactReady = !!(this.normalizeText(emergencyContact?.name) && this.normalizeText(emergencyContact?.cellPhone));
    const flightEntries = [
      ...internationalFlights.map((flight, index) => this.buildFlightEntry(flight, 'INTERNATIONAL', index)),
      ...domesticFlights.map((flight, index) => this.buildFlightEntry(flight, 'DOMESTIC', index)),
    ];
    const criticalMissingFields = this.deriveCriticalMissing(passengers, emergencyContact);

    return {
      submission: {
        client_id: this.normalizeText(link?.clientId),
        status: this.normalizeText(link?.status),
        submitted_at: link?.usedAt || null,
        expires_at: link?.expiresAt || null,
        public_url: this.normalizeText(link?.publicUrl),
      },
      summary: {
        total_passengers: passengers.length,
        complete_passengers: passengers.filter((passenger) => passenger.documentation_status === 'COMPLETE').length,
        incomplete_passengers: passengers.filter((passenger) => passenger.documentation_status !== 'COMPLETE').length,
        passengers_with_alerts: passengers.filter((passenger) => passenger.special_flags.length > 0 || passenger.missing_required_fields.length > 0).length,
        dietary_alerts: passengers.filter((passenger) => passenger.dietary || passenger.allergies).length,
        medical_alerts: passengers.filter((passenger) => passenger.medical).length,
        rooming_assigned: passengers.filter((passenger) => passenger.rooming_status === 'ASSIGNED').length,
        rooming_pending: passengers.length > 1
          ? passengers.filter((passenger) => passenger.rooming_status !== 'ASSIGNED').length
          : 0,
        emergency_contact_ready: emergencyContactReady,
        flights_total: flightEntries.length,
        critical_missing_fields: criticalMissingFields,
      },
      emergency_contact: {
        name: this.normalizeText(emergencyContact?.name),
        relationship: this.normalizeText(emergencyContact?.relationship),
        home_phone: this.normalizeText(emergencyContact?.homePhone),
        cell_phone: this.normalizeText(emergencyContact?.cellPhone),
      },
      passengers,
      flights: flightEntries,
      rooms: rooms.map((room, index) => ({
        room_id: `room-${index + 1}`,
        room_type: this.normalizeText(room?.roomType),
        guest_names: this.normalizeText(room?.guestNames),
        notes: this.normalizeText(room?.notes),
      })),
    };
  }

  async enrichBookingFile(file = {}, options = {}) {
    if (!file) {
      return null;
    }

    const hub = await this.buildPassengerOperationsHub(file);
    const passengerInfoStatus = this.buildPassengerInfoStatus({
      file,
      existingStatus: file.passenger_info_status,
      hub,
      options,
    });

    return {
      ...file,
      passenger_operations: hub,
      passenger_info_status: passengerInfoStatus,
    };
  }
}

module.exports = new BookingFilePassengerOperationsService();
