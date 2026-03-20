/**
 * @typedef {'HOTEL'|'ENTRANCE'|'EXPEDITION'|'EXPERIENCE'|'EXTRA'|'GUIDE'|'RESTAURANT'|'TRAIN'|'TRANSPORT'|'OPERATOR_SERVICE'|'PROVIDER_ACTIVITY'} TariffItemType
 * @typedef {'ACCOMMODATION'|'TRANSFER'|'ACTIVITY'|'MEAL'|'TRAIN'|'GUIDE'|'ENTRANCE'|'EXTRA'|'GROUND_OPERATOR'|'OTHER'} ProductCategory
 * @typedef {'PER_PERSON'|'PER_GROUP'|'PER_PAX_RANGE'|'PER_ROOM'|'PER_SEASON'|'CUSTOM'} PricingMode
 * @typedef {'SWB'|'DWB'|'TRP'} OccupancyType
 * @typedef {'High'|'Low'|'Regular'} SeasonType
 * @typedef {'FIXED'|'PER_PERSON'|'DISCOUNT_PERCENT'} ChildPriceType
 * @typedef {'ADD'|'REPLACE'|'CLOSE'} SpecialDateOperation
 * @typedef {'Camioneta'|'Van'|'Sprinter'|'MiniBus'|'Bus'|'Sin especificar'} VehicleType
 * @typedef {'ACTIVE'|'INACTIVE'|'DRAFT'} TariffStatus
 */

const TARIFF_ITEM_TYPES = [
  'HOTEL',
  'ENTRANCE',
  'EXPEDITION',
  'EXPERIENCE',
  'EXTRA',
  'GUIDE',
  'RESTAURANT',
  'TRAIN',
  'TRANSPORT',
  'OPERATOR_SERVICE',
  'PROVIDER_ACTIVITY',
];

const PRODUCT_CATEGORIES = [
  'ACCOMMODATION',
  'TRANSFER',
  'ACTIVITY',
  'MEAL',
  'TRAIN',
  'GUIDE',
  'ENTRANCE',
  'EXTRA',
  'GROUND_OPERATOR',
  'OTHER',
];

const PRICING_MODES = [
  'PER_PERSON',
  'PER_GROUP',
  'PER_PAX_RANGE',
  'PER_ROOM',
  'PER_SEASON',
  'CUSTOM',
];

const OCCUPANCY_TYPES = ['SWB', 'DWB', 'TRP'];
const SEASON_TYPES = ['High', 'Low', 'Regular'];
const CHILD_PRICE_TYPES = ['FIXED', 'PER_PERSON', 'DISCOUNT_PERCENT'];
const SPECIAL_DATE_OPERATIONS = ['ADD', 'REPLACE', 'CLOSE'];
const VEHICLE_TYPES = ['Camioneta', 'Van', 'Sprinter', 'MiniBus', 'Bus', 'Sin especificar'];
const TARIFF_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'];

module.exports = {
  TARIFF_ITEM_TYPES,
  PRODUCT_CATEGORIES,
  PRICING_MODES,
  OCCUPANCY_TYPES,
  SEASON_TYPES,
  CHILD_PRICE_TYPES,
  SPECIAL_DATE_OPERATIONS,
  VEHICLE_TYPES,
  TARIFF_STATUSES,
};
