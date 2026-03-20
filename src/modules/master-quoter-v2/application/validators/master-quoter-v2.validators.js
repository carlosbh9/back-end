const { isValidObjectId } = require('mongoose');
const { MASTER_QUOTER_V2_STATUSES, MASTER_QUOTER_V2_TYPES, MASTER_QUOTER_V2_ITEM_PLACEMENTS } = require('../../domain/master-quoter-v2.types');

const ALLOWED_SORT_FIELDS = ['name', 'type', 'status', 'active', 'totalDays', 'createdAt', 'updatedAt'];

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
    throw createHttpError(400, `${fieldName} is invalid`, { field: fieldName, allowedValues, received: value });
  }
}

function ensureBoolean(value, fieldName) {
  if (value !== undefined && typeof value !== 'boolean') {
    throw createHttpError(400, `${fieldName} must be a boolean`, { field: fieldName });
  }
}

function ensureNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createHttpError(400, `${fieldName} is required`, { field: fieldName });
  }
}

function ensurePositiveInteger(value, fieldName, { min = 1, max = 100 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw createHttpError(400, `${fieldName} must be an integer between ${min} and ${max}`, { field: fieldName, min, max });
  }
}

function validateItems(items, pathPrefix) {
  if (!Array.isArray(items)) {
    throw createHttpError(400, `${pathPrefix} must be an array`);
  }

  items.forEach((item, index) => {
    ensureObject(item, `${pathPrefix}[${index}] must be an object`);
    ensureEnum(item.placement, MASTER_QUOTER_V2_ITEM_PLACEMENTS, `${pathPrefix}[${index}].placement`);

    if (!item.tariffItemId || !isValidObjectId(item.tariffItemId)) {
      throw createHttpError(400, `${pathPrefix}[${index}].tariffItemId is invalid`, { field: `${pathPrefix}[${index}].tariffItemId` });
    }
  });
}

function validateDays(days, totalDays) {
  if (!Array.isArray(days) || days.length === 0) {
    throw createHttpError(400, 'days must contain at least one day');
  }

  const seen = new Set();

  days.forEach((day, index) => {
    ensureObject(day, `days[${index}] must be an object`);
    ensurePositiveInteger(day.dayNumber, `days[${index}].dayNumber`, { min: 1, max: 1000 });

    if (seen.has(day.dayNumber)) {
      throw createHttpError(400, `days[${index}].dayNumber is duplicated`, { field: `days[${index}].dayNumber` });
    }
    seen.add(day.dayNumber);

    if (totalDays && day.dayNumber > totalDays) {
      throw createHttpError(400, `days[${index}].dayNumber exceeds totalDays`, { field: `days[${index}].dayNumber` });
    }

    validateItems(day.items || [], `days[${index}].items`);
  });
}

function validateCreatePayload(payload) {
  ensureObject(payload, 'payload must be an object');
  ensureNonEmptyString(payload.name, 'name');
  ensureEnum(payload.type, MASTER_QUOTER_V2_TYPES, 'type');
  ensureEnum(payload.status ?? 'DRAFT', MASTER_QUOTER_V2_STATUSES, 'status');
  ensureBoolean(payload.active, 'active');
  ensurePositiveInteger(payload.totalDays, 'totalDays', { min: 1, max: 365 });
  validateDays(payload.days, payload.totalDays);
}

function validateUpdatePayload(payload) {
  ensureObject(payload, 'payload must be an object');

  if (Object.keys(payload).length === 0) {
    throw createHttpError(400, 'payload must not be empty');
  }

  if (payload.name !== undefined) ensureNonEmptyString(payload.name, 'name');
  ensureEnum(payload.type, MASTER_QUOTER_V2_TYPES, 'type');
  ensureEnum(payload.status, MASTER_QUOTER_V2_STATUSES, 'status');
  ensureBoolean(payload.active, 'active');
  if (payload.totalDays !== undefined) ensurePositiveInteger(payload.totalDays, 'totalDays', { min: 1, max: 365 });
  if (payload.days !== undefined) validateDays(payload.days, payload.totalDays);
}

function validateAndNormalizeListQuery(query = {}) {
  ensureEnum(query.type, MASTER_QUOTER_V2_TYPES, 'type');
  ensureEnum(query.status, MASTER_QUOTER_V2_STATUSES, 'status');

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const sortBy = query.sortBy || 'updatedAt';
  const sortDir = String(query.sortDir || 'desc').toLowerCase();

  ensurePositiveInteger(page, 'page', { min: 1, max: 100000 });
  ensurePositiveInteger(limit, 'limit', { min: 1, max: 100 });

  if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
    throw createHttpError(400, 'sortBy is invalid', { field: 'sortBy', allowedValues: ALLOWED_SORT_FIELDS, received: sortBy });
  }

  if (!['asc', 'desc'].includes(sortDir)) {
    throw createHttpError(400, 'sortDir is invalid', { field: 'sortDir', allowedValues: ['asc', 'desc'], received: sortDir });
  }

  return { ...query, page, limit, sortBy, sortDir };
}

module.exports = {
  ALLOWED_SORT_FIELDS,
  createHttpError,
  validateCreatePayload,
  validateUpdatePayload,
  validateAndNormalizeListQuery,
};
