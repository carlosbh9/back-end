const express = require('express');
const mongoose = require('mongoose');
const BookingFile = require('../../models/booking_file.schema');
const ServiceOrder = require('../../models/service_order.schema');
const bookingFileSummaryService = require('../../Services/booking-files/booking-file-summary.service');
const bookingFileBibliaService = require('../../Services/booking-files/booking-file-biblia.service');
const {
  buildOperationalItineraryFromSnapshot,
  updateOperationalItineraryItem
} = require('../../Services/booking-files/booking-file-operational-itinerary.service');

const router = express.Router();

async function resolveServiceOrdersForFile(bookingFile) {
  const fileId = bookingFile?._id;
  const byFile = fileId
    ? await ServiceOrder.find({ file_id: fileId }).sort({ dueDate: 1, createdAt: -1 }).lean()
    : [];

  if (byFile.length) {
    return byFile;
  }

  if (!Array.isArray(bookingFile?.service_order_ids) || !bookingFile.service_order_ids.length) {
    return [];
  }

  return ServiceOrder.find({ _id: { $in: bookingFile.service_order_ids } })
    .sort({ dueDate: 1, createdAt: -1 })
    .lean();
}

async function populateBookingFile(bookingFile) {
  if (!bookingFile) return null;
  const serviceOrders = await resolveServiceOrdersForFile(bookingFile);
  return {
    ...bookingFile,
    service_order_ids: serviceOrders
  };
}

async function findBookingFile(filter) {
  const item = await BookingFile.findOne(filter)
    .populate('contact_id', '_id name email phone status')
    .populate('quoter_id', '_id guest status soldAt booking_file_id')
    .lean();
  return populateBookingFile(item);
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 20, 1);
    const skip = (page - 1) * pageSize;

    const query = {};
    if (req.query.overall_status) {
      query.overall_status = req.query.overall_status;
    }
    if (req.query.operations_status) {
      query.operations_status = req.query.operations_status;
    }
    if (req.query.reservations_status) {
      query.reservations_status = req.query.reservations_status;
    }
    if (req.query.payments_status) {
      query.payments_status = req.query.payments_status;
    }
    if (req.query.deliverables_status) {
      query.deliverables_status = req.query.deliverables_status;
    }
    if (req.query.risk_level) {
      query.risk_level = req.query.risk_level;
    }
    const rawQuery = String(req.query.q || '').trim();
    if (rawQuery) {
      const search = rawQuery.toUpperCase();
      query.$or = [
        { fileCode: { $regex: search, $options: 'i' } }
      ];

      if (mongoose.Types.ObjectId.isValid(rawQuery)) {
        query.$or.push({ _id: rawQuery });
      }
    }

    const [items, total] = await Promise.all([
      BookingFile.find(query)
        .populate('contact_id', '_id name email phone status')
        .populate('quoter_id', '_id guest status soldAt booking_file_id')
        .sort({ createdAt: -1, fileCode: 1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      BookingFile.countDocuments(query)
    ]);

    const hydratedItems = await Promise.all(items.map((item) => populateBookingFile(item)));

    return res.status(200).json({ items: hydratedItems, total, page, pageSize });
  } catch (error) {
    return res.status(500).json({ message: 'Error listing booking files', error: error.message });
  }
});

router.get('/biblia/daily', async (req, res) => {
  try {
    const result = await bookingFileBibliaService.getDailyView({
      date: req.query.date,
      area: req.query.area,
      status: req.query.status
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Error building Biblia daily view', error: error.message });
  }
});

router.get('/by-quoter/:quoterId', async (req, res) => {
  try {
    const bookingFile = await findBookingFile({ quoter_id: req.params.quoterId });
    if (!bookingFile) {
      return res.status(404).json({ message: 'Booking file not found for this quoter' });
    }
    return res.status(200).json(bookingFile);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching booking file', error: error.message });
  }
});

router.get('/:id/operational-itinerary', async (req, res) => {
  try {
    const bookingFile = await BookingFile.findById(req.params.id).lean();
    if (!bookingFile) {
      return res.status(404).json({ message: 'Booking file not found' });
    }

    return res.status(200).json(bookingFile.operational_itinerary || {
      generated_from_snapshot_at: null,
      updated_at: null,
      updated_by: null,
      completion_percentage: 0,
      days: []
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching operational itinerary', error: error.message });
  }
});

router.post('/:id/operational-itinerary/rebuild', async (req, res) => {
  try {
    const bookingFile = await BookingFile.findById(req.params.id);
    if (!bookingFile) {
      return res.status(404).json({ message: 'Booking file not found' });
    }

    bookingFile.operational_itinerary = buildOperationalItineraryFromSnapshot(
      bookingFile.itinerary_snapshot || {},
      req.user?.id || null
    );
    bookingFile.updatedBy = req.user?.id || bookingFile.updatedBy || null;
    await bookingFile.save();

    return res.status(200).json(bookingFile.operational_itinerary);
  } catch (error) {
    return res.status(400).json({ message: 'Error rebuilding operational itinerary', error: error.message });
  }
});

router.patch('/:id/operational-itinerary/items/:itemId', async (req, res) => {
  try {
    const bookingFile = await BookingFile.findById(req.params.id);
    if (!bookingFile) {
      return res.status(404).json({ message: 'Booking file not found' });
    }

    bookingFile.operational_itinerary = updateOperationalItineraryItem(
      bookingFile.operational_itinerary || { days: [] },
      req.params.itemId,
      req.body || {},
      req.user?.id || null
    );
    bookingFile.updatedBy = req.user?.id || bookingFile.updatedBy || null;
    await bookingFile.save();

    return res.status(200).json(bookingFile.operational_itinerary);
  } catch (error) {
    return res.status(400).json({ message: 'Error updating operational itinerary item', error: error.message });
  }
});

router.post('/:id/recalculate-summary', async (req, res) => {
  try {
    const updated = await bookingFileSummaryService.recalculateFileSummary(req.params.id, {
      updatedBy: req.user?.id || null
    });
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ message: 'Error recalculating file summary', error: error.message });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const bookingFile = await BookingFile.findById(req.params.id).lean({ virtuals: true });
    if (!bookingFile) {
      return res.status(404).json({ message: 'Booking file not found' });
    }
    return res.status(200).json({
      _id: bookingFile._id,
      fileCode: bookingFile.fileCode,
      overall_status: bookingFile.overall_status,
      operations_status: bookingFile.operations_status,
      reservations_status: bookingFile.reservations_status,
      payments_status: bookingFile.payments_status,
      deliverables_status: bookingFile.deliverables_status,
      passenger_info_status: bookingFile.passenger_info_status,
      risk_level: bookingFile.risk_level,
      next_action: bookingFile.next_action,
      next_action_due_at: bookingFile.next_action_due_at,
      last_activity_at: bookingFile.last_activity_at,
      is_cancelled: bookingFile.is_cancelled
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching booking file summary', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const bookingFile = await findBookingFile({ _id: req.params.id });
    if (!bookingFile) {
      return res.status(404).json({ message: 'Booking file not found' });
    }
    return res.status(200).json(bookingFile);
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching booking file', error: error.message });
  }
});

module.exports = router;
