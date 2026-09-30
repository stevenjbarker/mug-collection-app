import { randomBytes } from 'node:crypto';
import { requireAuth, json } from './_lib/auth.js';
import { putPhoto, getPhoto, deletePhoto } from './_lib/store.js';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel functions accept up to 4.5MB bodies
const PATH_RE = /^photos\/(mug|display)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function photoPath(request) {
  const p = new URL(request.url).searchParams.get('p') || '';
  return PATH_RE.test(p) ? p : null;
}

export const GET = requireAuth(async (request) => {
  const p = photoPath(request);
  if (!p) return json({ error: 'bad path' }, 400);
  const photo = await getPhoto(p);
  if (!photo) return json({ error: 'not found' }, 404);
  return new Response(photo.body, {
    headers: {
      'content-type': photo.contentType,
      // Each upload gets a new random name, so a photo never changes.
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
});

export const POST = requireAuth(async (request) => {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') === 'display' ? 'display' : 'mug';
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXT[contentType];
  if (!ext) return json({ error: 'unsupported image type' }, 415);
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length) return json({ error: 'empty upload' }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: 'photo too large' }, 413);
  const p = `photos/${kind}/${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
  await putPhoto(p, bytes, contentType);
  return json({ path: p });
});

export const DELETE = requireAuth(async (request) => {
  const p = photoPath(request);
  if (!p) return json({ error: 'bad path' }, 400);
  await deletePhoto(p);
  return json({ ok: true });
});
