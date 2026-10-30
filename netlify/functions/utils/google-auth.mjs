import crypto from 'node:crypto';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function getEnv(key) {
  if (typeof Netlify !== 'undefined' && Netlify.env?.get(key)) {
    return Netlify.env.get(key);
  }
  return process.env[key];
}

export function isSheetsConfigured() {
  const spreadsheetId = getEnv('SPREADSHEET_ID');
  const hasJson = Boolean(getEnv('GOOGLE_CREDENTIALS_JSON'));
  const hasEmailAndKey = Boolean(
    getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL') && getEnv('GOOGLE_PRIVATE_KEY')
  );
  return Boolean(spreadsheetId && (hasJson || hasEmailAndKey));
}

function getServiceAccountCredentials() {
  const rawJson = getEnv('GOOGLE_CREDENTIALS_JSON');
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  const clientEmail = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const rawKey = getEnv('GOOGLE_PRIVATE_KEY') || '';
  const privateKey = rawKey.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google Service Account credentials.');
  }

  return { clientEmail, privateKey };
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export async function getAccessToken() {
  const { clientEmail, privateKey } = getServiceAccountCredentials();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: SCOPES,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedJwt = `${encodedHeader}.${encodedClaims}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(privateKey);
  const jwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth token error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}
