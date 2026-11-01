import crypto from 'node:crypto';
import { getEnv } from './google-auth.mjs';

export { getEnv };

function getAdminSecret() {
  const secret = getEnv('ADMIN_SESSION_SECRET') || getEnv('ADMIN_PASSWORD');
  if (!secret) {
    throw new Error('ADMIN_PASSWORD or ADMIN_SESSION_SECRET must be configured.');
  }
  return secret;
}

export function isAuthConfigured() {
  return Boolean(getEnv('ADMIN_PASSWORD'));
}

export function verifyAdminPassword(inputPassword) {
  const master = getEnv('ADMIN_PASSWORD');
  if (!master || typeof inputPassword !== 'string') {
    return false;
  }

  const inputBuffer = Buffer.from(inputPassword);
  const masterBuffer = Buffer.from(master);

  if (inputBuffer.length !== masterBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, masterBuffer);
}

export function createSessionToken() {
  const secret = getAdminSecret();
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Missing token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Malformed token' };
  }

  const [payloadB64, signature] = parts;

  try {
    const secret = getAdminSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

export function extractBearerToken(req) {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }

  return null;
}

/**
 * Returns null if authorized, or a 401 Response if unauthorized.
 */
export function requireAdminAuth(req) {
  if (!isAuthConfigured()) {
    return Response.json(
      { error: 'Admin authentication is not configured in environment variables.' },
      { status: 503 }
    );
  }

  const token = extractBearerToken(req);
  const result = verifySessionToken(token);

  if (!result.valid) {
    return Response.json(
      { error: 'Unauthorized: Invalid or expired admin session.', reason: result.reason },
      { status: 401 }
    );
  }

  return null;
}
