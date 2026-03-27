const mongoose = require('mongoose');
const { Schema } = mongoose;

const FILE_OVERALL_STATUSES = ['PENDING', 'ACTIVE', 'AT_RISK', 'READY', 'COMPLETED', 'CANCELLED'];
const FILE_AREA_STATUSES = ['NOT_STARTED', 'PENDING', 'IN_PROGRESS', 'PARTIAL', 'COMPLETED', 'BLOCKED', 'CANCELLED', 'NOT_REQUIRED'];
const FILE_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PASSENGER_INFO_STATUSES = ['NOT_SENT', 'SENT', 'IN_PROGRESS', 'INCOMPLETE', 'COMPLETED', 'VALIDATED'];

const passengerInfoStatusSchema = new Schema({
  status: {
    type: String,
    enum: PASSENGER_INFO_STATUSES,
    default: 'NOT_SENT',
    index: true
  },
  completion_percentage: { type: Number, default: 0, min: 0, max: 100 },
  missing_required_fields: { type: [String], default: [] },
  last_reminder_at: { type: Date, default: null },
  reminder_count: { type: Number, default: 0, min: 0 },
  validated_at: { type: Date, default: null },
  validated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  notes: { type: String, default: '' }
}, { _id: false });

const bookingFileSchema = new Schema({
  quoter_id: {
    type: Schema.Types.ObjectId,
    ref: 'QuoterV2',
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
  overall_status: {
    type: String,
    enum: FILE_OVERALL_STATUSES,
    default: 'PENDING',
    index: true
  },
  operations_status: {
    type: String,
    enum: FILE_AREA_STATUSES,
    default: 'PENDING',
    index: true
  },
  reservations_status: {
    type: String,
    enum: FILE_AREA_STATUSES,
    default: 'PENDING',
    index: true
  },
  payments_status: {
    type: String,
    enum: FILE_AREA_STATUSES,
    default: 'PENDING',
    index: true
  },
  deliverables_status: {
    type: String,
    enum: FILE_AREA_STATUSES,
    default: 'PENDING',
    index: true
  },
  passenger_info_status: {
    type: passengerInfoStatusSchema,
    default: () => ({})
  },
  owner_user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  risk_level: {
    type: String,
    enum: FILE_RISK_LEVELS,
    default: 'LOW',
    index: true
  },
  next_action: { type: String, default: '' },
  next_action_due_at: { type: Date, default: null, index: true },
  last_activity_at: { type: Date, default: null, index: true },
  is_cancelled: { type: Boolean, default: false, index: true },
  cancel_reason: { type: String, default: '' },
  cancelled_at: { type: Date, default: null },
  service_order_ids: {
    type: [{ type: Schema.Types.ObjectId, ref: 'ServiceOrder' }],
    default: []
  },
  notes: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

bookingFileSchema.virtual('operation_status')
  .get(function getOperationStatus() {
    return this.operations_status;
  })
  .set(function setOperationStatus(value) {
    this.operations_status = value;
  });

bookingFileSchema.virtual('reservation_status')
  .get(function getReservationStatus() {
    return this.reservations_status;
  })
  .set(function setReservationStatus(value) {
    this.reservations_status = value;
  });

bookingFileSchema.virtual('payment_status')
  .get(function getPaymentStatus() {
    return this.payments_status;
  })
  .set(function setPaymentStatus(value) {
    this.payments_status = value;
  });

bookingFileSchema.set('toJSON', { virtuals: true });
bookingFileSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('BookingFile', bookingFileSchema);
