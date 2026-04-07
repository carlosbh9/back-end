const quoterV2Service = require('../application/services/quoter-v2.service');
const quoterV2PricingService = require('../application/services/quoter-v2-pricing.service');
const { QUOTE_V2_STATUSES, QUOTER_V2_SORT_FIELDS } = require('../domain/quoter-v2.types');
const QuoterV2 = require('../infrastructure/mongoose/quoter-v2.schema');
const Contact = require('../../../models/contact.schema');
const BookingFile = require('../../../models/booking_file.schema');
const serviceOrderOrchestrator = require('../../../Services/service-orders/service-order.orchestrator');
const bookingFileSummaryService = require('../../../Services/booking-files/booking-file-summary.service');
const { buildOperationalItineraryFromSnapshot } = require('../../../Services/booking-files/booking-file-operational-itinerary.service');
const {
  buildContactAccessFilter,
  findAccessibleContactById
} = require('../../../Services/contacts/contact-access.service');

function normalizeFileCode(value = '') {
  return String(value).trim().toUpperCase();
}

function buildBookingSnapshot(quoter) {
  return {
    services: quoter.services || [],
    hotels: quoter.hotels || [],
    flights: quoter.flights || [],
    operators: quoter.operators || [],
    cruises: quoter.cruises || [],
    total_prices: quoter.total_prices || {}
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
      status: String(source.quoter_id) === String(soldQuoterId) ? 'SOLD' : 'WIP'
    };
  });
}

async function resolveContactForQuote(body = {}, user = null) {
  if (body.contact_id) {
    const contact = await findAccessibleContactById(body.contact_id, user, '_id owner');
    if (!contact) {
      throw new Error('contact_id is invalid or not accessible for this user');
    }

    return contact._id;
  }

  const guestName = String(body.guest || '').trim();
  if (!guestName) {
    throw new Error('guest is required');
  }

  let contact = await Contact.findOne(buildContactAccessFilter(user, { name: guestName })).select('_id owner');
  if (!contact) {
    if (!user?.id) {
      throw new Error('contact_id or authenticated user is required');
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
      return res.status(500).json({ message: 'Error listing quoters v2', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const item = await quoterV2Service.getById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: 'Quoter V2 not found' });
      }
      return res.status(200).json(item);
    } catch (error) {
      return res.status(500).json({ message: 'Error loading quoter v2', error: error.message });
    }
  }

  async create(req, res) {
    try {
      const contactId = await resolveContactForQuote(req.body, req.user);
      const created = await quoterV2Service.create({
        ...req.body,
        contact_id: contactId,
      });
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({ message: 'Error creating quoter v2', error: error.message });
    }
  }

  async update(req, res) {
    try {
      const contactId = req.body.contact_id || await resolveContactForQuote(req.body, req.user);
      const updated = await quoterV2Service.update(req.params.id, {
        ...req.body,
        contact_id: contactId,
      });
      if (!updated) {
        return res.status(404).json({ message: 'Quoter V2 not found' });
      }
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({ message: 'Error updating quoter v2', error: error.message });
    }
  }

  async remove(req, res) {
    try {
      const deleted = await quoterV2Service.remove(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Quoter V2 not found' });
      }
      return res.status(200).json(deleted);
    } catch (error) {
      return res.status(500).json({ message: 'Error deleting quoter v2', error: error.message });
    }
  }

  async confirmSale(req, res) {
    try {
      const requestedFileCode = normalizeFileCode(req.body?.fileCode);
      const quoter = await QuoterV2.findById(req.params.id);
      if (!quoter) {
        return res.status(404).json({ message: 'Quoter V2 not found' });
      }

      const contact = await Contact.findOne({ 'cotizations.quoter_id': quoter._id });
      if (!contact) {
        return res.status(400).json({ message: 'Contact not found for this quoter' });
      }

      const changedBy = req.user?.id || null;
      const existingBookingFile = quoter.booking_file_id
        ? await BookingFile.findById(quoter.booking_file_id)
        : await BookingFile.findOne({ quoter_id: quoter._id });

      const fileCode = requestedFileCode || existingBookingFile?.fileCode || '';
      if (!fileCode) {
        return res.status(400).json({ message: 'fileCode is required to confirm sale' });
      }

      const duplicatedFile = await BookingFile.findOne({
        fileCode,
        ...(existingBookingFile?._id ? { _id: { $ne: existingBookingFile._id } } : {})
      }).select('_id fileCode');

      if (duplicatedFile) {
        return res.status(409).json({ message: `File code ${fileCode} is already in use` });
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
          children_ages: quoter.children_ages || []
        },
        sales_snapshot: {
          quoter_id: quoter._id,
          status: 'SOLD',
          soldAt: new Date().toISOString(),
          total_prices: quoter.total_prices || {}
        },
        itinerary_snapshot: itinerarySnapshot,
        operational_itinerary: buildOperationalItineraryFromSnapshot(itinerarySnapshot, changedBy),
        updatedBy: changedBy
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
          ...bookingPayload
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
        changedBy
      });

      const serviceOrderIds = (ordersResult.orders || []).map((order) => order._id);
      bookingFile = await BookingFile.findByIdAndUpdate(
        bookingFile._id,
        { $set: { service_order_ids: serviceOrderIds, updatedBy: changedBy } },
        { new: true }
      );
      bookingFile = await bookingFileSummaryService.recalculateFileSummary(String(bookingFile._id), { updatedBy: changedBy });

      return res.status(200).json({
        message: 'Sale confirmed successfully',
        quoter,
        bookingFile,
        serviceOrders: {
          businessEventId: ordersResult.businessEventId,
          createdCount: ordersResult.createdCount
        }
      });
    } catch (error) {
      return res.status(500).json({ message: 'Error confirming sale', error: error.message });
    }
  }

  async calculatePrices(req, res) {
    try {
      const body = req.body || {};
      if (!body.number_paxs || Number(body.number_paxs) < 1) {
        return res.status(400).json({ message: 'number_paxs must be at least 1' });
      }

      const result = await quoterV2PricingService.calculatePrices(body);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ message: 'Error calculating quoter-v2 prices', error: error.message });
    }
  }
}

module.exports = new QuoterV2Controller();
