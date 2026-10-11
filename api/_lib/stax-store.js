// Storage for Stax game rooms. Live games need fast, frequent reads and
// writes, so this uses Upstash Redis (Vercel Marketplace → Upstash Redis)
// instead of Blob. Without Redis settings (local dev) it keeps rooms in memory.
//
// Keys:  stax:r:<CODE>  room JSON           stax:p:<CODE>  hash of playerId → player JSON
// Writes are compare-and-set against the JSON last read, so two requests
// can't overwrite each other.

export class ConflictError extends Error {}

const TTL = 60 * 60 * 24 * 2; // rooms disappear two days after their last change

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_MEMORY = !REST_URL || !REST_TOKEN;

if (USE_MEMORY && process.env.VERCEL) {
  console.warn('Stax: no Redis configured; rooms are kept in memory and will not survive between requests.');
}

const roomKey = (code) => `stax:r:${code}`;
const playersKey = (code) => `stax:p:${code}`;

const CAS_STRING = `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1 end return 0`;
const CAS_HASH = `if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then redis.call('HSET', KEYS[1], ARGV[1], ARGV[3]) redis.call('EXPIRE', KEYS[1], ARGV[4]) return 1 end return 0`;

async function redis(...cmd) {
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`redis: ${body.error || res.status}`);
  return body.result;
}

// ---------- in-memory stand-in ----------
const mem = globalThis.__staxMem || (globalThis.__staxMem = { rooms: new Map(), players: new Map() });

// ---------- rooms ----------

export async function getRoom(code) {
  const raw = USE_MEMORY ? mem.rooms.get(code) ?? null : await redis('GET', roomKey(code));
  return raw ? { room: JSON.parse(raw), raw } : null;
}

// Returns false if the code is already taken.
export async function createRoom(code, room) {
  const raw = JSON.stringify(room);
  if (USE_MEMORY) {
    if (mem.rooms.has(code)) return false;
    mem.rooms.set(code, raw);
    mem.players.set(code, new Map());
    return true;
  }
  return (await redis('SET', roomKey(code), raw, 'NX', 'EX', TTL)) === 'OK';
}

export async function saveRoom(code, oldRaw, room) {
  const raw = JSON.stringify(room);
  if (USE_MEMORY) {
    if (mem.rooms.get(code) !== oldRaw) throw new ConflictError();
    mem.rooms.set(code, raw);
  } else if ((await redis('EVAL', CAS_STRING, 1, roomKey(code), oldRaw, raw, TTL)) !== 1) {
    throw new ConflictError();
  }
  return raw;
}

// ---------- players ----------

export async function getPlayers(code) {
  let entries;
  if (USE_MEMORY) {
    entries = [...(mem.players.get(code) || new Map()).entries()];
  } else {
    const flat = (await redis('HGETALL', playersKey(code))) || [];
    entries = [];
    for (let i = 0; i < flat.length; i += 2) entries.push([flat[i], flat[i + 1]]);
  }
  return entries.map(([id, raw]) => ({ id, raw, player: JSON.parse(raw) }));
}

export async function getPlayer(code, id) {
  const raw = USE_MEMORY ? mem.players.get(code)?.get(id) ?? null : await redis('HGET', playersKey(code), id);
  return raw ? { player: JSON.parse(raw), raw } : null;
}

export async function addPlayer(code, player) {
  const raw = JSON.stringify(player);
  if (USE_MEMORY) {
    mem.players.get(code).set(player.id, raw);
    return;
  }
  await redis('HSET', playersKey(code), player.id, raw);
  await redis('EXPIRE', playersKey(code), TTL);
}

export async function savePlayer(code, oldRaw, player) {
  const raw = JSON.stringify(player);
  if (USE_MEMORY) {
    const map = mem.players.get(code);
    if (map.get(player.id) !== oldRaw) throw new ConflictError();
    map.set(player.id, raw);
  } else if ((await redis('EVAL', CAS_HASH, 1, playersKey(code), player.id, oldRaw, raw, TTL)) !== 1) {
    throw new ConflictError();
  }
  return raw;
}

export async function removePlayer(code, id) {
  if (USE_MEMORY) mem.players.get(code)?.delete(id);
  else await redis('HDEL', playersKey(code), id);
}

export const storageMode = USE_MEMORY ? 'memory' : 'redis';
