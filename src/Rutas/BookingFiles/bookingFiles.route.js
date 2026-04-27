const express = require('express');
const mongoose = require('mongoose');

const BookingFile = require('../../models/booking_file.schema');
const ServiceOrder = require('../../models/service_order.schema');
const bookingFileSummaryService = require('../../Services/booking-files/booking-file-summary.service');
const bookingFileBibliaService = require('../../Services/booking-files/booking-file-biblia.service');
const {
  buildOperationalItineraryFromSnapshot,
  updateOperationalItineraryItem,
} = require('../../Services/booking-files/booking-file-operational-itinerary.service');
const { createHttpError, sendError } = require('../../utils/httpError');
const { createValidator, isPlainObject, isValidObjectId } = require('../../utils/requestValidation');

const router = express.Router();
const OPERATIONAL_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY'];
const APPLIES_TO_MODES = ['ALL_PAX', 'GROUP', 'INDIVIDUAL'];

function validateOperationalItineraryUpdatePayload(body) {
  const validator = createValidator({
    message: 'Invalid operational itinerary update payload',
    errorCode: 'BOOKING_FILE_OPERATIONAL_ITINERARY_UPDATE_VALIDATION_FAILED',
  });

  validator.requirePlainObject('body', body);
  if (!isPlainObject(body)) {
    validator.assert();
    return;
  }

  if (!Object.keys(body).length) {
    validator.addIssue('body', 'body must not be empty');
  }

  validator.optionalTime('sort_time', body.sort_time);
  validator.optionalString('city', body.city);
  validator.optionalString('title', body.title, { allowEmpty: false });
  validator.optionalString('subtitle', body.subtitle);
  validator.optionalObject('detail', body.detail);

  if (isPlainObject(body.detail)) {
    validator.optionalEnum('detail.status', body.detail.status, OPERATIONAL_STATUSES);
    validator.optionalTime('detail.start_time', body.detail.start_time);
    validator.optionalTime('detail.end_time', body.detail.end_time);
    validator.optionalTime('detail.pickup_time', body.detail.pickup_time);
    validator.optionalString('detail.meeting_point', body.detail.meeting_point);
    validator.optionalString('detail.responsible_name', body.detail.responsible_name);
    validator.optionalString('detail.supplier_name', body.detail.supplier_name);
    validator.optionalString('detail.supplier_contact', body.detail.supplier_contact);
    validator.optionalEnum('detail.applies_to_mode', body.detail.applies_to_mode, APPLIES_TO_MODES);
    validator.optionalStringArray('detail.applies_to_refs', body.detail.applies_to_refs);
    validator.optionalString('detail.notes', body.detail.notes);
  }

  validator.assert();
}

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
    service_order_ids: serviceOrders,
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
        { fileCode: { $regex: search, $options: 'i' } },
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
      BookingFile.countDocuments(query),
    ]);

    const hydratedItems = await Promise.all(items.map((item) => populateBookingFile(item)));

    return res.status(200).json({ items: hydratedItems, total, page, pageSize });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error listing booking files',
      errorCode: 'BOOKING_FILE_LIST_FAILED',
    });
  }
});

router.get('/biblia/daily', async (req, res) => {
  try {
    const result = await bookingFileBibliaService.getDailyView({
      date: req.query.date,
      area: req.query.area,
      status: req.query.status,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error building Biblia daily view',
      errorCode: 'BOOKING_FILE_BIBLIA_DAILY_FAILED',
    });
  }
});

router.get('/by-quoter/:quoterId', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.quoterId)) {
      return sendError(res, createHttpError(400, 'quoterId is invalid', 'QUOTER_V2_ID_INVALID'));
    }

    const bookingFile = await findBookingFile({ quoter_id: req.params.quoterId });
    if (!bookingFile) {
      return sendError(res, createHttpError(404, 'Booking file not found for this quoter', 'BOOKING_FILE_NOT_FOUND'));
    }

    return res.status(200).json(bookingFile);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error fetching booking file',
      errorCode: 'BOOKING_FILE_FETCH_FAILED',
    });
  }
});

router.get('/:id/operational-itinerary', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Booking file id is invalid', 'BOOKING_FILE_ID_INVALID'));
    }

    const bookingFile = await BookingFile.findById(req.params.id).lean();
    if (!bookingFile) {
      return sendError(res, createHttpError(404, 'Booking file not found', 'BOOKING_FILE_NOT_FOUND'));
    }

    return res.status(200).json(bookingFile.operational_itinerary || {
      generated_from_snapshot_at: null,
      updated_at: null,
      updated_by: null,
      completion_percentage: 0,
      days: [],
    });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error fetching operational itinerary',
      errorCode: 'BOOKING_FILE_OPERATIONAL_ITINERARY_FETCH_FAILED',
    });
  }
});

router.post('/:id/operational-itinerary/rebuild', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Booking file id is invalid', 'BOOKING_FILE_ID_INVALID'));
    }

    const bookingFile = await BookingFile.findById(req.params.id);
    if (!bookingFile) {
      return sendError(res, createHttpError(404, 'Booking file not found', 'BOOKING_FILE_NOT_FOUND'));
    }

    bookingFile.operational_itinerary = buildOperationalItineraryFromSnapshot(
      bookingFile.itinerary_snapshot || {},
      req.user?.id || null
    );
    bookingFile.updatedBy = req.user?.id || bookingFile.updatedBy || null;
    await bookingFile.save();

    return res.status(200).json(bookingFile.operational_itinerary);
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error rebuilding operational itinerary',
      errorCode: 'BOOKING_FILE_OPERATIONAL_ITINERARY_REBUILD_FAILED',
    });
  }
});

router.patch('/:id/operational-itinerary/items/:itemId', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Booking file id is invalid', 'BOOKING_FILE_ID_INVALID'));
    }
    if (!String(req.params.itemId || '').trim()) {
      return sendError(res, createHttpError(400, 'itemId is required', 'BOOKING_FILE_OPERATIONAL_ITEM_ID_REQUIRED'));
    }

    validateOperationalItineraryUpdatePayload(req.body);

    const bookingFile = await BookingFile.findById(req.params.id);
    if (!bookingFile) {
      return sendError(res, createHttpError(404, 'Booking file not found', 'BOOKING_FILE_NOT_FOUND'));
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
    return sendError(res, error, {
      status: 400,
      message: 'Error updating operational itinerary item',
      errorCode: 'BOOKING_FILE_OPERATIONAL_ITINERARY_UPDATE_FAILED',
    });
  }
});

router.post('/:id/recalculate-summary', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Booking file id is invalid', 'BOOKING_FILE_ID_INVALID'));
    }

    const updated = await bookingFileSummaryService.recalculateFileSummary(req.params.id, {
      updatedBy: req.user?.id || null,
    });
    return res.status(200).json(updated);
  } catch (error) {
    return sendError(res, error, {
      status: 400,
      message: 'Error recalculating file summary',
      errorCode: 'BOOKING_FILE_SUMMARY_RECALCULATE_FAILED',
    });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Booking file id is invalid', 'BOOKING_FILE_ID_INVALID'));
    }

    const bookingFile = await BookingFile.findById(req.params.id).lean({ virtuals: true });
    if (!bookingFile) {
      return sendError(res, createHttpError(404, 'Booking file not found', 'BOOKING_FILE_NOT_FOUND'));
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
      summary_context: bookingFile.summary_context,
      risk_level: bookingFile.risk_level,
      next_action: bookingFile.next_action,
      next_action_due_at: bookingFile.next_action_due_at,
      last_activity_at: bookingFile.last_activity_at,
      is_cancelled: bookingFile.is_cancelled,
    });
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error fetching booking file summary',
      errorCode: 'BOOKING_FILE_SUMMARY_FETCH_FAILED',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return sendError(res, createHttpError(400, 'Booking file id is invalid', 'BOOKING_FILE_ID_INVALID'));
    }

    const bookingFile = await findBookingFile({ _id: req.params.id });
    if (!bookingFile) {
      return sendError(res, createHttpError(404, 'Booking file not found', 'BOOKING_FILE_NOT_FOUND'));
    }

    return res.status(200).json(bookingFile);
  } catch (error) {
    return sendError(res, error, {
      status: 500,
      message: 'Error fetching booking file',
      errorCode: 'BOOKING_FILE_FETCH_FAILED',
    });
  }
});

module.exports = router;
