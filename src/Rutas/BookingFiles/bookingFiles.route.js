const express = require('express');
const mongoose = require('mongoose');
const BookingFile = require('../../models/booking_file.schema');

const router = express.Router();

async function findBookingFile(filter) {
  return BookingFile.findOne(filter)
    .populate('contact_id', '_id name email phone status')
    .populate('quoter_id', '_id guest status soldAt booking_file_id')
    .populate({
      path: 'service_order_ids',
      options: { sort: { dueDate: 1, createdAt: -1 } }
    })
    .lean();
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 20, 1);
    const skip = (page - 1) * pageSize;

    const query = {};
    if (req.query.operation_status) {
      query.operation_status = req.query.operation_status;
    }
    if (req.query.reservation_status) {
      query.reservation_status = req.query.reservation_status;
    }
    if (req.query.payment_status) {
      query.payment_status = req.query.payment_status;
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

    return res.status(200).json({ items, total, page, pageSize });
  } catch (error) {
    return res.status(500).json({ message: 'Error listing booking files', error: error.message });
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
