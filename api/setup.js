// First-run: loads the original 51 mugs into an empty collection.
import { randomBytes } from 'node:crypto';
import { requireAuth, json } from './_lib/auth.js';
import { readJson, writeJson, putPhoto, ConflictError, COLLECTION_PATH } from './_lib/store.js';
import { SEED_MUGS } from './_lib/seed-data.js';

export const POST = requireAuth(async () => {
  if (await readJson(COLLECTION_PATH)) return json({ error: 'collection already exists' }, 409);
  const mugs = [];
  for (const m of SEED_MUGS) {
    let photo = null;
    const match = /^data:(image\/jpeg);base64,(.+)$/.exec(m.photo || '');
    if (match) {
      photo = `photos/mug/seed-${m.id}-${randomBytes(4).toString('hex')}.jpg`;
      await putPhoto(photo, Buffer.from(match[2], 'base64'), match[1]);
    }
    mugs.push({ id: m.id, location: m.location, series: m.series, photo });
  }
  const data = { mugs, displayPhotos: [] };
  try {
    const res = await writeJson(COLLECTION_PATH, data, null);
    return json({ data, etag: res.etag });
  } catch (err) {
    if (err instanceof ConflictError) return json({ error: 'collection already exists' }, 409);
    throw err;
  }
});
