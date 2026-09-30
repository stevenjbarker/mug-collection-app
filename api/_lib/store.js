// Storage for the collection JSON and photos.
// On Vercel this is a private Vercel Blob store; locally (no token) it falls
// back to files under .data/ so the app can be run and tested offline.
import { put, get, head, del, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export class ConflictError extends Error {}

export const COLLECTION_PATH = 'data/collection.json';

const USE_FS = !process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN;
const FS_ROOT = path.join(process.cwd(), '.data');

function fsPath(p) {
  const full = path.join(FS_ROOT, p);
  if (!full.startsWith(FS_ROOT + path.sep)) throw new Error('bad path');
  return full;
}
const etagOf = (buf) => createHash('sha1').update(buf).digest('hex');

// ---------- JSON documents (with optimistic concurrency) ----------

export async function readJson(p) {
  if (USE_FS) {
    try {
      const buf = await fs.readFile(fsPath(p));
      return { data: JSON.parse(buf.toString('utf8')), etag: etagOf(buf) };
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  // The ETag header on a content read isn't in the same form put()'s ifMatch
  // compares against, so take the version from head() (same API as put).
  // head() runs first: if a write lands in between, we hold an older etag
  // with newer content, and the next save fails safely as a conflict.
  let meta;
  try {
    meta = await head(p);
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
  const r = await get(p, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const text = await new Response(r.stream).text();
  return { data: JSON.parse(text), etag: meta.etag };
}

// ifMatch: etag the caller last read, or null when creating the document.
export async function writeJson(p, data, ifMatch) {
  const text = JSON.stringify(data);
  if (USE_FS) {
    const current = await readJson(p);
    if (ifMatch ? !current || current.etag !== ifMatch : current) throw new ConflictError();
    await fs.mkdir(path.dirname(fsPath(p)), { recursive: true });
    await fs.writeFile(fsPath(p), text);
    return { etag: etagOf(Buffer.from(text)) };
  }
  if (!ifMatch && (await readJson(p))) throw new ConflictError();
  try {
    const res = await put(p, text, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      ...(ifMatch ? { ifMatch } : { allowOverwrite: false }),
    });
    return { etag: res.etag };
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError) throw new ConflictError();
    throw e;
  }
}

// ---------- Photos (immutable, one file per upload) ----------

export async function putPhoto(p, bytes, contentType) {
  if (USE_FS) {
    await fs.mkdir(path.dirname(fsPath(p)), { recursive: true });
    await fs.writeFile(fsPath(p), bytes);
    await fs.writeFile(fsPath(p) + '.type', contentType);
    return;
  }
  await put(p, bytes, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: false });
}

export async function getPhoto(p) {
  if (USE_FS) {
    try {
      const body = await fs.readFile(fsPath(p));
      const type = await fs.readFile(fsPath(p) + '.type', 'utf8').catch(() => 'image/jpeg');
      return { body, contentType: type };
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  const r = await get(p, { access: 'private' });
  if (!r || r.statusCode !== 200) return null;
  return { body: r.stream, contentType: r.blob.contentType };
}

export async function deletePhoto(p) {
  if (USE_FS) {
    await fs.rm(fsPath(p), { force: true });
    await fs.rm(fsPath(p) + '.type', { force: true });
    return;
  }
  await del(p);
}
