const Boom = require('@hapi/boom');
const { buildEnvelope, normalizeError } = require('../utils/httpError');

const REQUEST_ERROR_FALLBACK = {
  message: 'Error procesando la solicitud',
  errorCode: 'REQUEST_ERROR',
};

const INTERNAL_ERROR_FALLBACK = {
  message: 'Error interno del servidor',
  errorCode: 'INTERNAL_SERVER_ERROR',
};

const mostrarError = (err, req, res, next) => {
  console.error('Error detectado:', err);
  next(err);
};

const boomManejaError = (err, req, res, next) => {
  if (!Boom.isBoom(err)) {
    return next(err);
  }

  const normalized = normalizeError(err, REQUEST_ERROR_FALLBACK);
  return res.status(normalized.status).json(buildEnvelope(normalized));
};

const manejarError = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  const normalized = normalizeError(err, INTERNAL_ERROR_FALLBACK);
  return res.status(normalized.status).json(buildEnvelope(normalized));
};

module.exports = { mostrarError, boomManejaError, manejarError };
