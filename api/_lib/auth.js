import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'mug_session';
const ONE_YEAR = 60 * 60 * 24 * 365;

function passcode() {
  const p = process.env.APP_PASSCODE;
  if (!p) throw new Error('APP_PASSCODE is not set');
  return p;
}

// The session token is derived from the passcode, so changing APP_PASSCODE
// signs every device out.
function sessionToken() {
  return createHmac('sha256', passcode()).update('mug-collection-session-v1').digest('hex');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPasscode(attempt) {
  return safeEqual(attempt || '', passcode());
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function isAuthed(request) {
  const token = readCookie(request, COOKIE);
  return !!token && safeEqual(token, sessionToken());
}

export function sessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR}${secure}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

// Wraps a handler so it only runs for signed-in devices.
export function requireAuth(handler) {
  return async (request) => {
    try {
      if (!isAuthed(request)) return json({ error: 'unauthorized' }, 401);
      return await handler(request);
    } catch (err) {
      console.error(err);
      return json({ error: err.message || 'server error' }, 500);
    }
  };
}
