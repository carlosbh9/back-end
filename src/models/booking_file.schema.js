const mongoose = require('mongoose');
const { Schema } = mongoose;

const BOOKING_OPERATION_STATUSES = ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
const BOOKING_RESERVATION_STATUSES = ['PENDING', 'PARTIAL', 'CONFIRMED', 'CANCELLED'];
const BOOKING_PAYMENT_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'REFUNDED', 'NOT_REQUIRED'];

const bookingFileSchema = new Schema({
  quoter_id: {
    type: Schema.Types.ObjectId,
    ref: 'Quoter',
    required: true,
    unique: true,
    index: true
  },
  contact_id: {
    type: Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
    index: true
  },
  fileCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },
  guest: { type: String, default: '' },
  travel_date_start: { type: String, default: '' },
  travel_date_end: { type: String, default: '' },
  destinations: { type: [String], default: [] },
  pax_summary: {
    number_paxs: { type: Number, default: 0 },
    children_ages: { type: [Number], default: [] }
  },
  sales_snapshot: { type: Schema.Types.Mixed, required: true },
  itinerary_snapshot: { type: Schema.Types.Mixed, required: true },
  operation_status: {
    type: String,
    enum: BOOKING_OPERATION_STATUSES,
    default: 'PENDING',
    index: true
  },
  reservation_status: {
    type: String,
    enum: BOOKING_RESERVATION_STATUSES,
    default: 'PENDING',
    index: true
  },
  payment_status: {
    type: String,
    enum: BOOKING_PAYMENT_STATUSES,
    default: 'PENDING',
    index: true
  },
  service_order_ids: {
    type: [{ type: Schema.Types.ObjectId, ref: 'ServiceOrder' }],
    default: []
  },
  notes: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('BookingFile', bookingFileSchema);
