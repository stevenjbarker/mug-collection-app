import { requireAuth, json } from './_lib/auth.js';
import { readJson, writeJson, ConflictError, COLLECTION_PATH } from './_lib/store.js';

export const GET = requireAuth(async () => {
  const doc = await readJson(COLLECTION_PATH);
  if (!doc) return json({ exists: false });
  return json({ exists: true, data: doc.data, etag: doc.etag });
});

export const PUT = requireAuth(async (request) => {
  const { data, etag } = await request.json();
  if (!data || !Array.isArray(data.mugs) || !Array.isArray(data.displayPhotos)) {
    return json({ error: 'invalid collection' }, 400);
  }
  try {
    // No etag means "create"; that fails if a collection already exists.
    const res = await writeJson(COLLECTION_PATH, data, etag || null);
    return json({ etag: res.etag });
  } catch (err) {
    if (!(err instanceof ConflictError)) throw err;
    // Another device saved first: hand back the latest so the client can reload.
    const doc = await readJson(COLLECTION_PATH);
    return json({ error: 'conflict', data: doc?.data, etag: doc?.etag }, 409);
  }
});
