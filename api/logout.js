import { clearCookie, json } from './_lib/auth.js';

export async function POST() {
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
