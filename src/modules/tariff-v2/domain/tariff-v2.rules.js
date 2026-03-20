const { PRICING_MODES } = require('./tariff-v2.types');

const TARIFF_TYPE_RULES = {
  HOTEL: {
    allowedCategories: ['ACCOMMODATION'],
    allowedPricingModes: ['PER_ROOM'],
  },
  ENTRANCE: {
    allowedCategories: ['ENTRANCE'],
    allowedPricingModes: ['PER_PERSON', 'PER_GROUP'],
  },
  EXPEDITION: {
    allowedCategories: ['ACTIVITY'],
    allowedPricingModes: ['PER_PERSON', 'PER_GROUP'],
  },
  EXPERIENCE: {
    allowedCategories: ['ACTIVITY'],
    allowedPricingModes: ['PER_PAX_RANGE', 'PER_PERSON', 'PER_GROUP'],
  },
  EXTRA: {
    allowedCategories: ['EXTRA'],
    allowedPricingModes: ['PER_PERSON', 'PER_GROUP'],
  },
  GUIDE: {
    allowedCategories: ['GUIDE'],
    allowedPricingModes: ['PER_GROUP', 'PER_PERSON'],
  },
  RESTAURANT: {
    allowedCategories: ['MEAL'],
    allowedPricingModes: ['PER_PERSON', 'PER_GROUP'],
  },
  TRAIN: {
    allowedCategories: ['TRAIN'],
    allowedPricingModes: ['PER_SEASON'],
  },
  TRANSPORT: {
    allowedCategories: ['TRANSFER'],
    allowedPricingModes: ['CUSTOM', 'PER_PAX_RANGE'],
  },
  OPERATOR_SERVICE: {
    allowedCategories: ['GROUND_OPERATOR', 'TRANSFER', 'ACTIVITY'],
    allowedPricingModes: ['CUSTOM', 'PER_PAX_RANGE'],
  },
  PROVIDER_ACTIVITY: {
    allowedCategories: ['ACTIVITY', 'MEAL'],
    allowedPricingModes: ['PER_PERSON', 'PER_GROUP'],
    providerRequired: true,
  },
};

const PRICING_MODE_REQUIRED_BLOCKS = {
  PER_PERSON: ['basePrice'],
  PER_GROUP: ['basePrice'],
  PER_PAX_RANGE: ['ranges'],
  PER_ROOM: ['rooms'],
  PER_SEASON: ['seasons'],
  CUSTOM: ['custom'],
};

module.exports = {
  TARIFF_TYPE_RULES,
  PRICING_MODE_REQUIRED_BLOCKS,
};
