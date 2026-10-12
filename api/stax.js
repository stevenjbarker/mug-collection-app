// Stax: the multiplayer investing game at /stax.
//   GET  /api/stax?code=ABCD&player=…&token=…   (or &host=…)   live game state
//   POST /api/stax  { action: 'create', passcode? }              new room (needs the host passcode)
//   POST /api/stax  { action: 'join', code, name }               join a room
//   POST /api/stax  { action: 'trade', code, player, token, asset, side, amount }
//   POST /api/stax  { action: 'host', code, host, op, … }        start / pause / resume / end / kick
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { json } from './_lib/auth.js';
import * as store from './_lib/stax-store.js';
import * as game from './_lib/stax-engine.js';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 80;
const YEAR_SECONDS = [20, 30, 45, 60];
if (!process.env.VERCEL) YEAR_SECONDS.unshift(3); // fast games for local testing

const hash = (s) => createHash('sha256').update(String(s)).digest('hex');
function sameHash(secret, expected) {
  if (!secret || !expected) return false;
  const a = Buffer.from(hash(secret));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Hosting has its own passcode (STAX_HOST_PASSCODE), separate from the mug
// collection's. Entering it once sets a cookie so that device can keep hosting.
const HOST_COOKIE = 'stax_host';
function hostToken() {
  const p = process.env.STAX_HOST_PASSCODE;
  if (!p) throw new Error('STAX_HOST_PASSCODE is not set');
  return createHmac('sha256', p).update('stax-host-v1').digest('hex');
}
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function canHost(request, passcode) {
  if (passcode != null) return safeEqual(passcode, process.env.STAX_HOST_PASSCODE || '') && !!process.env.STAX_HOST_PASSCODE;
  const cookie = (request.headers.get('cookie') || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(HOST_COOKIE + '='));
  return !!cookie && safeEqual(decodeURIComponent(cookie.slice(HOST_COOKIE.length + 1)), hostToken());
}
function hostCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${HOST_COOKIE}=${hostToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${secure}`;
}

const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);

function handle(fn) {
  return async (request) => {
    try {
      return await fn(request);
    } catch (err) {
      if (err instanceof game.TradeError) return json({ error: err.message }, 400);
      if (err instanceof store.ConflictError) return json({ error: 'Busy — try again.' }, 409);
      console.error(err);
      return json({ error: 'Something went wrong.' }, 500);
    }
  };
}

// Rooms whose clock ran out are finished even if nobody pressed "end".
function publicRoom(room, now) {
  const month = game.gameMonth(room, now);
  const status = game.isOver(room, now) ? 'done' : room.status;
  return {
    code: room.code, status, month, monthMs: room.monthMs, yearSeconds: room.yearSeconds,
    startedAt: room.startedAt, pausedAt: room.pausedAt, pausedMs: room.pausedMs || 0,
    endedAt: room.endedAt || null, gameMonths: game.GAME_MONTHS, paycheck: game.PAYCHECK,
    gate: room.gate ? { month: room.gate.month, ready: room.gate.ready } : null,
  };
}

export const GET = handle(async (request) => {
  const q = new URL(request.url).searchParams;
  const code = cleanCode(q.get('code'));
  const t0 = performance.now();
  const { found, players } = await store.getRoomAndPlayers(code);
  const dbMs = performance.now() - t0;
  if (!found) return json({ error: 'No game with that code.' }, 404, { 'server-timing': `db;dur=${dbMs.toFixed(0)}` });
  const now = Date.now();
  const room = game.effectiveRoom(found.room, now);
  const isHost = sameHash(q.get('host'), room.hostHash);
  const playerId = q.get('player');

  let me = null;
  if (playerId) {
    const rec = players.find((p) => p.id === playerId);
    if (!rec || !sameHash(q.get('token'), rec.player.tokenHash)) return json({ error: 'not in game', kicked: !rec }, 403);
    me = rec.player;
  } else if (!isHost) {
    return json({ error: 'unauthorized' }, 401);
  }

  const pub = publicRoom(room, now);
  const month = Math.floor(pub.month);
  const over = pub.status === 'done';
  const board = players.map(({ id, player }) => {
    const s = game.summarize(room, player, month);
    const row = { id, name: player.name, netWorth: s.netWorth, debt: s.debt, trades: player.trades };
    // Everyone's portfolio is shown only once the game is over.
    if (over) Object.assign(row, { cash: s.cash, holdings: s.holdings, bills: s.bills, contributed: s.contributed, casino: s.casino, taxes: s.taxes, divested: s.divested, finalTax: s.finalTax });
    return row;
  });
  // The two computer players (games started after they existed).
  if (room.gatesDone && pub.status !== 'lobby') {
    for (const bot of game.BOTS) {
      const s = game.summarize(room, game.botAt(room, bot, month), month);
      const row = { id: bot.id, name: bot.name, bot: true, netWorth: s.netWorth, debt: s.debt, trades: 0 };
      if (over) Object.assign(row, { cash: s.cash, holdings: s.holdings, bills: s.bills, contributed: s.contributed, casino: s.casino, taxes: s.taxes, divested: s.divested, finalTax: s.finalTax });
      board.push(row);
    }
  }
  board.sort((a, b) => b.netWorth - a.netWorth);

  // Which deploy answered, so open pages can tell when to reload.
  const build = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev').slice(0, 12);
  const body = { now, build, room: pub, leaderboard: board, news: game.news(room, month, me) };
  if (pub.status !== 'lobby') body.market = game.market(room, month);
  if (me) body.me = { id: me.id, name: me.name, v: me.v, ...game.summarize(room, me, month) };
  if (pub.status === 'done') {
    body.reveal = game.reveal(room, month);
    // Everyone's balances over time, rebuilt from their trades once when the
    // game ends and then kept (games started after the trade log existed).
    if (room.gatesDone) {
      try {
        let hist = await store.getRoomHistory(code);
        if (!hist || hist.end !== month) {
          hist = { end: month, months: null, players: {} };
          for (const { id, player } of players) {
            const h = game.replayHistory(room, id, await store.getTrades(code, id), month);
            hist.months = h.months;
            hist.players[id] = { name: player.name, series: h.series };
          }
          for (const bot of game.BOTS) {
            const h = game.botHistory(room, bot, month);
            hist.months ||= h.months;
            hist.players[bot.id] = { name: bot.name, bot: true, series: h.series };
          }
          await store.saveRoomHistory(code, hist);
        }
        if (me && hist.players[me.id]) body.history = { months: hist.months, series: hist.players[me.id].series };
        body.compare = {
          months: hist.months,
          // Everyone's full breakdown, so the results chart can switch players.
          players: Object.entries(hist.players).map(([id, p]) => ({ id, name: p.name, bot: !!p.bot, total: p.series.total, series: p.series })),
        };
      } catch (e) { console.error('history', e); }
    }
  }
  return json(body, 200, { 'server-timing': `db;dur=${dbMs.toFixed(0)}, total;dur=${(performance.now() - t0).toFixed(0)}` });
});

export const POST = handle(async (request) => {
  let body = {};
  try { body = await request.json(); } catch {}
  const now = Date.now();

  if (body.action === 'clientError') {
    // A drawing problem on a player's device (see reportError in the page).
    const clip = (v, n) => String(v ?? '').slice(0, n);
    console.error('[stax client error]', JSON.stringify({
      code: clip(body.code, 8), where: clip(body.where, 60), message: clip(body.message, 300),
      month: Number(body.month) || null, ua: clip(body.ua, 200), stack: clip(body.stack, 1500),
    }));
    return json({ ok: true });
  }

  if (body.action === 'create') {
    const typed = body.passcode != null ? String(body.passcode) : null;
    if (!canHost(request, typed)) {
      if (typed != null) await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return json({ error: typed != null ? 'wrong passcode' : 'passcode required' }, 401);
    }
    const hostKey = randomBytes(18).toString('base64url');
    for (let tries = 0; tries < 20; tries++) {
      const code = Array.from({ length: 4 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
      const room = {
        code, hostHash: hash(hostKey), status: 'lobby', createdAt: now,
        yearSeconds: 30, monthMs: 2500, ...game.newRoomSettings(randomInt(2 ** 31)),
      };
      if (await store.createRoom(code, room)) return json({ code, hostKey }, 200, { 'set-cookie': hostCookie(request) });
    }
    return json({ error: 'Could not make a room code. Try again.' }, 500);
  }

  const code = cleanCode(body.code);
  const found = await store.getRoom(code);
  if (!found) return json({ error: 'No game with that code.' }, 404);
  const { raw: roomRaw } = found;
  const room = game.effectiveRoom(found.room, now);

  if (body.action === 'ready') {
    // A player has read about the new investment. When everyone has, go.
    const rec = await store.getPlayer(code, String(body.player || ''));
    if (!rec || !sameHash(body.token, rec.player.tokenHash)) return json({ error: 'not in game' }, 403);
    let cur = { room, raw: roomRaw };
    for (let attempt = 0; attempt < 6; attempt++) {
      if (!cur.room.gate) return json({ ok: true });
      const ready = [...new Set([...cur.room.gate.ready, rec.player.id])];
      const players = await store.getPlayers(code);
      const everyone = players.every((p) => ready.includes(p.id));
      const next = everyone ? game.clearGate(cur.room, Date.now()) : { ...cur.room, gate: { ...cur.room.gate, ready } };
      try {
        await store.saveRoom(code, cur.raw, next);
        return json({ ok: true, started: everyone });
      } catch (err) {
        if (!(err instanceof store.ConflictError)) throw err;
        const again = await store.getRoom(code);
        cur = { room: game.effectiveRoom(again.room, Date.now()), raw: again.raw };
      }
    }
    throw new store.ConflictError();
  }

  if (body.action === 'join') {
    if (game.isOver(room, now)) return json({ error: 'That game is already over.' }, 400);
    let name = String(body.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
    if (!name) return json({ error: 'Enter your name.' }, 400);
    const players = await store.getPlayers(code);
    if (players.length >= MAX_PLAYERS) return json({ error: 'This game is full.' }, 400);
    const taken = new Set(players.map((p) => p.player.name.toLowerCase()));
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${name.replace(/ \d+$/, '')} ${n}`;
    const id = randomBytes(8).toString('hex');
    const token = randomBytes(18).toString('base64url');
    await store.addPlayer(code, game.newPlayer(id, name, hash(token)));
    return json({ player: id, token, name });
  }

  if (body.action === 'trade') {
    const pub = publicRoom(room, now);
    if (pub.status !== 'running') {
      return json({ error: pub.status === 'paused' ? 'The game is paused.' : pub.status === 'done' ? 'The game is over.' : "The game hasn't started yet." }, 400);
    }
    const month = Math.floor(pub.month);
    for (let attempt = 0; attempt < 3; attempt++) {
      const rec = await store.getPlayer(code, String(body.player || ''));
      if (!rec || !sameHash(body.token, rec.player.tokenHash)) return json({ error: 'not in game' }, 403);
      const req = { asset: String(body.asset), side: String(body.side), amount: body.amount, lot: body.lot == null ? undefined : String(body.lot),
        shares: body.shares == null ? undefined : body.shares === 'max' || body.shares === 'all' ? body.shares : Number(body.shares) };
      const next = game.trade(room, rec.player, month, req);
      try {
        await store.savePlayer(code, rec.raw, next);
        // Remember the trade for the end-of-game chart (never blocks a trade).
        await store.appendTrade(code, rec.player.id, game.tradeLogEntry(month, req, game.settle(room, rec.player, month), next)).catch((e) => console.error('trade log', e));
        return json({ me: { id: next.id, name: next.name, v: next.v, ...game.summarize(room, next, month) } });
      } catch (err) {
        if (!(err instanceof store.ConflictError)) throw err;
      }
    }
    throw new store.ConflictError();
  }

  if (body.action === 'host') {
    if (!sameHash(body.host, room.hostHash)) return json({ error: 'Only the host can do that.' }, 403);
    const next = { ...room };
    const status = publicRoom(room, now).status;
    switch (body.op) {
      case 'start':
        if (status !== 'lobby') return json({ error: 'Already started.' }, 400);
        if (YEAR_SECONDS.includes(Number(body.yearSeconds))) next.yearSeconds = Number(body.yearSeconds);
        next.monthMs = (next.yearSeconds * 1000) / 12;
        next.status = 'running';
        next.startedAt = now;
        next.pausedMs = 0;
        next.gatesDone = [];
        break;
      case 'pause':
        if (status !== 'running') return json({ error: 'Not running.' }, 400);
        next.status = 'paused';
        next.pausedAt = now;
        break;
      case 'resume':
        if (status !== 'paused') return json({ error: 'Not paused.' }, 400);
        if (room.gate) { Object.assign(next, game.clearGate(room, now)); break; }
        next.status = 'running';
        next.pausedMs = (room.pausedMs || 0) + (now - room.pausedAt);
        next.pausedAt = null;
        break;
      case 'end':
        if (status === 'done') break;
        if (status === 'lobby') return json({ error: "The game hasn't started." }, 400);
        // Ending early freezes the clock where it is.
        next.endedAt = status === 'paused' ? room.pausedAt : now;
        next.status = 'done';
        break;
      case 'kick':
        await store.removePlayer(code, String(body.player || ''));
        return json({ ok: true });
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
    await store.saveRoom(code, roomRaw, next);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action.' }, 400);
});
