const Boom = require('@hapi/boom');

const DEFAULT_ERROR_MESSAGE = 'Error interno del servidor';
const DEFAULT_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function buildEnvelope({ message, errorCode, details }) {
  const response = {
    message: message || DEFAULT_ERROR_MESSAGE,
    errorCode: errorCode || DEFAULT_ERROR_CODE,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

function createHttpError(status, message, errorCode, details) {
  const error = new Error(message || DEFAULT_ERROR_MESSAGE);
  error.status = status || 500;
  error.errorCode = errorCode || DEFAULT_ERROR_CODE;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

function normalizeValidationDetails(error) {
  if (!error?.errors || !isPlainObject(error.errors)) {
    return undefined;
  }

  return Object.values(error.errors).map((issue) => ({
    field: issue.path,
    message: issue.message,
    kind: issue.kind,
    value: issue.value,
  }));
}

function normalizeDuplicateKeyDetails(error) {
  if (!error?.keyValue || !isPlainObject(error.keyValue)) {
    return undefined;
  }

  return {
    fields: Object.keys(error.keyValue),
    values: error.keyValue,
  };
}

function normalizeBoomError(error) {
  const status = error.output?.statusCode || 500;
  const payload = error.output?.payload || {};
  const message = error.data?.message || payload.message || error.message || DEFAULT_ERROR_MESSAGE;
  const errorCode = error.data?.errorCode || payload.error || 'BOOM_ERROR';
  const details = error.data?.details;

  return {
    status,
    message,
    errorCode,
    details,
  };
}

function normalizeError(error, fallback = {}) {
  if (Boom.isBoom(error)) {
    return normalizeBoomError(error);
  }

  if (error?.status || error?.statusCode || error?.errorCode || error?.details !== undefined) {
    return {
      status: error.status || error.statusCode || fallback.status || 500,
      message: error.message || fallback.message || DEFAULT_ERROR_MESSAGE,
      errorCode: error.errorCode || fallback.errorCode || DEFAULT_ERROR_CODE,
      details: error.details,
    };
  }

  if (error?.name === 'ValidationError') {
    return {
      status: 400,
      message: fallback.message || 'La solicitud no superó la validación',
      errorCode: fallback.errorCode || 'VALIDATION_ERROR',
      details: normalizeValidationDetails(error),
    };
  }

  if (error?.name === 'CastError') {
    return {
      status: 400,
      message: fallback.message || `${error.path || 'resource'} is invalid`,
      errorCode: fallback.errorCode || 'INVALID_REFERENCE',
      details: {
        field: error.path,
        value: error.value,
      },
    };
  }

  if (error?.code === 11000) {
    return {
      status: 409,
      message: fallback.message || 'Ya existe un recurso con esos datos',
      errorCode: fallback.errorCode || 'DUPLICATE_RESOURCE',
      details: normalizeDuplicateKeyDetails(error),
    };
  }

  return {
    status: fallback.status || 500,
    message: fallback.message || DEFAULT_ERROR_MESSAGE,
    errorCode: fallback.errorCode || DEFAULT_ERROR_CODE,
    details: fallback.details,
  };
}

function sendError(res, error, fallback = {}) {
  const normalized = normalizeError(error, fallback);
  return res.status(normalized.status).json(buildEnvelope(normalized));
}

module.exports = {
  DEFAULT_ERROR_CODE,
  DEFAULT_ERROR_MESSAGE,
  buildEnvelope,
  createHttpError,
  normalizeError,
  sendError,
};
