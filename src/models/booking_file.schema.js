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

const bookingFileSummaryContextSchema = new Schema({
  orders_total: { type: Number, default: 0, min: 0 },
  open_orders: { type: Number, default: 0, min: 0 },
  completed_orders: { type: Number, default: 0, min: 0 },
  blocked_orders: { type: Number, default: 0, min: 0 },
  overdue_orders: { type: Number, default: 0, min: 0 },
  due_today_orders: { type: Number, default: 0, min: 0 },
  reservation_unconfirmed: { type: Number, default: 0, min: 0 },
  reservation_due_today: { type: Number, default: 0, min: 0 },
  reservation_overdue: { type: Number, default: 0, min: 0 },
  reservation_reconfirmation_pending: { type: Number, default: 0, min: 0 },
  critical_reservations: { type: Number, default: 0, min: 0 },
  passenger_info_ready: { type: Boolean, default: false },
  all_required_areas_completed: { type: Boolean, default: false },
  overall_reason: { type: String, default: '', trim: true },
  risk_reason: { type: String, default: '', trim: true }
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

const bookingFormMetaSchema = new Schema({
  source: { type: String, default: '' },
  clientId: { type: String, default: '', trim: true },
  publicLinkToken: { type: String, default: '', trim: true },
  submittedAt: { type: Date, default: null },
  lastUpdatedAt: { type: Date, default: null },
  status: { type: String, default: 'PENDING', trim: true }
}, { _id: false });

const bookingFormPassengerGuestSchema = new Schema({
  firstname: { type: String, default: '', trim: true },
  lastname: { type: String, default: '', trim: true },
  birthdate: { type: Date, default: null },
  expirydate: { type: Date, default: null },
  gender: { type: String, default: '', trim: true },
  nationality: { type: String, default: '', trim: true },
  passport: { type: String, default: '', trim: true },
  passportfile: { type: String, default: '', trim: true },
  passportkey: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormEmergencyContactSchema = new Schema({
  name: { type: String, default: '', trim: true },
  relationship: { type: String, default: '', trim: true },
  homePhone: { type: String, default: '', trim: true },
  cellPhone: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormPassengerHealthSchema = new Schema({
  allergies: { type: String, default: '', trim: true },
  dietaryreq: { type: String, default: '', trim: true },
  medicalcondition: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormPassengerInsuranceSchema = new Schema({
  companyName: { type: String, default: '', trim: true },
  policyNumber: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormPassengerPhysicalSchema = new Schema({
  height: { type: String, default: '', trim: true },
  weight: { type: String, default: '', trim: true },
  shoeSize: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormPassengerComplementarySchema = new Schema({
  streetAddress: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  zipCode: { type: String, default: '', trim: true },
  country: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  homePhone: { type: String, default: '', trim: true },
  cellPhone: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormPassengerSchema = new Schema({
  guest: {
    type: bookingFormPassengerGuestSchema,
    default: () => ({})
  },
  econtact: {
    type: bookingFormEmergencyContactSchema,
    default: () => ({})
  },
  health: {
    type: bookingFormPassengerHealthSchema,
    default: () => ({})
  },
  insurance: {
    type: bookingFormPassengerInsuranceSchema,
    default: () => ({})
  },
  physicalinfo: {
    type: bookingFormPassengerPhysicalSchema,
    default: () => ({})
  },
  complementaryInfo: {
    type: bookingFormPassengerComplementarySchema,
    default: () => ({})
  },
  notes: { type: String, default: '' }
}, { _id: false });

const bookingFormContactPersonSchema = new Schema({
  guest: { type: String, default: '', trim: true },
  occupation: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormYourContactSchema = new Schema({
  street: { type: String, default: '', trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  zip: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  homePhone: { type: String, default: '', trim: true },
  cellPhone: { type: String, default: '', trim: true },
  contacts: {
    type: [bookingFormContactPersonSchema],
    default: []
  }
}, { _id: false });

const bookingFormFlightSchema = new Schema({
  type: { type: String, default: '', trim: true },
  flightnumber: { type: String, default: '', trim: true },
  departuredate: { type: Date, default: null },
  departuretime: { type: String, default: '', trim: true },
  arrivaldate: { type: Date, default: null },
  arrivaltime: { type: String, default: '', trim: true },
  departureairport: { type: String, default: '', trim: true },
  arrivalairport: { type: String, default: '', trim: true },
  recordlocator: { type: String, default: '', trim: true },
  route: { type: String, default: '', trim: true },
  extrainfo: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormRoomSchema = new Schema({
  guestNames: { type: String, default: '', trim: true },
  roomType: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormRestaurantSchema = new Schema({
  name: { type: String, default: '', trim: true },
  destination: { type: String, default: '', trim: true },
  date: { type: Date, default: null },
  time: { type: String, default: '', trim: true }
}, { _id: false });

const bookingFormSchema = new Schema({
  meta: {
    type: bookingFormMetaSchema,
    default: () => ({})
  },
  infopax: {
    type: [bookingFormPassengerSchema],
    default: []
  },
  emergencyContact: {
    type: bookingFormEmergencyContactSchema,
    default: () => ({})
  },
  yourContact: {
    type: bookingFormYourContactSchema,
    default: () => ({})
  },
  travelInsurance: {
    type: bookingFormPassengerInsuranceSchema,
    default: () => ({})
  },
  resvflights: {
    type: [bookingFormFlightSchema],
    default: []
  },
  resvroom: {
    type: [bookingFormRoomSchema],
    default: []
  },
  resvrestaurants: {
    type: [bookingFormRestaurantSchema],
    default: []
  },
  resvhotels: {
    type: [Schema.Types.Mixed],
    default: []
  },
  resvservices: {
    type: [Schema.Types.Mixed],
    default: []
  },
  additionalInfo: { type: String, default: '' }
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
  booking_form: {
    type: bookingFormSchema,
    default: () => ({})
  },
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
  summary_context: {
    type: bookingFileSummaryContextSchema,
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
