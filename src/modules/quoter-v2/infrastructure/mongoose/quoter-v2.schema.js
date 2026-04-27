const mongoose = require('mongoose');
const { QUOTE_V2_STATUSES } = require('../../domain/quoter-v2.types');

const { Schema } = mongoose;

const ServiceLineSchema = new Schema({
  city: { type: String, trim: true, default: '' },
  name_service: { type: String, trim: true, default: '' },
  type: { type: String, trim: true, default: '' },
  price_base: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, default: '' },
  tariff_item_id: { type: Schema.Types.ObjectId, ref: 'TariffItemV2', default: null },
  placement: { type: String, enum: ['services', 'options'], default: 'services' },
  pricing_meta: {
    auto_vehicle_type: { type: String, trim: true, default: '' },
    alerts: { type: [String], default: [] },
  },
}, { _id: false });

const ServicesDaySchema = new Schema({
  day: { type: Number, required: true, min: 1 },
  date: { type: String, trim: true, default: '' },
  number_paxs: { type: Number, default: 0, min: 0 },
  children_ages: { type: [Number], default: [] },
  isFixedLast: { type: Boolean, default: false },
  services: { type: [ServiceLineSchema], default: [] },
}, { _id: false });

const HotelSchema = new Schema({
  day: { type: Number, min: 1, default: 0 },
  date: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  name_hotel: { type: String, trim: true, default: '' },
  price_base: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  accomodatios_category: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  tariff_item_id: { type: Schema.Types.ObjectId, ref: 'TariffItemV2', default: null },
  placement: { type: String, enum: ['services', 'options'], default: 'services' },
  room_name: { type: String, trim: true, default: '' },
  occupancy: { type: String, trim: true, default: '' },
  room_rate_type: { type: String, enum: ['confidential', 'rack'], default: 'confidential' },
  price_source: { type: String, enum: ['tariff', 'manual'], default: 'tariff' },
}, { _id: false });

const FlightSchema = new Schema({
  date: { type: String, trim: true, default: '' },
  route: { type: String, trim: true, default: '' },
  price_base: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, default: '' },
}, { _id: false });

const OperatorSchema = new Schema({
  country: { type: String, trim: true, default: '' },
  name_operator: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  price_base: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, default: '' },
  tariff_item_id: { type: Schema.Types.ObjectId, ref: 'TariffItemV2', default: null },
  placement: { type: String, enum: ['services', 'options'], default: 'services' },
}, { _id: false });

const CruiseSchema = new Schema({
  name: { type: String, trim: true, default: '' },
  operator: { type: String, trim: true, default: '' },
  price_base: { type: Number, default: 0, min: 0 },
  price: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, default: '' },
}, { _id: false });

const TotalPricesSchema = new Schema({
  total_cost: { type: Number, default: 0 },
  external_utility: { type: Number, default: 0 },
  cost_external_taxes: { type: Number, default: 0 },
  total_cost_external: { type: Number, default: 0 },
  total_hoteles: { type: Number, default: 0 },
  total_services: { type: Number, default: 0 },
  total_ext_operator: { type: Number, default: 0 },
  total_ext_cruises: { type: Number, default: 0 },
  total_flights: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  cost_transfers: { type: Number, default: 0 },
  final_cost: { type: Number, default: 0 },
  price_pp: { type: Number, default: 0 },
  porcentajeTD: { type: Number, default: 0 },
}, { _id: false });

const QuoterV2Schema = new Schema({
  contact_id: { type: Schema.Types.ObjectId, ref: 'Contact', required: true, index: true },
  name_quoter: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: Object.values(QUOTE_V2_STATUSES),
    default: QUOTE_V2_STATUSES.DRAFT,
    index: true,
  },
  soldAt: { type: Date, default: null },
  soldBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  booking_file_id: { type: Schema.Types.ObjectId, ref: 'BookingFile', default: null },
  guest: { type: String, trim: true, default: '' },
  travelDate: {
    start: { type: String, trim: true, default: '' },
    end: { type: String, trim: true, default: '' },
  },
  accomodations: { type: String, trim: true, default: '' },
  destinations: { type: [String], default: [] },
  totalNights: { type: String, trim: true, default: '' },
  number_paxs: { type: Number, default: 0, min: 0 },
  children_ages: { type: [Number], default: [] },
  travel_agent: { type: String, trim: true, default: '' },
  exchange_rate: { type: String, trim: true, default: '' },
  services: { type: [ServicesDaySchema], default: [] },
  hotels: { type: [HotelSchema], default: [] },
  flights: { type: [FlightSchema], default: [] },
  operators: { type: [OperatorSchema], default: [] },
  cruises: { type: [CruiseSchema], default: [] },
  total_prices: { type: TotalPricesSchema, default: () => ({}) },
}, {
  collection: 'quoters',
  timestamps: true,
  versionKey: false,
});

QuoterV2Schema.index({ guest: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.QuoterV2 || mongoose.model('QuoterV2', QuoterV2Schema);
