const express = require('express');
const router = express.Router();
const Boom = require('@hapi/boom');

const Quoter = require('../../../src/models/quoter.schema');
const Contact = require('../../models/contact.schema');
const BookingFile = require('../../models/booking_file.schema');
const serviceOrderOrchestrator = require('../../Services/service-orders/service-order.orchestrator');

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

router.post('/', async (req, res) => {
  try {
    const quoter = new Quoter(req.body);
    await quoter.save();
    res.status(201).send(quoter);
  } catch (error) {
    res.status(400).send(error);
  }
});

router.get('/', async (req, res) => {
  try {
    const quoters = await Quoter.find().select('_id guest contact_id name_quoter status booking_file_id soldAt');
    res.status(200).send(quoters);
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quoter = await Quoter.findById(req.params.id);
    if (!quoter) {
      return res.status(404).send(Boom.notFound('Error, ID no válida/encontrada').output.payload);
    }

    if (quoter.services?.length) {
      quoter.services.sort((a, b) => a.day - b.day);
    }
    if (quoter.hotels?.length) {
      quoter.hotels.sort((a, b) => a.day - b.day);
    }

    res.status(200).send(quoter);
  } catch (error) {
    res.status(500).send(error);
  }
});

router.post('/:id/confirm-sale', async (req, res) => {
  try {
    const requestedFileCode = normalizeFileCode(req.body?.fileCode);
    const quoter = await Quoter.findById(req.params.id);
    if (!quoter) {
      return res.status(404).json({ message: 'Quoter not found' });
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

    const bookingPayload = {
      contact_id: contact._id,
      fileCode,
      guest: quoter.guest || contact.name || '',
      travel_date_start: quoter.travelDate?.start || '',
      travel_date_end: quoter.travelDate?.end || '',
      destinations: quoter.destinations || [],
      pax_summary: {
        number_paxs: quoter.number_paxs || [],
        children_ages: quoter.children_ages || []
      },
      sales_snapshot: {
        quoter_id: quoter._id,
        status: 'SOLD',
        soldAt: new Date().toISOString(),
        total_prices: quoter.total_prices || {}
      },
      itinerary_snapshot: buildBookingSnapshot(quoter),
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
      changedBy
    });

    const serviceOrderIds = (ordersResult.orders || []).map((order) => order._id);
    bookingFile = await BookingFile.findByIdAndUpdate(
      bookingFile._id,
      { $set: { service_order_ids: serviceOrderIds, updatedBy: changedBy } },
      { new: true }
    );

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
});

router.delete('/:id', async (req, res) => {
  try {
    const quoter = await Quoter.findByIdAndDelete(req.params.id);
    if (!quoter) {
      return res.status(404).send({ message: 'Quoter not found' });
    }

    const contact = await Contact.findOneAndUpdate(
      { 'cotizations.quoter_id': quoter._id },
      { $pull: { cotizations: { quoter_id: quoter._id } } },
      { new: true }
    );

    if (!contact) {
      return res.status(404).send({ message: 'Contact not found or no cotization to remove' });
    }

    res.status(200).send({ quoter, contact });
  } catch (error) {
    res.status(500).send({ message: 'Error deleting quoter and updating contact', error });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const quoter = await Quoter.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!quoter) {
      return res.status(404).send();
    }
    res.status(200).send(quoter);
  } catch (error) {
    res.status(400).send(error);
  }
});

module.exports = router;
