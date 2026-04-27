const jwt = require('jsonwebtoken');
require('dotenv').config();

const { normalizePermissions } = require('../security/permissions');
const { isAdminRole } = require('../security/access-policies');
const { createHttpError, sendError } = require('../utils/httpError');

function extractBearerToken(req) {
  const header = req.headers['authorization'] || req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const parts = header.trim().split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] || null;
}

function decodePrimaryJwt(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function decodeItinerarySessionJwt(token) {
  const sessionSecret = process.env.ITINERARY_SESSION_TOKEN_SECRET || process.env.JWT_SECRET;
  return jwt.verify(token, sessionSecret, {
    issuer: 'quoter-system',
    audience: 'itinerary-app',
  });
}

function buildUserFromSessionPayload(payload) {
  return {
    id: String(payload.sub || payload.id || ''),
    role: String(payload.role || ''),
    username: String(payload.username || ''),
    email: String(payload.email || ''),
    permissions: normalizePermissions(payload.permissions),
  };
}

function isPublicAuthRoute(req) {
  const requestPath = String(req.originalUrl || req.url || req.path || '').split('?')[0];
  return requestPath.endsWith('/auth/login') || requestPath.endsWith('/auth/signup');
}

function authenticateBridge(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return sendError(res, createHttpError(401, 'Acceso denegado, token requerido', 'AUTH_TOKEN_REQUIRED'));
  }

  try {
    const decoded = decodePrimaryJwt(token);
    decoded.permissions = normalizePermissions(decoded.permissions);
    req.user = decoded;
    req.authSource = 'primary';
    return next();
  } catch (_error) {
    // Fallback to delegated itinerary session token.
  }

  try {
    const decoded = decodeItinerarySessionJwt(token);
    if (decoded.tokenType !== 'itinerary_session') {
      return sendError(res, createHttpError(401, 'Token de acceso delegado invalido', 'AUTH_DELEGATED_TOKEN_INVALID'));
    }

    req.user = buildUserFromSessionPayload(decoded);
    req.authSource = 'itinerary-session';
    return next();
  } catch (_error) {
    return sendError(res, createHttpError(401, 'Token invalido o expirado', 'AUTH_INVALID_TOKEN'));
  }
}

function authenticateQuoterBridge(req, res, next) {
  authenticateBridge(req, res, () => {
    if (req.authSource === 'itinerary-session' && req.method !== 'GET') {
      return sendError(res, createHttpError(403, 'El token delegado solo permite lectura en quoter-v2', 'AUTH_DELEGATED_READ_ONLY'));
    }

    return next();
  });
}

function authenticateItineraryBridge(req, res, next) {
  authenticateBridge(req, res, next);
}

const authenticate = (req, res, next) => {
  if (isPublicAuthRoute(req)) {
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    return sendError(res, createHttpError(403, 'Token no proporcionado', 'AUTH_TOKEN_REQUIRED'));
  }

  try {
    const decoded = decodePrimaryJwt(token);
    decoded.permissions = normalizePermissions(decoded.permissions);
    req.user = decoded;
    return next();
  } catch (_error) {
    return sendError(res, createHttpError(401, 'Token invalido', 'AUTH_INVALID_TOKEN'));
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return sendError(res, createHttpError(401, 'Acceso denegado, token requerido', 'AUTH_TOKEN_REQUIRED'));
      }

      const decoded = decodePrimaryJwt(token);
      decoded.permissions = normalizePermissions(decoded.permissions);
      req.user = decoded;

      if (!roles.includes(req.user.role)) {
        return sendError(res, createHttpError(403, 'No tienes permiso para realizar esta accion', 'AUTH_FORBIDDEN'));
      }

      return next();
    } catch (_error) {
      return sendError(res, createHttpError(401, 'Token invalido o expirado', 'AUTH_INVALID_TOKEN'));
    }
  };
};

const authorizePermissions = (permissions = [], options = {}) => {
  const {
    requireAll = true,
    allowAdmin = true,
  } = options;

  return (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return sendError(res, createHttpError(401, 'Acceso denegado, token requerido', 'AUTH_TOKEN_REQUIRED'));
      }

      const decoded = decodePrimaryJwt(token);
      decoded.permissions = normalizePermissions(decoded.permissions);
      req.user = decoded;

      if (allowAdmin && isAdminRole(req.user.role)) {
        return next();
      }

      const requiredPermissions = normalizePermissions(permissions);
      if (!requiredPermissions.length) {
        return next();
      }

      const userPermissions = req.user.permissions || [];
      const isAuthorized = requireAll
        ? requiredPermissions.every((permission) => userPermissions.includes(permission))
        : requiredPermissions.some((permission) => userPermissions.includes(permission));

      if (!isAuthorized) {
        return sendError(res, createHttpError(403, 'No tienes permisos para realizar esta accion', 'AUTH_FORBIDDEN'));
      }

      return next();
    } catch (_error) {
      return sendError(res, createHttpError(401, 'Token invalido o expirado', 'AUTH_INVALID_TOKEN'));
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  authorizePermissions,
  authenticateQuoterBridge,
  authenticateItineraryBridge,
};


