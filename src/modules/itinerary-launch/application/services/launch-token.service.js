const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const launchNonceStore = new Map();

function getEnvNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getSecret(name, fallbackName) {
  return process.env[name] || process.env[fallbackName] || '';
}

function normalizePermissions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function buildUserSnapshot(payload = {}) {
  return {
    id: String(payload.id || payload.sub || ''),
    role: String(payload.role || ''),
    username: String(payload.username || ''),
    email: String(payload.email || ''),
    permissions: normalizePermissions(payload.permissions),
  };
}

function pruneExpiredNonces(nowSeconds) {
  for (const [nonce, record] of launchNonceStore.entries()) {
    if (!record || record.expiresAt <= nowSeconds) {
      launchNonceStore.delete(nonce);
    }
  }
}

class LaunchTokenService {
  issueLaunchToken({ user, quoterId = null }) {
    const launchSecret = getSecret('ITINERARY_LAUNCH_TOKEN_SECRET', 'JWT_SECRET');
    if (!launchSecret) {
      const err = new Error('Launch token secret is not configured');
      err.status = 500;
      throw err;
    }

    const launchTtlSeconds = getEnvNumber('ITINERARY_LAUNCH_TTL_SECONDS', 120);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();

    pruneExpiredNonces(nowSeconds);

    launchNonceStore.set(nonce, {
      nonce,
      used: false,
      issuedAt: nowSeconds,
      expiresAt: nowSeconds + launchTtlSeconds,
      userId: String(user.id || ''),
      quoterId: quoterId ? String(quoterId) : null,
    });

    const payload = {
      tokenType: 'itinerary_launch',
      sub: String(user.id || ''),
      role: String(user.role || ''),
      username: String(user.username || ''),
      email: String(user.email || ''),
      permissions: normalizePermissions(user.permissions),
      quoterId: quoterId ? String(quoterId) : null,
      nonce,
      issuedAt: nowSeconds,
    };

    const token = jwt.sign(payload, launchSecret, {
      expiresIn: launchTtlSeconds,
      issuer: 'quoter-system',
      audience: 'itinerary-launch',
    });

    return {
      launchToken: token,
      expiresIn: launchTtlSeconds,
      nonce,
    };
  }

  consumeLaunchToken(launchToken) {
    const launchSecret = getSecret('ITINERARY_LAUNCH_TOKEN_SECRET', 'JWT_SECRET');
    const sessionSecret = getSecret('ITINERARY_SESSION_TOKEN_SECRET', 'JWT_SECRET');

    if (!launchSecret || !sessionSecret) {
      const err = new Error('Launch/session token secret is not configured');
      err.status = 500;
      throw err;
    }

    let decoded;
    try {
      decoded = jwt.verify(launchToken, launchSecret, {
        issuer: 'quoter-system',
        audience: 'itinerary-launch',
      });
    } catch (_error) {
      const err = new Error('Launch token invalid or expired');
      err.status = 401;
      throw err;
    }

    if (decoded.tokenType !== 'itinerary_launch' || !decoded.nonce) {
      const err = new Error('Launch token format is invalid');
      err.status = 401;
      throw err;
    }

    const nonce = String(decoded.nonce);
    const nowSeconds = Math.floor(Date.now() / 1000);
    pruneExpiredNonces(nowSeconds);

    const nonceRecord = launchNonceStore.get(nonce);
    if (!nonceRecord) {
      const err = new Error('Launch token is no longer available');
      err.status = 401;
      throw err;
    }

    if (nonceRecord.used) {
      const err = new Error('Launch token already consumed');
      err.status = 401;
      throw err;
    }

    if (nonceRecord.expiresAt <= nowSeconds) {
      launchNonceStore.delete(nonce);
      const err = new Error('Launch token expired');
      err.status = 401;
      throw err;
    }

    nonceRecord.used = true;
    nonceRecord.usedAt = nowSeconds;
    launchNonceStore.set(nonce, nonceRecord);

    const sessionTtlSeconds = getEnvNumber('ITINERARY_SESSION_TTL_SECONDS', 3600);
    const sessionPayload = {
      tokenType: 'itinerary_session',
      sub: String(decoded.sub || ''),
      role: String(decoded.role || ''),
      username: String(decoded.username || ''),
      email: String(decoded.email || ''),
      permissions: normalizePermissions(decoded.permissions),
      source: 'launch',
      scopes: ['itinerary:access', 'quoter:read'],
      launchNonce: nonce,
    };

    const sessionToken = jwt.sign(sessionPayload, sessionSecret, {
      expiresIn: sessionTtlSeconds,
      issuer: 'quoter-system',
      audience: 'itinerary-app',
    });

    return {
      sessionToken,
      sessionExpiresIn: sessionTtlSeconds,
      user: buildUserSnapshot(sessionPayload),
      quoterId: decoded.quoterId ? String(decoded.quoterId) : null,
    };
  }
}

module.exports = new LaunchTokenService();
