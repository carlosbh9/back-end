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

const OPERATIONAL_ITINERARY_ITEM_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY'];
const OPERATIONAL_ITINERARY_ITEM_TYPES = ['SERVICE', 'HOTEL', 'FLIGHT', 'OPERATOR', 'CRUISE', 'TRANSPORT', 'EXPERIENCE'];
const OPERATIONAL_ITINERARY_SOURCE_SECTIONS = ['services', 'hotels', 'flights', 'operators', 'cruises'];
const OPERATIONAL_ITINERARY_APPLIES_TO = ['ALL_PAX', 'GROUP', 'INDIVIDUAL'];

const operationalDetailSchema = new Schema({
  status: {
    type: String,
    enum: OPERATIONAL_ITINERARY_ITEM_STATUSES,
    default: 'PENDING'
  },
  start_time: { type: String, default: '' },
  end_time: { type: String, default: '' },
  pickup_time: { type: String, default: '' },
  meeting_point: { type: String, default: '' },
  responsible_name: { type: String, default: '' },
  supplier_name: { type: String, default: '' },
  supplier_contact: { type: String, default: '' },
  applies_to_mode: {
    type: String,
    enum: OPERATIONAL_ITINERARY_APPLIES_TO,
    default: 'ALL_PAX'
  },
  applies_to_refs: { type: [String], default: [] },
  notes: { type: String, default: '' },
  completed_at: { type: Date, default: null },
  completed_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updated_at: { type: Date, default: null }
}, { _id: false });

const operationalItineraryItemSchema = new Schema({
  item_id: { type: String, required: true, trim: true },
  source_section: {
    type: String,
    enum: OPERATIONAL_ITINERARY_SOURCE_SECTIONS,
    required: true
  },
  source_ref_id: { type: String, default: '' },
  item_type: {
    type: String,
    enum: OPERATIONAL_ITINERARY_ITEM_TYPES,
    required: true
  },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  sort_time: { type: String, default: '' },
  detail: {
    type: operationalDetailSchema,
    default: () => ({})
  }
}, { _id: false });

const operationalItineraryDaySchema = new Schema({
  day: { type: Number, required: true, min: 0 },
  date: { type: String, default: '' },
  city: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: OPERATIONAL_ITINERARY_ITEM_STATUSES,
    default: 'PENDING'
  },
  items: { type: [operationalItineraryItemSchema], default: [] }
}, { _id: false });

const operationalItinerarySchema = new Schema({
  generated_from_snapshot_at: { type: Date, default: null },
  updated_at: { type: Date, default: null },
  updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  completion_percentage: { type: Number, default: 0, min: 0, max: 100 },
  days: { type: [operationalItineraryDaySchema], default: [] }
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
  operational_itinerary: {
    type: operationalItinerarySchema,
    default: () => ({})
  },
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
