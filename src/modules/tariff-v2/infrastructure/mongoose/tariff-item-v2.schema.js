const mongoose = require('mongoose');
const {
  CHILD_PRICE_TYPES,
  OCCUPANCY_TYPES,
  PRICING_MODES,
  PRODUCT_CATEGORIES,
  SEASON_TYPES,
  SPECIAL_DATE_OPERATIONS,
  TARIFF_ITEM_TYPES,
  TARIFF_STATUSES,
  VEHICLE_TYPES,
} = require('../../domain/tariff-v2.types');
const { PRICING_MODE_REQUIRED_BLOCKS, TARIFF_TYPE_RULES } = require('../../domain/tariff-v2.rules');

const { Schema } = mongoose;

const ChildPolicySchema = new Schema({
  minAge: { type: Number, default: null },
  maxAge: { type: Number, default: null },
  priceType: { type: String, enum: CHILD_PRICE_TYPES, required: true },
  value: { type: Number, required: true, min: 0 },
}, { _id: false });

const SpecialDateRuleSchema = new Schema({
  date: { type: String, required: true, trim: true },
  operation: { type: String, enum: SPECIAL_DATE_OPERATIONS, required: true },
  value: { type: Number, default: null },
  note: { type: String, trim: true },
}, { _id: false });

const ClosingDateRuleSchema = new Schema({
  date: { type: String, required: true, trim: true },
  note: { type: String, trim: true },
}, { _id: false });

const PaxRangeRateSchema = new Schema({
  minPax: { type: Number, required: true, min: 1 },
  maxPax: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  vehicleType: { type: String, enum: VEHICLE_TYPES },
}, { _id: false });

const OccupancyRateSchema = new Schema({
  occupancy: { type: String, enum: OCCUPANCY_TYPES, required: true },
  confidential: { type: Number, required: true, min: 0 },
  rack: { type: Number, required: true, min: 0 },
}, { _id: false });

const RoomRateSchema = new Schema({
  roomName: { type: String, required: true, trim: true },
  occupancyRates: {
    type: [OccupancyRateSchema],
    default: [],
    validate: {
      validator: (value) => Array.isArray(value) && value.length > 0,
      message: 'rooms[].occupancyRates must contain at least one occupancy rate',
    },
  },
}, { _id: false });

const SeasonRateSchema = new Schema({
  season: { type: String, enum: SEASON_TYPES, required: true },
  adultPrice: { type: Number, required: true, min: 0 },
  childPrice: { type: Number, default: null, min: 0 },
  guidePrice: { type: Number, default: null, min: 0 },
}, { _id: false });

const VehicleRateSchema = new Schema({
  vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
  price: { type: Number, required: true, min: 0 },
}, { _id: false });

const TariffContentSchema = new Schema({
  shortDescription: { type: String, trim: true },
  description: { type: String, trim: true },
  duration: { type: String, trim: true },
  schedules: { type: String, trim: true },
  remarks: { type: String, trim: true },
  observations: { type: String, trim: true },
  cancellationPolicy: { type: String, trim: true },
  contactPhone: { type: String, trim: true },
  nearbyPlaces: { type: String, trim: true },
  generalInfo: { type: Schema.Types.Mixed, default: undefined },
}, { _id: false });

const TariffValiditySchema = new Schema({
  year: { type: String, required: true, trim: true },
  dateFrom: { type: String, default: null, trim: true },
  dateTo: { type: String, default: null, trim: true },
  specialDates: { type: [SpecialDateRuleSchema], default: [] },
  closingDates: { type: [ClosingDateRuleSchema], default: [] },
}, { _id: false });

const TariffLegacyRefSchema = new Schema({
  collection: { type: String, trim: true },
  legacyId: { type: String, trim: true },
}, { _id: false });

const TariffPricingSchema = new Schema({
  mode: { type: String, enum: PRICING_MODES, required: true },
  currency: { type: String, trim: true, default: 'USD' },
  pricePerson: { type: Boolean, default: null },
  basePrice: { type: Number, default: null, min: 0 },
  soloTravelerPrice: { type: Number, default: null, min: 0 },
  guidePrice: { type: Number, default: null, min: 0 },
  ranges: { type: [PaxRangeRateSchema], default: [] },
  rooms: { type: [RoomRateSchema], default: [] },
  seasons: { type: [SeasonRateSchema], default: [] },
  vehicleRates: { type: [VehicleRateSchema], default: [] },
  custom: { type: Schema.Types.Mixed, default: null },
}, { _id: false });

function hasArrayItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function validatePricingModeBlocks(pricing) {
  const requiredBlocks = PRICING_MODE_REQUIRED_BLOCKS[pricing.mode] || [];

  return requiredBlocks.every((blockName) => {
    const blockValue = pricing[blockName];

    if (Array.isArray(blockValue)) {
      return blockValue.length > 0;
    }

    if (typeof blockValue === 'number') {
      return blockValue >= 0;
    }

    return blockValue !== null && blockValue !== undefined;
  });
}

const TariffItemV2Schema = new Schema({
  code: { type: String, trim: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  provider: { type: String, trim: true, index: true },
  type: { type: String, enum: TARIFF_ITEM_TYPES, required: true, index: true },
  category: { type: String, enum: PRODUCT_CATEGORIES, required: true, index: true },
  subtype: { type: String, trim: true },
  city: { type: String, trim: true, index: true },
  location: { type: String, trim: true },
  active: { type: Boolean, required: true, default: true, index: true },
  status: { type: String, enum: TARIFF_STATUSES, required: true, default: 'DRAFT', index: true },
  tags: { type: [String], default: [] },
  content: { type: TariffContentSchema, default: undefined },
  pricing: { type: TariffPricingSchema, required: true },
  childPolicies: { type: [ChildPolicySchema], default: [] },
  validity: { type: TariffValiditySchema, required: true },
  notes: { type: String, trim: true },
  legacy: { type: TariffLegacyRefSchema, default: undefined },
  metadata: { type: Schema.Types.Mixed, default: undefined },
}, {
  collection: 'tariff_items_v2',
  timestamps: true,
  versionKey: false,
});

TariffItemV2Schema.index({ type: 1, category: 1, status: 1, active: 1 });
TariffItemV2Schema.index({ provider: 1, city: 1 });
TariffItemV2Schema.index({ 'validity.year': 1, 'validity.dateFrom': 1, 'validity.dateTo': 1 });
TariffItemV2Schema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: {
      code: { $exists: true, $type: 'string', $ne: '' },
    },
  },
);

TariffItemV2Schema.path('childPolicies').validate({
  validator: (policies) => {
    if (!Array.isArray(policies)) return true;

    return policies.every((policy) => {
      const minAge = policy.minAge ?? null;
      const maxAge = policy.maxAge ?? null;
      return minAge === null || maxAge === null || minAge <= maxAge;
    });
  },
  message: 'childPolicies must have minAge <= maxAge',
});

TariffItemV2Schema.path('pricing.ranges').validate({
  validator: (ranges) => {
    if (!Array.isArray(ranges)) return true;
    return ranges.every((range) => range.minPax <= range.maxPax);
  },
  message: 'pricing.ranges must define minPax <= maxPax',
});

TariffItemV2Schema.path('validity').validate({
  validator: (validity) => {
    if (!validity?.dateFrom || !validity?.dateTo) {
      return true;
    }

    return new Date(validity.dateFrom).getTime() <= new Date(validity.dateTo).getTime();
  },
  message: 'validity.dateFrom must be less than or equal to validity.dateTo',
});

TariffItemV2Schema.pre('validate', function validateTariffItem(next) {
  const rule = TARIFF_TYPE_RULES[this.type];

  if (!rule) {
    this.invalidate('type', `Unsupported type: ${this.type}`);
    return next();
  }

  if (!rule.allowedCategories.includes(this.category)) {
    this.invalidate('category', `Category ${this.category} is not allowed for type ${this.type}`);
  }

  if (!rule.allowedPricingModes.includes(this.pricing.mode)) {
    this.invalidate('pricing.mode', `Pricing mode ${this.pricing.mode} is not allowed for type ${this.type}`);
  }

  if (rule.providerRequired && !this.provider?.trim()) {
    this.invalidate('provider', `provider is required for type ${this.type}`);
  }

  if (!validatePricingModeBlocks(this.pricing)) {
    this.invalidate('pricing', `pricing.mode ${this.pricing.mode} requires ${PRICING_MODE_REQUIRED_BLOCKS[this.pricing.mode].join(', ')}`);
  }

  if (this.pricing.mode !== 'PER_PAX_RANGE' && hasArrayItems(this.pricing.ranges)) {
    this.invalidate('pricing.ranges', 'pricing.ranges is only valid for mode PER_PAX_RANGE');
  }

  if (this.pricing.mode !== 'PER_ROOM' && hasArrayItems(this.pricing.rooms)) {
    this.invalidate('pricing.rooms', 'pricing.rooms is only valid for mode PER_ROOM');
  }

  if (this.pricing.mode !== 'PER_SEASON' && hasArrayItems(this.pricing.seasons)) {
    this.invalidate('pricing.seasons', 'pricing.seasons is only valid for mode PER_SEASON');
  }

  if (this.pricing.mode !== 'CUSTOM' && this.pricing.custom) {
    this.invalidate('pricing.custom', 'pricing.custom is only valid for mode CUSTOM');
  }

  if (!['TRANSPORT', 'OPERATOR_SERVICE'].includes(this.type) && hasArrayItems(this.pricing.vehicleRates)) {
    this.invalidate('pricing.vehicleRates', 'pricing.vehicleRates is only valid for TRANSPORT and OPERATOR_SERVICE');
  }

  next();
});

module.exports = mongoose.models.TariffItemV2 || mongoose.model('TariffItemV2', TariffItemV2Schema);
