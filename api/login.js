import { checkPasscode, isAuthed, sessionCookie, json } from './_lib/auth.js';

export async function GET(request) {
  return json({ authed: isAuthed(request) });
}

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    if (!checkPasscode(body.passcode)) {
      // Slow down guessing.
      await new Promise((r) => setTimeout(r, 800));
      return json({ error: 'wrong passcode' }, 401);
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request) });
}
