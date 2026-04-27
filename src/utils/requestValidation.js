const { createHttpError } = require('./httpError');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidObjectId(value) {
  if (typeof value !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value.trim());
}

function canParseDate(value) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildIssue(field, message, received) {
  return {
    field,
    message,
    ...(received !== undefined ? { received } : {}),
  };
}

function createValidator({ message = 'Request validation failed', errorCode = 'VALIDATION_ERROR' } = {}) {
  const issues = [];

  function addIssue(field, fieldMessage, received) {
    issues.push(buildIssue(field, fieldMessage, received));
  }

  return {
    addIssue,
    requirePlainObject(field, value) {
      if (!isPlainObject(value)) {
        addIssue(field, `${field} must be an object`, value);
      }
    },
    requireNonEmptyString(field, value) {
      if (typeof value !== 'string' || !value.trim()) {
        addIssue(field, `${field} is required`, value);
      }
    },
    optionalString(field, value, options = {}) {
      const { allowEmpty = true, allowNull = false } = options;
      if (value === undefined) return;
      if (value === null && allowNull) return;
      if (typeof value !== 'string') {
        addIssue(field, `${field} must be a string`, value);
        return;
      }
      if (!allowEmpty && !value.trim()) {
        addIssue(field, `${field} must not be empty`, value);
      }
    },
    optionalEmail(field, value, options = {}) {
      const { allowEmpty = true } = options;
      if (value === undefined || value === null) return;
      if (typeof value !== 'string') {
        addIssue(field, `${field} must be a string`, value);
        return;
      }
      if (!value.trim()) {
        if (!allowEmpty) {
          addIssue(field, `${field} must not be empty`, value);
        }
        return;
      }
      if (!isEmail(value)) {
        addIssue(field, `${field} must be a valid email`, value);
      }
    },
    optionalEnum(field, value, allowedValues, options = {}) {
      const { allowNull = false, allowEmpty = false } = options;
      if (value === undefined) return;
      if (value === null && allowNull) return;
      if (value === '' && allowEmpty) return;
      if (typeof value !== 'string') {
        addIssue(field, `${field} must be a string`, value);
        return;
      }
      if (!allowedValues.includes(value)) {
        addIssue(field, `${field} must be one of: ${allowedValues.join(', ')}`, value);
      }
    },
    optionalNumber(field, value, options = {}) {
      const {
        allowNull = false,
        min = null,
        max = null,
        integer = false,
      } = options;

      if (value === undefined) return;
      if (value === null && allowNull) return;
      if (!isFiniteNumber(value)) {
        addIssue(field, `${field} must be a number`, value);
        return;
      }
      if (integer && !Number.isInteger(value)) {
        addIssue(field, `${field} must be an integer`, value);
      }
      if (min !== null && value < min) {
        addIssue(field, `${field} must be greater than or equal to ${min}`, value);
      }
      if (max !== null && value > max) {
        addIssue(field, `${field} must be less than or equal to ${max}`, value);
      }
    },
    requireBoolean(field, value) {
      if (typeof value !== 'boolean') {
        addIssue(field, `${field} must be a boolean`, value);
      }
    },
    optionalBoolean(field, value) {
      if (value === undefined) return;
      if (typeof value !== 'boolean') {
        addIssue(field, `${field} must be a boolean`, value);
      }
    },
    optionalArray(field, value) {
      if (value === undefined) return;
      if (!Array.isArray(value)) {
        addIssue(field, `${field} must be an array`, value);
      }
    },
    optionalStringArray(field, value, options = {}) {
      const { allowEmptyItems = false } = options;
      if (value === undefined) return;
      if (!Array.isArray(value)) {
        addIssue(field, `${field} must be an array`, value);
        return;
      }
      value.forEach((item, index) => {
        if (typeof item !== 'string') {
          addIssue(`${field}[${index}]`, `${field}[${index}] must be a string`, item);
          return;
        }
        if (!allowEmptyItems && !item.trim()) {
          addIssue(`${field}[${index}]`, `${field}[${index}] must not be empty`, item);
        }
      });
    },
    optionalNumberArray(field, value, options = {}) {
      const { min = null } = options;
      if (value === undefined) return;
      if (!Array.isArray(value)) {
        addIssue(field, `${field} must be an array`, value);
        return;
      }
      value.forEach((item, index) => {
        if (!isFiniteNumber(item)) {
          addIssue(`${field}[${index}]`, `${field}[${index}] must be a number`, item);
          return;
        }
        if (min !== null && item < min) {
          addIssue(`${field}[${index}]`, `${field}[${index}] must be greater than or equal to ${min}`, item);
        }
      });
    },
    optionalObject(field, value, options = {}) {
      const { allowNull = false } = options;
      if (value === undefined) return;
      if (value === null && allowNull) return;
      if (!isPlainObject(value)) {
        addIssue(field, `${field} must be an object`, value);
      }
    },
    optionalObjectId(field, value, options = {}) {
      const { allowNull = false, allowEmpty = false } = options;
      if (value === undefined) return;
      if (value === null && allowNull) return;
      if (value === '' && allowEmpty) return;
      if (!isValidObjectId(value)) {
        addIssue(field, `${field} must be a valid id`, value);
      }
    },
    optionalObjectIdArray(field, value) {
      if (value === undefined) return;
      if (!Array.isArray(value)) {
        addIssue(field, `${field} must be an array`, value);
        return;
      }
      value.forEach((item, index) => {
        if (!isValidObjectId(item)) {
          addIssue(`${field}[${index}]`, `${field}[${index}] must be a valid id`, item);
        }
      });
    },
    optionalDate(field, value, options = {}) {
      const { allowNull = false, allowEmpty = false } = options;
      if (value === undefined) return;
      if (value === null && allowNull) return;
      if (value === '' && allowEmpty) return;
      if (!canParseDate(value)) {
        addIssue(field, `${field} must be a valid date`, value);
      }
    },
    optionalTime(field, value, options = {}) {
      const { allowEmpty = true } = options;
      if (value === undefined) return;
      if (value === '') {
        if (!allowEmpty) {
          addIssue(field, `${field} must not be empty`, value);
        }
        return;
      }
      if (!isValidTime(value)) {
        addIssue(field, `${field} must be a valid time in HH:mm format`, value);
      }
    },
    requireAtLeastOne(fields, source) {
      const hasValue = fields.some((field) => {
        const value = source?.[field];
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return !!value.trim();
        return true;
      });

      if (!hasValue) {
        issues.push({
          field: fields.join(','),
          message: `At least one of these fields is required: ${fields.join(', ')}`,
        });
      }
    },
    assert() {
      if (issues.length) {
        throw createHttpError(400, message, errorCode, issues);
      }
    },
  };
}

module.exports = {
  createValidator,
  isPlainObject,
  isValidObjectId,
};
