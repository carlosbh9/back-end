const jwt = require('jsonwebtoken');
//import jwt from 'jsonwebtoken';
//const JWT_SECRET = 'secretKey'; // Usa una variable de entorno
require('dotenv').config()
const { normalizePermissions } = require('../security/permissions');
const { isAdminRole } = require('../security/access-policies');

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

function authenticateBridge(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado, token requerido' });
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
      return res.status(401).json({ error: 'Token de acceso delegado inválido' });
    }

    req.user = buildUserFromSessionPayload(decoded);
    req.authSource = 'itinerary-session';
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function authenticateQuoterBridge(req, res, next) {
  authenticateBridge(req, res, () => {
    if (req.authSource === 'itinerary-session' && req.method !== 'GET') {
      return res.status(403).json({ error: 'El token delegado solo permite lectura en quoter-v2' });
    }

    return next();
  });
}

function authenticateItineraryBridge(req, res, next) {
  authenticateBridge(req, res, next);
}


const authenticate = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return res.status(403).json({ error: 'Token no proporcionado' });

  try {
    const decoded = decodePrimaryJwt(token);
    decoded.permissions = normalizePermissions(decoded.permissions);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const authorize = (roles = []) => {
    return (req, res, next) => {
      try {
          const token = extractBearerToken(req);
          if (!token) return res.status(401).json({ error: 'Acceso denegado, token requerido' });

          const decoded = decodePrimaryJwt(token);
          decoded.permissions = normalizePermissions(decoded.permissions);
          req.user = decoded;

          if (!roles.includes(req.user.role)) {
              return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
          }

          next();
      } catch (error) {
          res.status(401).json({ error: 'Token inválido o expirado' });
      }
  };
  };

const authorizePermissions = (permissions = [], options = {}) => {
  const {
    requireAll = true,
    allowAdmin = true
  } = options;

  return (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) return res.status(401).json({ error: 'Acceso denegado, token requerido' });

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
        return res.status(403).json({ error: 'No tienes permisos para realizar esta accion' });
      }

      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Token invÃ¡lido o expirado' });
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
//export { authenticate, authorize };
