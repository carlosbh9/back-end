const {
  PRICING_MODES,
  PRODUCT_CATEGORIES,
  TARIFF_ITEM_TYPES,
  TARIFF_STATUSES,
} = require('../../domain/tariff-v2.types');

const ALLOWED_SORT_FIELDS = [
  'name',
  'type',
  'category',
  'provider',
  'city',
  'status',
  'active',
  'createdAt',
  'updatedAt',
  'validity.year',
];

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createHttpError(400, message);
  }
}

function ensureEnum(value, allowedValues, fieldName) {
  if (value !== undefined && !allowedValues.includes(value)) {
    throw createHttpError(400, `${fieldName} is invalid`, {
      field: fieldName,
      allowedValues,
      received: value,
    });
  }
}

function ensureNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createHttpError(400, `${fieldName} is required`, { field: fieldName });
  }
}

function ensureBoolean(value, fieldName) {
  if (value !== undefined && typeof value !== 'boolean') {
    throw createHttpError(400, `${fieldName} must be a boolean`, { field: fieldName });
  }
}

function ensurePositiveInteger(value, fieldName, { min = 1, max = 100 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw createHttpError(400, `${fieldName} must be an integer between ${min} and ${max}`, { field: fieldName, min, max });
  }
}

function validatePricing(payload, isPartial = false) {
  if (payload.pricing === undefined && isPartial) return;

  ensureObject(payload.pricing, 'pricing is required');
  ensureEnum(payload.pricing.mode, PRICING_MODES, 'pricing.mode');
}

function validateValidity(payload, isPartial = false) {
  if (payload.validity === undefined && isPartial) return;

  ensureObject(payload.validity, 'validity is required');
  ensureNonEmptyString(payload.validity.year, 'validity.year');
}

function validateCreatePayload(payload) {
  ensureObject(payload, 'payload must be an object');
  ensureNonEmptyString(payload.name, 'name');
  ensureEnum(payload.type, TARIFF_ITEM_TYPES, 'type');
  ensureEnum(payload.category, PRODUCT_CATEGORIES, 'category');
  ensureEnum(payload.status ?? 'DRAFT', TARIFF_STATUSES, 'status');
  ensureBoolean(payload.active, 'active');
  validatePricing(payload, false);
  validateValidity(payload, false);
}

function validateUpdatePayload(payload) {
  ensureObject(payload, 'payload must be an object');

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, 'payload must not be empty');
  }

  if (payload.name !== undefined) ensureNonEmptyString(payload.name, 'name');
  ensureEnum(payload.type, TARIFF_ITEM_TYPES, 'type');
  ensureEnum(payload.category, PRODUCT_CATEGORIES, 'category');
  ensureEnum(payload.status, TARIFF_STATUSES, 'status');
  ensureBoolean(payload.active, 'active');
  validatePricing(payload, true);
  validateValidity(payload, true);
}

function validateAndNormalizeListQuery(query = {}) {
  ensureEnum(query.type, TARIFF_ITEM_TYPES, 'type');
  ensureEnum(query.category, PRODUCT_CATEGORIES, 'category');
  ensureEnum(query.status, TARIFF_STATUSES, 'status');

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const sortBy = query.sortBy || 'createdAt';
  const sortDir = String(query.sortDir || 'desc').toLowerCase();

  ensurePositiveInteger(page, 'page', { min: 1, max: 100000 });
  ensurePositiveInteger(limit, 'limit', { min: 1, max: 100 });

  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    throw createHttpError(400, 'sortBy is invalid', {
      field: 'sortBy',
      allowedValues: ALLOWED_SORT_FIELDS,
      received: sortBy,
    });
  }

  if (!['asc', 'desc'].includes(sortDir)) {
    throw createHttpError(400, 'sortDir is invalid', {
      field: 'sortDir',
      allowedValues: ['asc', 'desc'],
      received: sortDir,
    });
  }

  return {
    ...query,
    page,
    limit,
    sortBy,
    sortDir,
  };
}

module.exports = {
  ALLOWED_SORT_FIELDS,
  createHttpError,
  validateCreatePayload,
  validateUpdatePayload,
  validateAndNormalizeListQuery,
};
