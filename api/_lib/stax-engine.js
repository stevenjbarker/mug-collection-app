// Game rules for Stax. Pure functions: everything is computed from the room,
// a player record, and the game month, so the server stays the only source
// of truth and players never see prices from the future.
import { randomInt } from 'node:crypto';
import { ASSET_INDEX, STOCKS, CPI, RATES, COMMODITIES, FIRST_YEAR } from './stax-data.js';

export const GAME_MONTHS = 240;
export const PAYCHECK = 4000;
export const PAY_EVERY = 6;
export const START_YEARS = [1986, 2006]; // 20-year windows that fit the data
export const CARD_APR = 0.22;
const STOCKS_UNLOCK = 36;
const COMMOD_UNLOCK = 132; // Year 12
// Real monthly prices (World Bank) for these raw goods.
export const COMMODITY_LIST = [
  { id: 'oil', name: 'Oil', unit: 'barrel' },
  { id: 'coffee', name: 'Coffee', unit: 'kg' },
  { id: 'corn', name: 'Corn', unit: 'ton' },
  { id: 'soy', name: 'Soybeans', unit: 'ton' },
  { id: 'rice', name: 'Rice', unit: 'ton' },
];
const BONDS_UNLOCK = 60;
export const BILL_DUE = 3;          // months to pay a surprise bill before it starts charging interest
const STOCKS_PER_GAME = [3, 5];

// Fixed-term deposits: money is locked in at that month's real rate and paid
// back to pocket cash at maturity. CDs charge a penalty to cash out early;
// government bonds can be sold any time at full value.
export const TERMS = {
  cd6: { term: 6, penaltyMonths: 3 },
  cd: { term: 12, penaltyMonths: 3 },
  cd36: { term: 36, penaltyMonths: 6 },
  b1: { term: 1, penaltyMonths: 0 },
  b3: { term: 3, penaltyMonths: 0 },
  b12: { term: 12, penaltyMonths: 0 },
};

const CD_LESSON = 'A CD (certificate of deposit) is a deal with a bank: you lock your money up for 6 months, 1 year or 3 years and the bank pays a fixed interest rate, usually more than savings. Longer CDs usually pay more. When it matures, your money plus interest lands back in your pocket cash. Need it sooner? You can break it, but you pay a penalty: 3 months of interest (6 months on a 3-year CD).';

const BOND_LESSON = 'A government bond is a loan to the U.S. government. You lend money for a set time — 1 month, 3 months, or 1 year — at the interest rate of the day you buy, and get it back with interest when it matures. Longer bonds usually pay more, but your money is tied up longer (you can sell early here without a penalty). Rates change over time, so watch them.';

export const INVESTMENTS = [
  {
    id: 'savings', name: 'Savings Account', unlock: 0, risk: 'Very low',
    lesson: 'A savings account pays you a small amount of interest to hold your money, and you can deposit or withdraw any time. It is the home for your emergency fund: surprise bills have to be paid from pocket cash, so having savings to withdraw keeps you off the credit card.',
  },
  { id: 'cd6', name: 'CD · 6 months', unlock: 12, risk: 'Very low', lesson: CD_LESSON },
  { id: 'cd', name: 'CD · 1 year', unlock: 12, risk: 'Very low', lesson: CD_LESSON },
  { id: 'cd36', name: 'CD · 3 years', unlock: 12, risk: 'Very low', lesson: CD_LESSON },
  {
    id: 'index', name: 'Index Fund', unlock: 24, risk: 'Medium',
    lesson: 'An index fund buys a tiny slice of the 500 biggest U.S. companies at once. When one company stumbles, the others carry it. Some years it drops hard, but over long stretches it has grown more than almost anything else.',
  },
  {
    id: 'stocks', name: 'Individual Stocks', unlock: STOCKS_UNLOCK, risk: 'High',
    lesson: 'A share of stock is a piece of ownership in one company. If the company grows, so does your share, and if it struggles, you can lose a lot. These are real companies with their names changed. Read the descriptions and decide who you believe in.',
  },
  { id: 'b1', name: 'Gov. Bond · 1 month', unlock: BONDS_UNLOCK, risk: 'Very low', lesson: BOND_LESSON },
  { id: 'b3', name: 'Gov. Bond · 3 months', unlock: BONDS_UNLOCK, risk: 'Very low', lesson: BOND_LESSON },
  { id: 'b12', name: 'Gov. Bond · 1 year', unlock: BONDS_UNLOCK, risk: 'Low', lesson: BOND_LESSON },
  {
    id: 'realestate', name: 'Real Estate', unlock: 84, risk: 'Medium',
    lesson: 'This tracks the price of U.S. homes. Real estate usually rises slowly with the economy, but when a housing bubble pops, prices can fall for years.',
  },
  {
    id: 'commod', name: 'Commodities', unlock: COMMOD_UNLOCK, risk: 'High',
    lesson: 'Commodities are raw goods the whole world buys: oil, coffee, corn, soybeans and rice. Their prices swing with weather, wars, harvests and how fast the world economy is growing. They pay no interest or dividends, so you only make money if the price goes up.',
  },
  {
    id: 'roulette', name: 'Roulette', unlock: 204, risk: 'Gambling',
    lesson: 'A roulette wheel has 38 pockets: 18 red, 18 black, plus 0 and 00. Bet on red or black and you double your money if you win, but you win only 18 times out of 38. Bet on 0 or 00 and you win 35 times your bet, but only 1 time in 38. Either way the casino keeps about 5 cents of every dollar bet over time. That is the house edge, and it is why casinos make money.',
  },
  {
    id: 'gold', name: 'Gold', unlock: 108, risk: 'High',
    lesson: 'Gold pays no interest and no dividends. Its price moves on fear and inflation: people rush to it when they are scared. It can sit still for a decade, then shoot up.',
  },
];

const EXPENSES = [
  { title: 'Your car needs a new transmission.', amount: 3200 },
  { title: 'Emergency room visit.', amount: 2400 },
  { title: 'Your phone fell in the lake.', amount: 900 },
  { title: 'The water heater burst.', amount: 1500 },
  { title: 'A tooth needs a root canal.', amount: 1800 },
  { title: 'Your laptop died.', amount: 1200 },
  { title: 'A family member needs help with rent.', amount: 2000 },
  { title: 'Fender bender — your insurance deductible.', amount: 1000 },
  { title: 'The roof is leaking.', amount: 4500 },
  { title: 'Your dog swallowed a sock. Vet bill.', amount: 2600 },
];
const WINDFALLS = [
  { title: 'Tax refund!', amount: 1200 },
  { title: 'You got a bonus at work.', amount: 2500 },
  { title: 'Grandma sent a birthday check.', amount: 500 },
];

// Real market news, keyed by calendar month: [what players see during the
// game, what really happened]. The in-game line says what's going on in the
// economy without naming the event, so it doesn't give the year away; the
// real story is revealed with the dates at the end.
const HEADLINES = {
  '1986-02': ['Energy prices are dropping fast. Gas is getting cheaper.', 'Oil prices collapsed — gas was suddenly cheap.'],
  '1987-08': ['Stocks keep hitting record highs. Everyone feels rich.', 'Stocks kept hitting record highs before the crash.'],
  '1987-10': ['Stocks just had a terrible month. Many investors are panicking.', 'Black Monday: stocks fell 22% in a single day, the worst day in market history.'],
  '1987-12': ['After a big drop, some investors sold everything. Others quietly kept buying.', 'After the crash, some investors sold everything. Others kept buying.'],
  '1989-11': ['Big changes overseas have people hopeful about growing trade.', 'The Berlin Wall fell.'],
  '1990-08': ['Oil prices are soaring because of trouble overseas. Stocks are sliding.', 'Iraq invaded Kuwait. Oil prices soared and stocks slid.'],
  '1991-03': ['Stocks are rallying as worries fade.', 'The Gulf War ended quickly and stocks rallied.'],
  '1994-02': ['The central bank surprised everyone by raising interest rates. Bond prices dropped.', 'The Federal Reserve surprised markets by raising rates; bonds had their worst year in decades.'],
  '1995-08': ['A hot new tech company doubled on its first day of trading. Investors are excited.', "Netscape's stock doubled on its first day — the internet boom began."],
  '1996-12': ['A top official warns that stock prices may be too high.', 'Fed Chairman Alan Greenspan warned of "irrational exuberance."'],
  '1997-10': ['A financial crisis overseas is rattling markets.', 'The Asian financial crisis rattled markets worldwide.'],
  '1998-09': ["A foreign government can't pay its debts, and a big investment fund nearly collapses.", 'Russia defaulted and the hedge fund Long-Term Capital Management nearly collapsed.'],
  '1999-12': ['Tech stocks are on fire. People are quitting jobs to trade stocks.', 'The dot-com bubble neared its peak.'],
  '2000-04': ['Tech stocks are cracking. Some popular companies are down 50% in weeks.', 'The dot-com bubble burst.'],
  '2001-04': ['Young tech companies are going out of business one after another.', 'Dot-com companies went bankrupt one after another.'],
  '2001-09': ['A sudden crisis sent stocks tumbling this month.', 'The September 11 attacks closed the stock market for almost a week.'],
  '2001-12': ['A giant company collapsed in an accounting scandal.', 'Enron collapsed in an accounting scandal.'],
  '2002-07': ['Another accounting scandal. Investors are losing trust in big companies.', 'WorldCom collapsed in another huge accounting fraud.'],
  '2002-10': ['Stocks are down nearly half from their peak. Many investors have given up.', 'Stocks hit bottom after a nearly 50% fall.'],
  '2003-03': ['Uncertainty overseas has investors nervous.', 'The Iraq War began.'],
  '2005-08': ['A natural disaster hit a major region. Gas prices spiked.', 'Hurricane Katrina devastated the Gulf Coast.'],
  '2006-06': ['Home prices are soaring. Banks are lending to almost anyone.', 'The housing bubble peaked; banks were lending with almost no money down.'],
  '2007-08': ['Banks are getting nervous about risky home loans.', 'The subprime mortgage crisis began.'],
  '2008-03': ['A major investment bank nearly failed and was sold for pennies on the dollar.', 'Bear Stearns nearly failed and was sold to JPMorgan for pennies.'],
  '2008-09': ['WALL STREET PANIC: a famous bank went bankrupt and a giant insurer needed a government rescue.', 'Lehman Brothers went bankrupt and AIG needed a government rescue.'],
  '2008-10': ['Stocks are in free fall. The government is spending hundreds of billions to rescue banks.', 'Congress passed the $700 billion bank bailout (TARP).'],
  '2009-03': ['Unemployment is soaring. Stocks are down more than half from their peak.', 'The Great Recession: stocks bottomed after a 57% fall.'],
  '2010-05': ['Stocks plunged nearly 10% in minutes one afternoon, then bounced back.', 'The "Flash Crash."'],
  '2011-08': ["The government's credit rating was downgraded. Markets are shaky.", 'The U.S. credit rating was downgraded for the first time ever.'],
  '2013-06': ['Gold prices are crashing.', 'Gold prices crashed.'],
  '2015-08': ['Worries about a slowing economy overseas are rattling markets.', "Fears about China's economy rattled markets."],
  '2016-06': ['A surprise vote overseas has markets wobbling.', 'Britain voted to leave the European Union (Brexit).'],
  '2018-12': ['Stocks are having a rough month. Investors worry interest rates are rising too fast.', 'Stocks had their worst December since the Great Depression.'],
  '2020-02': ['A health scare overseas has investors watching closely.', 'COVID-19 began spreading around the world.'],
  '2020-03': ['Businesses are shutting down and stocks fell over 30% in a month.', 'The COVID-19 pandemic shut down cities; stocks fell over 30% in a month.'],
  '2020-08': ['Stocks are back to record highs even though the economy is still hurting.', 'Stocks recovered to record highs during the pandemic.'],
  '2021-11': ['Prices are rising fast. Inflation is the highest in decades.', 'Inflation hit a 40-year high.'],
  '2022-06': ['The central bank is raising interest rates sharply to fight inflation. Stocks AND bonds are falling.', 'The Fed raised rates sharply; stocks and bonds both fell.'],
  '2023-03': ['A big bank failed in just two days.', 'Silicon Valley Bank failed in two days.'],
  '2023-06': ['Excitement about a new technology is sending chip stocks soaring.', 'The AI boom sent chip stocks soaring.'],
  '2025-04': ['Sudden new taxes on imports are shaking markets.', 'Sweeping new tariffs shook markets.'],
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (m) => `Year ${Math.min(20, Math.floor(m / 12) + 1)}, ${MONTH_NAMES[m % 12]}`;

const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Rooms ----------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newRoomSettings(seed) {
  const r = rng(seed);
  const startYear = START_YEARS[0] + Math.floor(r() * (START_YEARS[1] - START_YEARS[0] + 1));
  // The same surprises hit every player in the room, so it stays fair.
  const pool = [...EXPENSES];
  const events = [];
  for (let i = 0; i < 7; i++) {
    const e = pool.splice(Math.floor(r() * pool.length), 1)[0];
    events.push({ month: 14 + i * 32 + Math.floor(r() * 18), ...e, amount: -e.amount });
  }
  const wind = [...WINDFALLS];
  for (let i = 0; i < 2; i++) {
    const e = wind.splice(Math.floor(r() * wind.length), 1)[0];
    events.push({ month: 40 + i * 110 + Math.floor(r() * 40), ...e });
  }
  events.sort((a, b) => a.month - b.month);
  // Each game deals a random handful of companies that trade for at least
  // two years of the game.
  const k0 = (startYear - FIRST_YEAR) * 12;
  const eligible = STOCKS.filter((s) => s.listed - k0 <= GAME_MONTHS - 24).map((s) => s.id);
  const count = STOCKS_PER_GAME[0] + Math.floor(r() * (STOCKS_PER_GAME[1] - STOCKS_PER_GAME[0] + 1));
  const stockIds = [];
  // At least two "wild" companies (big booms and busts) in every game.
  const wildPool = eligible.filter((id) => stockById(id).wild);
  for (let i = 0; i < 2 && wildPool.length; i++) {
    const id = wildPool.splice(Math.floor(r() * wildPool.length), 1)[0];
    stockIds.push(id);
    eligible.splice(eligible.indexOf(id), 1);
  }
  while (stockIds.length < Math.min(count, stockIds.length + eligible.length)) {
    stockIds.push(eligible.splice(Math.floor(r() * eligible.length), 1)[0]);
  }
  // Fresh made-up names every game: a random first word (never repeated in
  // the same game) plus one of the company's industry endings.
  const words = [...NAME_WORDS];
  const stockNames = {};
  for (const id of stockIds) {
    const s = stockById(id);
    const word = words.splice(Math.floor(r() * words.length), 1)[0];
    stockNames[id] = `${word} ${s.suffixes[Math.floor(r() * s.suffixes.length)]}`;
  }
  return { startYear, events, stockIds, stockNames, personalEvents: true };
}

const startIndex = (room) => (room.startYear - FIRST_YEAR) * 12;

// Each player gets the room's same set of surprises (so totals stay fair),
// but in their own random order and at their own times.
export function eventsFor(room, player) {
  if (!room.personalEvents || !player) return room.events;
  let h = 2166136261;
  for (const c of `${room.code}:${player.id}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = rng(h);
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const bills = shuffle(room.events.filter((e) => e.amount < 0));
  const gifts = shuffle(room.events.filter((e) => e.amount > 0));
  const out = [
    ...bills.map((e, i) => ({ ...e, month: 14 + i * 32 + Math.floor(r() * 18) })),
    ...gifts.map((e, i) => ({ ...e, month: 40 + i * 110 + Math.floor(r() * 40) })),
  ];
  return out.sort((a, b) => a.month - b.month);
}

// Current game month (fractional), from the room's clock.
export function gameMonth(room, now) {
  if (room.status === 'lobby' || !room.startedAt) return 0;
  const end = room.status === 'paused' ? room.pausedAt : room.status === 'done' && room.endedAt ? room.endedAt : now;
  const m = (end - room.startedAt - (room.pausedMs || 0)) / room.monthMs;
  return Math.max(0, Math.min(GAME_MONTHS, m));
}

// Months where something new unlocks. The game pauses there for everyone
// until all players have read about it and pressed Ready.
export const GATES = [...new Set(INVESTMENTS.map((i) => i.unlock))].sort((a, b) => a - b);

// The room as it really is right now: if the clock has run past an unlock
// that hasn't been cleared yet, the game is paused at that exact month.
export function effectiveRoom(room, now) {
  // Games started before unlock pauses existed have no gatesDone; leave them be.
  if (room.status !== 'running' || !room.gatesDone) return room;
  const done = room.gatesDone;
  const m = gameMonth(room, now);
  const gate = GATES.find((g) => g <= m && g < GAME_MONTHS && !done.includes(g));
  if (gate == null) return room;
  return {
    ...room, status: 'paused',
    pausedAt: room.startedAt + (room.pausedMs || 0) + gate * room.monthMs,
    gate: { month: gate, ready: [] },
  };
}

// Clears an unlock pause and starts the clock again.
export function clearGate(room, now) {
  return {
    ...room, status: 'running',
    pausedMs: (room.pausedMs || 0) + (now - room.pausedAt), pausedAt: null,
    gatesDone: [...(room.gatesDone || []), room.gate.month], gate: null,
  };
}

export function isOver(room, now) {
  return room.status === 'done' || (room.status === 'running' && gameMonth(room, now) >= GAME_MONTHS);
}

// ---------- Prices (month = whole game month 0..240) ----------

function stockById(id) {
  return STOCKS.find((s) => s.id === id);
}

// Neutral first words for made-up company names.
const NAME_WORDS = [
  'Meridian', 'Northgate', 'Halberd', 'Atlas', 'Granite', 'Prairie', 'Crossroads', 'Starlight', 'Velocity', 'Quartz',
  'Bayline', 'Sterling', 'Keystone', 'Horizon', 'Benchmark', 'Whitfield', 'Hearthstone', 'Union', 'Bulwark', 'Lattice',
  'Copperline', 'Riverbend', 'Prism', 'Marquee', 'Beacon', 'Summit', 'Harbor', 'Pinecrest', 'Bluewater', 'Ironwood',
  'Redstone', 'Silverleaf', 'Oakmont', 'Lakeshore', 'Evergreen', 'Westbrook', 'Clearwater', 'Highland', 'Brightway', 'Cobalt',
  'Falcon', 'Juniper', 'Maple Ridge', 'Northstar', 'Pioneer', 'Ridgeline', 'Tidewater', 'Windward', 'Cedar Point', 'Anchor',
];

// A company's name in this game (older rooms used the fixed names).
const nameIn = (room, s) => room.stockNames?.[s.id] || s.name;

// The companies dealt for this room (older rooms used all of them).
function roomStocks(room) {
  return room.stockIds ? STOCKS.filter((s) => room.stockIds.includes(s.id)) : STOCKS;
}

export function price(room, asset, month) {
  const k = startIndex(room) + month;
  if (asset === 'card') return Math.pow(1 + CARD_APR, month / 12);
  if (COMMODITIES[asset]) return COMMODITIES[asset][k];
  const series = ASSET_INDEX[asset] || stockById(asset)?.prices;
  if (!series) throw new Error('unknown investment');
  const base = series[startIndex(room)];
  const v = series[k];
  if (v == null) return null;
  // Stocks show a share price; everything else is "value of $100 at the start".
  if (ASSET_INDEX[asset]) return (v / base) * 100;
  const s = stockById(asset);
  const first = series[Math.max(s.listed, startIndex(room))];
  return (v / first) * startPrice(s);
}

// The rate on offer at the start of a game month (last month's average).
export function rateFor(room, kind, month) {
  return RATES[kind][startIndex(room) + month];
}

// A believable share price for a stock's first appearance in the game.
function startPrice(s) {
  let h = 0;
  for (const c of s.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 12 + (h % 60);
}

// The description that fits the year the stock shows up in this game.
function blurbFor(room, s) {
  if (!Array.isArray(s.blurb)) return s.blurb;
  const year = room.startYear + Math.floor(stockListedMonth(room, s) / 12);
  let text = s.blurb[0][1];
  for (const [from, t] of s.blurb) if (from <= year) text = t;
  return text;
}

export function stockListedMonth(room, s) {
  return Math.max(STOCKS_UNLOCK, s.listed - startIndex(room));
}

function isAvailable(room, asset, month) {
  if (asset === 'card' || asset === 'bill') return true;
  if (COMMODITIES[asset]) return month >= COMMOD_UNLOCK;
  const inv = INVESTMENTS.find((i) => i.id === asset);
  if (inv && inv.id !== 'stocks') return month >= inv.unlock;
  const s = roomStocks(room).find((x) => x.id === asset);
  return !!s && month >= stockListedMonth(room, s);
}

// ---------- Fixed-term lots (CDs and government bonds) ----------

function lotValue(lot, month) {
  const held = Math.min(Math.max(0, month - lot.start), TERMS[lot.kind].term);
  return lot.amount * Math.pow(1 + lot.rate, held / 12);
}

function lotCashOut(lot, month) {
  const pen = TERMS[lot.kind].penaltyMonths;
  const penalty = pen ? lot.amount * (Math.pow(1 + lot.rate, pen / 12) - 1) : 0;
  return Math.max(0, lotValue(lot, month) - penalty);
}

const KIND_LABEL = { cd6: 'A 6-month CD', cd: 'A 1-year CD', cd36: 'A 3-year CD', b1: 'A 1-month bond', b3: 'A 3-month bond', b12: 'A 1-year bond' };

function note(p, id, text, kind) {
  p.log = [...p.log, { id, text, kind }].slice(-8);
}

// Pays out every lot that has matured by `month` into pocket cash.
function matureLots(p, month) {
  const keep = [];
  for (const lot of p.lots) {
    const end = lot.start + TERMS[lot.kind].term;
    if (end <= month) {
      const value = round2(lotValue(lot, end));
      p.cashDelta += value;
      note(p, `m:${lot.id}`, `${KIND_LABEL[lot.kind]} matured: +$${value.toLocaleString('en-US')} back in your pocket cash.`, 'good');
    } else keep.push(lot);
  }
  p.lots = keep;
}

// A bill not paid by its due date keeps growing at the average credit card
// rate of the time, compounded monthly, until the player pays it.
function billValue(room, b, month) {
  let v = b.amount;
  for (let m = b.due; m < month; m++) v *= 1 + rateFor(room, 'card', m) / 12;
  return v;
}

function flagOverdueBills(room, p, month) {
  for (const b of p.bills) {
    if (b.due <= month && !b.overdue) {
      b.overdue = true;
      const apr = (rateFor(room, 'card', b.due) * 100).toFixed(1);
      note(p, `o:${b.id}`, `You haven't paid "${b.title.replace(/[.!]$/, '')}" yet. Charging you ${apr}% interest (the average credit card rate) until you do.`, 'bad');
    }
  }
}

// ---------- Players ----------

export function newPlayer(id, name, tokenHash) {
  return { id, name, tokenHash, cashDelta: 0, units: {}, cost: {}, lots: [], bills: [], log: [], debtUnits: 0, eventsDone: 0, trades: 0, v: 0 };
}

const paychecks = (month) => Math.min(GAME_MONTHS / PAY_EVERY, Math.floor(month / PAY_EVERY) + 1);
const cashOf = (p, month) => round2(paychecks(month) * PAYCHECK + p.cashDelta);

// Brings a player up to `month`: windfalls are added, surprise bills become
// due (the player pays them), deposits mature, and late bills start
// charging credit card interest.
// Everything happens in order, at the prices of the month it happened.
export function settle(room, player, month) {
  const p = structuredClone(player);
  p.lots ||= (p.cds || []).map((l) => ({ ...l, kind: 'cd' }));
  delete p.cds;
  p.bills ||= [];
  p.log ||= [];
  const events = eventsFor(room, p);
  while (p.eventsDone < events.length && events[p.eventsDone].month <= month) {
    const e = events[p.eventsDone];
    matureLots(p, e.month);
    flagOverdueBills(room, p, e.month);
    if (e.amount > 0) p.cashDelta += e.amount;
    else p.bills.push({ id: p.eventsDone, title: e.title, amount: -e.amount, due: e.month + BILL_DUE });
    p.eventsDone++;
  }
  matureLots(p, month);
  flagOverdueBills(room, p, month);
  p.cashDelta = round2(p.cashDelta);
  return p;
}

// Capital gains tax on the profit when an investment is sold (savings is
// exempt). Like the U.S.: held under a year it's taxed like a paycheck,
// a year or longer at the lower long-term rate. Losses aren't taxed.
export const TAX_SHORT = 0.22;
export const TAX_LONG = 0.15;
export const TAX_LONG_MONTHS = 12;

function addUnits(p, asset, units, cost, month) {
  const held = p.units[asset] || 0;
  p.since ||= {};
  // Average purchase month, weighted by units, decides short vs long term.
  p.since[asset] = held > 1e-9 ? ((p.since[asset] ?? 0) * held + month * units) / (held + units) : month;
  p.units[asset] = held + units;
  p.cost[asset] = (p.cost[asset] || 0) + cost;
}

function sellUnits(p, asset, units, proceeds, month) {
  const held = p.units[asset] || 0;
  const frac = held ? Math.min(1, units / held) : 0;
  const basis = (p.cost[asset] || 0) * frac;
  p.cost[asset] = (p.cost[asset] || 0) * (1 - frac);
  p.units[asset] = held - units;
  const heldMonths = month - (p.since?.[asset] ?? 0);
  if (p.units[asset] < 1e-9) { delete p.units[asset]; delete p.cost[asset]; if (p.since) delete p.since[asset]; }
  const gain = proceeds - basis;
  if (asset === 'savings' || !(gain >= 0.005)) return;
  const rate = heldMonths >= TAX_LONG_MONTHS - 1e-9 ? TAX_LONG : TAX_SHORT;
  const tax = round2(gain * rate);
  p.cashDelta -= tax;
  p.taxes = round2((p.taxes || 0) + tax);
  p.lastTax = { t: p.trades, tax, gain: round2(gain), rate };
}

export class TradeError extends Error {}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// The bets a player can make: how much they pay and which pockets win.
const inRange = (lo, hi) => (n) => n >= lo && n <= hi && n !== 37;
export function rouletteBet(lot) {
  const k = String(lot || '');
  const outside = {
    red: (n, l, c) => c === 'red', black: (n, l, c) => c === 'black',
    odd: (n) => n >= 1 && n <= 36 && n % 2 === 1, even: (n) => n >= 1 && n <= 36 && n % 2 === 0,
    low: inRange(1, 18), high: inRange(19, 36),
  };
  if (outside[k]) return { pays: 1, wins: outside[k] };
  const dozens = { d1: inRange(1, 12), d2: inRange(13, 24), d3: inRange(25, 36) };
  if (dozens[k]) return { pays: 2, wins: dozens[k] };
  // A single number: "n:17", "n:0", "n:00" (and plain "0"/"00" from older pages).
  const num = k.startsWith('n:') ? k.slice(2) : k;
  if (num === '00' || (/^\d{1,2}$/.test(num) && Number(num) <= 36)) {
    const want = num === '00' ? '00' : String(Number(num));
    return { pays: 35, wins: (n, l) => l === want };
  }
  return null;
}

const SHORT = 'Not enough pocket cash.';

// side: 'buy' | 'sell' | 'pay'. amount: dollars or 'all'. lot: a CD/bond lot
// id to cash out, or a bill id to pay. shares: for stocks, a whole number of
// shares, 'max' (as many as cash allows) or 'all' (sell everything).
export function trade(room, player, month, { asset, side, amount, lot, shares }) {
  const p = settle(room, player, month);
  if (!isAvailable(room, asset, month)) throw new TradeError("That investment isn't available yet.");
  const cash = cashOf(p, month);
  const BILL_FIRST = 'Pay your bill first. Withdraw or sell something if you need the cash.';
  if (p.bills.length && (side === 'buy' || side === 'bet')) throw new TradeError(BILL_FIRST);
  const buyAmount = () => {
    const amt = amount === 'all' ? cash : Number(amount);
    if (!(amt >= 1)) throw new TradeError(cash < 1 ? 'No pocket cash left. Payday is every 6 months.' : 'Enter an amount.');
    if (amt > cash + 0.005) throw new TradeError(SHORT);
    return round2(amt);
  };

  if (asset === 'roulette') {
    // An American wheel: 0, 00 and 1-36. Outside bets (red/black, odd/even,
    // 1-18/19-36) pay 1 to 1, a dozen pays 2 to 1, a single number 35 to 1.
    // 0 and 00 lose every outside bet.
    const bet = rouletteBet(lot);
    if (side !== 'bet' || !bet) throw new TradeError('Pick a bet.');
    const amt = buyAmount();
    const n = randomInt(38); // 0 → "0", 37 → "00", otherwise the number
    const label = n === 0 ? '0' : n === 37 ? '00' : String(n);
    const color = n === 0 || n === 37 ? 'green' : RED.has(n) ? 'red' : 'black';
    const win = bet.wins(n, label, color);
    const delta = win ? amt * bet.pays : -amt;
    p.cashDelta += delta;
    const c = p.casino || { spins: 0, wagered: 0, net: 0 };
    p.casino = { spins: c.spins + 1, wagered: round2(c.wagered + amt), net: round2(c.net + delta), last: { id: `${month}-${p.trades}`, label, color, pick: lot, amount: amt, delta: round2(delta) } };
  } else if (asset === 'bill') {
    const bill = p.bills.find((b) => String(b.id) === String(lot));
    if (!bill) throw new TradeError('That bill is already taken care of.');
    const owe = round2(billValue(room, bill, month));
    if (owe > cash + 0.005) throw new TradeError('Not enough pocket cash. Withdraw from savings or sell something first.');
    p.cashDelta -= owe;
    p.bills = p.bills.filter((b) => b !== bill);
  } else if (asset === 'card') {
    const px = price(room, 'card', month);
    const debt = p.debtUnits * px;
    const amt = amount === 'all' ? Math.min(cash, debt) : Math.min(Number(amount), debt);
    if (!(amt > 0)) throw new TradeError(debt > 0 ? SHORT : 'You have no card debt.');
    if (amt > cash + 0.005) throw new TradeError(SHORT);
    p.cashDelta -= amt;
    p.debtUnits = Math.max(0, p.debtUnits - amt / px);
    if (p.debtUnits * px < 0.01) p.debtUnits = 0;
  } else if (TERMS[asset]) {
    if (side === 'buy') {
      const amt = buyAmount();
      p.cashDelta -= amt;
      p.lots.push({ id: `${month}-${p.trades}`, kind: asset, amount: amt, rate: rateFor(room, asset, month), start: month });
    } else if (side === 'sell') {
      const mine = p.lots.filter((l) => l.kind === asset);
      if (!mine.length) throw new TradeError("You don't own any.");
      if (lot != null) {
        // Cash out one specific lot (how CDs are broken).
        const l = mine.find((x) => x.id === lot);
        if (!l) throw new TradeError("You don't have that one.");
        p.cashDelta += lotCashOut(l, month);
        p.lots = p.lots.filter((x) => x !== l);
      } else {
        if (TERMS[asset].penaltyMonths) throw new TradeError('Pick which CD to break.');
        // Bonds: take the amount from the newest bonds first, at full value.
        let want = amount === 'all' ? Infinity : Number(amount);
        if (!(want > 0)) throw new TradeError('Enter an amount.');
        for (const l of [...mine].reverse()) {
          if (want <= 0.005) break;
          const v = lotValue(l, month);
          const take = Math.min(want, v);
          p.cashDelta += take;
          want -= take;
          if (take >= v - 0.005) p.lots = p.lots.filter((x) => x !== l);
          else l.amount *= 1 - take / v;
        }
      }
    } else throw new TradeError('Bad trade.');
  } else if (shares != null && stockById(asset)) {
    // Individual stocks trade in whole shares.
    const px = price(room, asset, month);
    const held = p.units[asset] || 0;
    if (side === 'buy') {
      const n = shares === 'max' ? Math.floor((cash + 0.005) / px) : Math.floor(Number(shares));
      if (!(n >= 1)) throw new TradeError(shares === 'max' ? `Not enough pocket cash for even one share ($${px.toFixed(2)}).` : 'Pick how many shares.');
      const cost = round2(n * px);
      if (cost > cash + 0.005) throw new TradeError(`${n} shares cost $${cost.toLocaleString('en-US')}. ${SHORT}`);
      p.cashDelta -= cost;
      addUnits(p, asset, n, cost, month);
    } else if (side === 'sell') {
      if (!(held > 1e-9)) throw new TradeError("You don't own any shares.");
      const n = shares === 'all' ? held : Math.min(held, Math.floor(Number(shares)));
      if (!(n > 0)) throw new TradeError('Pick how many shares.');
      p.cashDelta += n * px;
      sellUnits(p, asset, n, n * px, month);
    } else throw new TradeError('Bad trade.');
  } else {
    const px = price(room, asset, month);
    if (side === 'buy') {
      const amt = buyAmount();
      p.cashDelta -= amt;
      addUnits(p, asset, amt / px, amt, month);
    } else if (side === 'sell') {
      const have = (p.units[asset] || 0) * px;
      const amt = amount === 'all' ? have : Math.min(Number(amount), have);
      if (!(amt > 0)) throw new TradeError("You don't own any.");
      p.cashDelta += amt;
      sellUnits(p, asset, amount === 'all' ? p.units[asset] : amt / px, amt, month);
    } else throw new TradeError('Bad trade.');
  }
  p.cashDelta = round2(p.cashDelta);
  p.trades++;
  p.v++;
  return p;
}

export function summarize(room, player, month) {
  const p = settle(room, player, month);
  const cash = cashOf(p, month);
  const holdings = {};
  let invested = 0;
  for (const [asset, units] of Object.entries(p.units)) {
    const value = round2(units * price(room, asset, month));
    holdings[asset] = { value, cost: round2(p.cost[asset] || 0) };
    if (asset !== 'savings') holdings[asset].held = Math.floor(month - (p.since?.[asset] ?? 0));
    if (stockById(asset)) holdings[asset].shares = Math.round(units * 1000) / 1000;
    invested += value;
  }
  for (const kind of Object.keys(TERMS)) {
    const mine = p.lots.filter((l) => l.kind === kind);
    if (!mine.length) continue;
    const lots = mine.map((l) => ({
      id: l.id, amount: round2(l.amount), rate: l.rate, value: round2(lotValue(l, month)),
      breakValue: round2(lotCashOut(l, month)), maturesIn: l.start + TERMS[kind].term - month,
    }));
    const value = round2(lots.reduce((t, l) => t + l.value, 0));
    holdings[kind] = { value, cost: round2(lots.reduce((t, l) => t + l.amount, 0)), lots };
    invested += value;
  }
  const bills = p.bills.map((b) => ({
    id: b.id, title: b.title, original: b.amount, amount: round2(billValue(room, b, month)), dueIn: b.due - month,
    overdue: b.due <= month, apr: b.due <= month ? Number((rateFor(room, 'card', month) * 100).toFixed(1)) : null,
  }));
  const owed = bills.reduce((t, b) => t + b.amount, 0);
  const debt = round2(p.debtUnits * price(room, 'card', month));
  return {
    cash, debt, holdings, bills, log: p.log, casino: p.casino || null,
    taxes: p.taxes || 0, lastTax: p.lastTax && p.lastTax.t === p.trades - 1 ? p.lastTax : null,
    netWorth: round2(cash + invested - debt - owed),
    contributed: paychecks(month) * PAYCHECK,
  };
}

// ---------- What a player can see ----------

const HISTORY = 24;

function series(room, asset, from, month) {
  const out = [];
  for (let m = Math.max(from, month - HISTORY); m <= month; m++) out.push(round2(price(room, asset, m)));
  return out;
}

export function market(room, month) {
  const assets = INVESTMENTS.filter((i) => i.id !== 'stocks').map((i) => {
    const unlocked = month >= i.unlock;
    if (i.id === 'roulette') return { id: i.id, unlocked };
    if (i.id === 'commod') return { id: i.id, unlocked };
    if (TERMS[i.id]) {
      const rates = [];
      for (let m = Math.max(0, month - HISTORY); m <= month; m++) rates.push(Number((rateFor(room, i.id, m) * 100).toFixed(2)));
      return { id: i.id, unlocked, rate: unlocked ? rates[rates.length - 1] : null, history: unlocked ? rates : [], term: TERMS[i.id].term, penaltyMonths: TERMS[i.id].penaltyMonths };
    }
    return { id: i.id, unlocked, price: unlocked ? round2(price(room, i.id, month)) : null, history: unlocked ? series(room, i.id, 0, month) : [] };
  });
  const stocks = [];
  if (month >= STOCKS_UNLOCK) {
    for (const s of roomStocks(room)) {
      const lm = stockListedMonth(room, s);
      if (month < lm) continue;
      stocks.push({ id: s.id, name: nameIn(room, s), blurb: blurbFor(room, s), listedMonth: lm, price: round2(price(room, s.id, month)), history: series(room, s.id, lm, month) });
    }
  }
  const commodities = month >= COMMOD_UNLOCK
    ? COMMODITY_LIST.map((c) => ({ ...c, price: round2(price(room, c.id, month)), history: series(room, c.id, COMMOD_UNLOCK - HISTORY, month) }))
    : [];
  return { assets, stocks, commodities };
}

// `player` adds that player's own bills and windfalls to the feed.
export function news(room, month, player) {
  const out = [];
  const k0 = startIndex(room);
  // Game month m is calendar month m+1 of the first year (month 0 = January),
  // priced as of the start of that month. A month's headline appears once its
  // prices have landed, so news never tips anyone off before the market moves.
  for (let m = 1; m <= month; m++) {
    const c = m - 1;
    const key = `${room.startYear + Math.floor(c / 12)}-${String((c % 12) + 1).padStart(2, '0')}`;
    if (HEADLINES[key]) out.push({ month: m, kind: 'news', text: HEADLINES[key][0], at: c });
  }
  for (const s of roomStocks(room)) {
    const lm = s.listed - k0;
    if (lm > STOCKS_UNLOCK && lm <= month) out.push({ month: lm, kind: 'listing', text: `New on the market: ${nameIn(room, s)}. ${blurbFor(room, s)}` });
  }
  for (const e of player || !room.personalEvents ? eventsFor(room, player) : []) {
    if (e.month <= month) out.push({ month: e.month, kind: e.amount > 0 ? 'windfall' : 'expense', text: e.title, amount: e.amount });
  }
  return out.sort((a, b) => b.month - a.month).slice(0, 12).map(({ at, ...n }) => ({ ...n, label: monthLabel(at ?? n.month) }));
}

// Revealed only once the game is over. `month` is where the game stopped
// (240 unless the host ended it early).
export function reveal(room, month = GAME_MONTHS) {
  const k0 = startIndex(room);
  const end = Math.max(1, Math.min(GAME_MONTHS, Math.floor(month)));
  const years = Math.ceil(end / 12);
  const strategy = (asset) => {
    let units = 0;
    // Same paychecks a player received: one at the start of every 6 months up to `end`.
    for (let m = 0; m <= end && m < GAME_MONTHS; m += PAY_EVERY) units += PAYCHECK / price(room, asset, m);
    return round2(units * price(room, asset, end));
  };
  let inflation = 1;
  for (let y = room.startYear; y < room.startYear + years; y++) inflation *= 1 + CPI[y - FIRST_YEAR];
  const stocks = roomStocks(room).filter((s) => stockListedMonth(room, s) < end && s.listed - k0 <= end).map((s) => {
    const lm = stockListedMonth(room, s);
    return { id: s.id, name: nameIn(room, s), blurb: blurbFor(room, s), real: REAL_NAMES[s.ticker] || s.real || s.ticker, ticker: s.ticker, change: round2(price(room, s.id, end) / price(room, s.id, lm) - 1) };
  });
  // What really happened, with the real dates.
  const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const timeline = [];
  for (let c = 0; c < end; c++) {
    const y = room.startYear + Math.floor(c / 12);
    const key = `${y}-${String((c % 12) + 1).padStart(2, '0')}`;
    if (HEADLINES[key]) timeline.push({ date: `${MONTH_NAMES_LONG[c % 12]} ${y}`, text: HEADLINES[key][1], game: HEADLINES[key][0] });
  }
  return {
    startYear: room.startYear,
    endYear: room.startYear + years - 1,
    endedEarly: end < GAME_MONTHS,
    contributed: paychecks(end) * PAYCHECK,
    benchmarks: {
      savings: strategy('savings'),
      index: strategy('index'),
      realestate: strategy('realestate'),
      gold: strategy('gold'),
    },
    inflation: round2(inflation),
    stocks,
    timeline,
  };
}

// ---------- history for the end-of-game chart ----------

// One entry per successful trade, enough to replay it exactly. Roulette
// stores the money won or lost, since the spin can't be repeated.
export function tradeLogEntry(month, req, before, after) {
  const e = { m: month, a: req.asset, s: req.side };
  if (req.amount != null) e.amt = req.amount;
  if (req.lot != null) e.lot = req.lot;
  if (req.shares != null) e.sh = req.shares;
  if (req.asset === 'roulette') e.d = round2(after.cashDelta - before.cashDelta);
  return e;
}

const CHART_GROUPS = {
  savings: 'savings', cd6: 'safe', cd: 'safe', cd36: 'safe', b1: 'safe', b3: 'safe', b12: 'safe',
  index: 'index', realestate: 'realestate', gold: 'gold',
  oil: 'commod', coffee: 'commod', corn: 'commod', soy: 'commod', rice: 'commod',
};

// Rebuilds a player's balances month by month by replaying their trades.
export function replayHistory(room, playerId, log, end, step = 3) {
  // Same id as the real player, so they get the same surprise bills.
  let p = newPlayer(playerId, '', '');
  let i = 0;
  const months = [];
  const series = { cash: [], savings: [], safe: [], index: [], stocks: [], realestate: [], gold: [], commod: [], total: [], net: [] };
  for (let m = 0; m <= end; m++) {
    while (i < log.length && log[i].m <= m) {
      const e = log[i++];
      try {
        if (e.a === 'roulette') { p = settle(room, p, e.m); p.cashDelta = round2(p.cashDelta + e.d); }
        else p = trade(room, p, e.m, { asset: e.a, side: e.s, amount: e.amt, lot: e.lot, shares: e.sh });
      } catch { /* a trade that can't be repeated is skipped */ }
    }
    if (m % step && m !== end) continue;
    const sm = summarize(room, p, m);
    const row = { cash: sm.cash, savings: 0, safe: 0, index: 0, stocks: 0, realestate: 0, gold: 0, commod: 0 };
    for (const [k, h] of Object.entries(sm.holdings)) row[CHART_GROUPS[k] || 'stocks'] += h.value;
    months.push(m);
    for (const k of Object.keys(row)) series[k].push(Math.round(row[k]));
    series.total.push(Math.round(Object.values(row).reduce((a, b) => a + b, 0)));
    series.net.push(Math.round(sm.netWorth));
  }
  return { months, series };
}

// ---------- computer players ----------
// Two bots play every game with simple, famous strategies, using the same
// prices and the same kind of surprise bills as everyone else.
export const BOTS = [
  { id: 'bot:eddy', name: 'Steady Eddy', kind: 'index' },
  { id: 'bot:rick', name: 'Rebalance Rick', kind: 'rebalance' },
];
const INDEX_UNLOCK = INVESTMENTS.find((i) => i.id === 'index').unlock;

function tryTrade(room, p, m, req) {
  try { return trade(room, p, m, req); } catch { return p; }
}

// Sells what it must (savings first, then the biggest holding) to cover `need`.
function raiseCash(room, p, m, need) {
  for (let guard = 0; guard < 20; guard++) {
    const sm = summarize(room, p, m);
    if (sm.cash >= need - 0.005) return p;
    const short = need - sm.cash;
    const order = Object.entries(sm.holdings).filter(([, h]) => h.value > 0.01 && !h.lots).sort(([a, x], [b, y]) => (a === 'savings' ? -1 : b === 'savings' ? 1 : y.value - x.value));
    if (!order.length) return p;
    const [asset, h] = order[0];
    p = tryTrade(room, p, m, { asset, side: 'sell', amount: short >= h.value - 0.005 ? 'all' : Math.ceil(short * 100) / 100 });
  }
  return p;
}

function botStep(room, p, m, kind) {
  // Pay any bill right away.
  for (const b of summarize(room, p, m).bills) {
    p = raiseCash(room, p, m, b.amount);
    p = tryTrade(room, p, m, { asset: 'bill', side: 'pay', lot: String(b.id) });
  }
  const sm = summarize(room, p, m);
  if (kind === 'index') {
    if (m >= INDEX_UNLOCK) {
      if (sm.holdings.savings) p = tryTrade(room, p, m, { asset: 'savings', side: 'sell', amount: 'all' });
      p = tryTrade(room, p, m, { asset: 'index', side: 'buy', amount: 'all' });
    } else {
      p = tryTrade(room, p, m, { asset: 'savings', side: 'buy', amount: 'all' });
    }
    return p;
  }
  // Rebalance: equal dollars in every stock on the market; reset once a year.
  const stocks = m >= STOCKS_UNLOCK ? roomStocks(room).filter((x) => m >= stockListedMonth(room, x)).map((x) => x.id) : [];
  if (!stocks.length) return tryTrade(room, p, m, { asset: 'savings', side: 'buy', amount: 'all' });
  const resetNow = m % 12 === 0 || !p.botStarted;
  if (resetNow) {
    p.botStarted = true;
    for (const asset of Object.keys(summarize(room, p, m).holdings)) p = tryTrade(room, p, m, { asset, side: 'sell', amount: 'all' });
  }
  const cash = summarize(room, p, m).cash;
  if (cash >= stocks.length) {
    const each = Math.floor((cash / stocks.length) * 100) / 100;
    for (const asset of stocks) p = tryTrade(room, p, m, { asset, side: 'buy', amount: each });
  }
  return p;
}

// A bot's state at `month`, built month by month (and remembered, since the
// leaderboard asks for it on every update).
const botCache = globalThis.__staxBots || (globalThis.__staxBots = new Map());
export function botAt(room, bot, month, onMonth) {
  const key = `${room.code}:${room.startedAt}:${bot.id}`;
  let c = !onMonth && botCache.get(key);
  if (!c || c.month > month) c = { month: -1, p: newPlayer(bot.id, bot.name, '') };
  for (let m = c.month + 1; m <= month; m++) {
    c.p = botStep(room, c.p, m, bot.kind);
    c.month = m;
    onMonth?.(c.p, m);
  }
  if (!onMonth) {
    botCache.set(key, c);
    if (botCache.size > 400) botCache.delete(botCache.keys().next().value);
  }
  return c.p;
}

// One month's balances by product type (for the results charts).
function snapshotRow(room, p, m) {
  const sm = summarize(room, p, m);
  const row = { cash: sm.cash, savings: 0, safe: 0, index: 0, stocks: 0, realestate: 0, gold: 0, commod: 0 };
  for (const [k, h] of Object.entries(sm.holdings)) row[CHART_GROUPS[k] || 'stocks'] += h.value;
  return { row, net: sm.netWorth };
}

export function botHistory(room, bot, end, step = 3) {
  const months = [];
  const series = { cash: [], savings: [], safe: [], index: [], stocks: [], realestate: [], gold: [], commod: [], total: [], net: [] };
  botAt(room, bot, end, (p, m) => {
    if (m % step && m !== end) return;
    const { row, net } = snapshotRow(room, p, m);
    months.push(m);
    for (const k of Object.keys(row)) series[k].push(Math.round(row[k]));
    series.total.push(Math.round(Object.values(row).reduce((a, b) => a + b, 0)));
    series.net.push(Math.round(net));
  });
  return { months, series };
}

export const REAL_NAMES = {
  KO: 'Coca-Cola', AAPL: 'Apple', MSFT: 'Microsoft', IBM: 'IBM', GE: 'General Electric', XOM: 'Exxon Mobil',
  WMT: 'Walmart', MCD: "McDonald's", DIS: 'Disney', NKE: 'Nike', INTC: 'Intel', HPQ: 'Hewlett-Packard',
  XRX: 'Xerox', F: 'Ford', BA: 'Boeing', HD: 'Home Depot', JNJ: 'Johnson & Johnson', PG: 'Procter & Gamble',
  C: 'Citigroup', AIG: 'AIG', CSCO: 'Cisco', SBUX: 'Starbucks', AMZN: 'Amazon', NVDA: 'Nvidia',
  NFLX: 'Netflix', GOOGL: 'Google',
};
