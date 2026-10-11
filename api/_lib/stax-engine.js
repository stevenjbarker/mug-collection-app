// Game rules for Stax. Pure functions: everything is computed from the room,
// a player record, and the game month, so the server stays the only source
// of truth and players never see prices from the future.
import { ASSET_INDEX, STOCKS, CPI, CD_RATE, FIRST_YEAR } from './stax-data.js';

export const GAME_MONTHS = 240;
export const PAYCHECK = 4000;
export const PAY_EVERY = 6;
export const START_YEARS = [1986, 2006]; // 20-year windows that fit the data
export const CARD_APR = 0.22;
const STOCKS_UNLOCK = 36;
export const CD_TERM = 12;          // months a CD is locked up
const CD_PENALTY_MONTHS = 3;        // breaking a CD early costs this much interest

export const INVESTMENTS = [
  {
    id: 'savings', name: 'Savings Account', unlock: 0, risk: 'Very low',
    lesson: 'A savings account pays you a small amount of interest to hold your money. It almost never loses value, so it is the home for your emergency fund. Surprise bills happen, and when they do, money comes out of savings first. No savings? It goes on a credit card at 22% interest.',
  },
  {
    id: 'cd', name: 'CDs', unlock: 12, risk: 'Very low',
    lesson: 'A CD (certificate of deposit) is a deal with a bank: you lock your money up for one year and the bank pays a fixed interest rate, usually more than savings. When it matures, your money plus interest lands back in your pocket cash. Need it sooner? You can break it, but you pay a penalty of 3 months of interest.',
  },
  {
    id: 'index', name: 'Index Fund', unlock: 24, risk: 'Medium',
    lesson: 'An index fund buys a tiny slice of the 500 biggest U.S. companies at once. When one company stumbles, the others carry it. Some years it drops hard, but over long stretches it has grown more than almost anything else.',
  },
  {
    id: 'stocks', name: 'Individual Stocks', unlock: STOCKS_UNLOCK, risk: 'High',
    lesson: 'A share of stock is a piece of ownership in one company. If the company grows, so does your share, and if it struggles, you can lose a lot. These are real companies with their names changed. Read the descriptions and decide who you believe in.',
  },
  {
    id: 'treasury', name: 'Government Bonds', unlock: 60, risk: 'Low',
    lesson: 'A bond is a loan. When you buy a government bond you lend money to the U.S. government, and it pays you interest. Bond prices move opposite to interest rates: when rates jump, existing bonds lose value for a while.',
  },
  {
    id: 'realestate', name: 'Real Estate', unlock: 84, risk: 'Medium',
    lesson: 'This tracks the price of U.S. homes. Real estate usually rises slowly with the economy, but when a housing bubble pops, prices can fall for years.',
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

// Real market news, keyed by calendar month. Written so they don't give the year away.
const HEADLINES = {
  '1986-02': 'Oil prices collapse — gas is suddenly cheap.',
  '1987-08': 'Stocks keep hitting record highs. Everyone feels rich.',
  '1987-10': 'BLACK MONDAY: stocks just fell 22% in a single day, the worst day in market history.',
  '1987-12': 'After the crash, some investors sold everything. Others quietly kept buying.',
  '1989-11': 'The Berlin Wall falls.',
  '1990-08': 'War in the Middle East sends oil prices soaring. Stocks slide.',
  '1991-03': 'The war ends quickly and stocks rally.',
  '1994-02': 'The Federal Reserve surprises everyone by raising interest rates. Bond prices drop.',
  '1995-08': 'A web browser company goes public and its stock doubles on day one. Internet mania begins.',
  '1996-12': 'The Fed chairman warns of "irrational exuberance" in stock prices.',
  '1997-10': 'A currency crisis in Asia rattles markets worldwide.',
  '1998-09': 'Russia defaults on its debt and a famous hedge fund nearly collapses.',
  '1999-12': 'Tech stocks are on fire. Everyone\'s neighbor is day-trading internet stocks.',
  '2000-04': 'Tech stocks are cracking. Some internet darlings are down 50% in weeks.',
  '2001-04': 'Dot-com companies are going bankrupt one after another.',
  '2001-09': 'Terrorist attacks close the stock market for almost a week. Stocks plunge when it reopens.',
  '2001-12': 'A giant energy company collapses in an accounting scandal.',
  '2002-07': 'Another huge accounting fraud. Investors are losing trust in big companies.',
  '2002-10': 'Stocks are down nearly half from their peak. Many investors have given up.',
  '2003-03': 'War begins in Iraq.',
  '2005-08': 'A massive hurricane devastates the Gulf Coast.',
  '2006-06': 'Home prices are soaring. Banks are lending to almost anyone, sometimes with no money down.',
  '2007-08': 'Banks are getting nervous about risky home loans.',
  '2008-03': 'A major investment bank nearly fails and is sold for pennies on the dollar.',
  '2008-09': 'WALL STREET PANIC: a 158-year-old investment bank goes bankrupt and a giant insurer needs a government rescue.',
  '2008-10': 'Stocks are in free fall. Congress passes a $700 billion bank rescue.',
  '2009-03': 'Unemployment is soaring. Stocks are down more than 50% from their peak.',
  '2010-05': '"Flash crash": stocks plunge nearly 10% in minutes, then bounce back.',
  '2011-08': 'The U.S. government\'s credit rating is downgraded for the first time ever.',
  '2013-06': 'Gold prices are crashing.',
  '2015-08': 'Worries about China\'s economy rattle markets.',
  '2016-06': 'Britain votes to leave the European Union. Markets wobble.',
  '2018-12': 'Stocks are having their worst December in decades.',
  '2020-02': 'A new virus is spreading around the world.',
  '2020-03': 'PANDEMIC: cities shut down and stocks fall over 30% in a month.',
  '2020-08': 'Stocks are back to record highs even as the pandemic continues.',
  '2021-11': 'Prices are rising fast — inflation is the highest in 40 years.',
  '2022-06': 'The Fed raises interest rates sharply to fight inflation. Stocks AND bonds are falling.',
  '2023-03': 'A big tech-focused bank fails in two days.',
  '2023-06': 'Artificial-intelligence excitement sends chip stocks soaring.',
  '2025-04': 'Sudden new tariffs shake markets.',
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
  return { startYear, events };
}

const startIndex = (room) => (room.startYear - FIRST_YEAR) * 12;

// Current game month (fractional), from the room's clock.
export function gameMonth(room, now) {
  if (room.status === 'lobby' || !room.startedAt) return 0;
  const end = room.status === 'paused' ? room.pausedAt : room.status === 'done' && room.endedAt ? room.endedAt : now;
  const m = (end - room.startedAt - (room.pausedMs || 0)) / room.monthMs;
  return Math.max(0, Math.min(GAME_MONTHS, m));
}

export function isOver(room, now) {
  return room.status === 'done' || (room.status === 'running' && gameMonth(room, now) >= GAME_MONTHS);
}

// ---------- Prices (month = whole game month 0..240) ----------

function stockById(id) {
  return STOCKS.find((s) => s.id === id);
}

export function price(room, asset, month) {
  const k = startIndex(room) + month;
  if (asset === 'card') return Math.pow(1 + CARD_APR, month / 12);
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

// ---------- CDs ----------

// The CD rate on offer at the start of a game month (last month's average).
export function cdRate(room, month) {
  return CD_RATE[startIndex(room) + month];
}

function cdValue(lot, month) {
  const held = Math.min(Math.max(0, month - lot.start), CD_TERM);
  return lot.amount * Math.pow(1 + lot.rate, held / 12);
}

function cdBreakValue(lot, month) {
  const penalty = lot.amount * (Math.pow(1 + lot.rate, CD_PENALTY_MONTHS / 12) - 1);
  return Math.max(0, cdValue(lot, month) - penalty);
}

// Pays out every CD that has matured by `month` into pocket cash.
function matureCds(p, month) {
  const keep = [];
  for (const lot of p.cds) {
    if (lot.start + CD_TERM <= month) {
      const value = round2(cdValue(lot, lot.start + CD_TERM));
      p.cashDelta += value;
      p.matured = [...p.matured, { id: lot.id, month: lot.start + CD_TERM, value }].slice(-5);
    } else keep.push(lot);
  }
  p.cds = keep;
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
  if (asset === 'card') return true;
  const inv = INVESTMENTS.find((i) => i.id === asset);
  if (inv && inv.id !== 'stocks') return month >= inv.unlock;
  const s = stockById(asset);
  return !!s && month >= stockListedMonth(room, s) && s.listed - startIndex(room) <= GAME_MONTHS;
}

// ---------- Players ----------

export function newPlayer(id, name, tokenHash) {
  return { id, name, tokenHash, cashDelta: 0, units: {}, cost: {}, cds: [], matured: [], debtUnits: 0, eventsDone: 0, trades: 0, v: 0 };
}

const paychecks = (month) => Math.min(GAME_MONTHS / PAY_EVERY, Math.floor(month / PAY_EVERY) + 1);
const cashOf = (p, month) => round2(paychecks(month) * PAYCHECK + p.cashDelta);

// Applies surprise expenses, windfalls, and CD payouts up to `month`, in
// order, at the prices of the month they happened. Returns a new player.
export function settle(room, player, month) {
  const p = structuredClone(player);
  p.cds ||= [];
  p.matured ||= [];
  while (p.eventsDone < room.events.length && room.events[p.eventsDone].month <= month) {
    const e = room.events[p.eventsDone];
    matureCds(p, e.month);
    if (e.amount > 0) {
      p.cashDelta += e.amount;
    } else {
      // Pay from pocket cash, then savings, then by breaking CDs, then the card.
      let owed = -e.amount;
      const fromCash = Math.min(owed, Math.max(0, cashOf(p, e.month)));
      p.cashDelta -= fromCash;
      owed -= fromCash;
      if (owed > 0 && p.units.savings) {
        const px = price(room, 'savings', e.month);
        const take = Math.min(owed, p.units.savings * px);
        sellUnits(p, 'savings', take / px);
        owed -= take;
      }
      while (owed > 0 && p.cds.length) {
        const lot = p.cds.pop();
        const got = cdBreakValue(lot, e.month);
        const used = Math.min(owed, got);
        owed -= used;
        p.cashDelta += got - used;
      }
      if (owed > 0) p.debtUnits += owed / price(room, 'card', e.month);
    }
    p.eventsDone++;
  }
  matureCds(p, month);
  p.cashDelta = round2(p.cashDelta);
  return p;
}

function sellUnits(p, asset, units) {
  const held = p.units[asset] || 0;
  const frac = held ? Math.min(1, units / held) : 0;
  p.cost[asset] = (p.cost[asset] || 0) * (1 - frac);
  p.units[asset] = held - units;
  if (p.units[asset] < 1e-9) { delete p.units[asset]; delete p.cost[asset]; }
}

export class TradeError extends Error {}

// side: 'buy' | 'sell' | 'pay' (pay down card debt). amount: dollars or 'all'.
export function trade(room, player, month, { asset, side, amount, lot }) {
  const p = settle(room, player, month);
  if (!isAvailable(room, asset, month)) throw new TradeError("That investment isn't available yet.");
  const cash = cashOf(p, month);
  if (asset === 'cd') {
    if (side === 'buy') {
      const amt = amount === 'all' ? cash : Number(amount);
      if (!(amt >= 1)) throw new TradeError(cash < 1 ? 'No pocket cash left. Payday is every 6 months.' : 'Enter an amount.');
      if (amt > cash + 0.005) throw new TradeError('Not enough pocket cash.');
      p.cashDelta -= amt;
      p.cds.push({ id: `${month}-${p.trades}`, amount: round2(amt), rate: cdRate(room, month), start: month });
    } else if (side === 'sell') {
      const breaking = lot === 'all' ? p.cds : p.cds.filter((l) => l.id === lot);
      if (!breaking.length) throw new TradeError("You don't have that CD.");
      for (const l of breaking) p.cashDelta += cdBreakValue(l, month);
      p.cds = p.cds.filter((l) => !breaking.includes(l));
    } else {
      throw new TradeError('Bad trade.');
    }
    p.cashDelta = round2(p.cashDelta);
    p.trades++;
    p.v++;
    return p;
  }
  const px = price(room, asset, month);
  if (side === 'pay') {
    if (asset !== 'card') throw new TradeError('Bad trade.');
    const debt = p.debtUnits * px;
    const amt = amount === 'all' ? Math.min(cash, debt) : Math.min(Number(amount), debt);
    if (!(amt > 0)) throw new TradeError(debt > 0 ? 'Not enough pocket cash.' : 'You have no card debt.');
    if (amt > cash + 0.005) throw new TradeError('Not enough pocket cash.');
    p.cashDelta -= amt;
    p.debtUnits = Math.max(0, p.debtUnits - amt / px);
    if (p.debtUnits * px < 0.01) p.debtUnits = 0;
  } else if (side === 'buy') {
    const amt = amount === 'all' ? cash : Number(amount);
    if (!(amt >= 1)) throw new TradeError(cash < 1 ? 'No pocket cash left. Payday is every 6 months.' : 'Enter an amount.');
    if (amt > cash + 0.005) throw new TradeError('Not enough pocket cash.');
    p.cashDelta -= amt;
    p.units[asset] = (p.units[asset] || 0) + amt / px;
    p.cost[asset] = (p.cost[asset] || 0) + amt;
  } else if (side === 'sell') {
    const have = (p.units[asset] || 0) * px;
    const amt = amount === 'all' ? have : Math.min(Number(amount), have);
    if (!(amt > 0)) throw new TradeError("You don't own any.");
    sellUnits(p, asset, amount === 'all' ? p.units[asset] : amt / px);
    p.cashDelta += amt;
  } else {
    throw new TradeError('Bad trade.');
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
    invested += value;
  }
  if (p.cds.length) {
    const lots = p.cds.map((l) => ({
      id: l.id, amount: l.amount, rate: l.rate, value: round2(cdValue(l, month)),
      breakValue: round2(cdBreakValue(l, month)), maturesIn: l.start + CD_TERM - month,
    }));
    const value = round2(lots.reduce((t, l) => t + l.value, 0));
    holdings.cd = { value, cost: round2(lots.reduce((t, l) => t + l.amount, 0)), lots };
    invested += value;
  }
  const debt = round2(p.debtUnits * price(room, 'card', month));
  return {
    cash, debt, holdings, matured: p.matured,
    netWorth: round2(cash + invested - debt),
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
    if (i.id === 'cd') {
      const rates = [];
      for (let m = Math.max(0, month - HISTORY); m <= month; m++) rates.push(Number((cdRate(room, m) * 100).toFixed(2)));
      return { id: 'cd', unlocked, rate: unlocked ? rates[rates.length - 1] : null, history: unlocked ? rates : [], term: CD_TERM, penaltyMonths: CD_PENALTY_MONTHS };
    }
    return { id: i.id, unlocked, price: unlocked ? round2(price(room, i.id, month)) : null, history: unlocked ? series(room, i.id, 0, month) : [] };
  });
  const stocks = [];
  if (month >= STOCKS_UNLOCK) {
    for (const s of STOCKS) {
      const lm = stockListedMonth(room, s);
      if (month < lm) continue;
      stocks.push({ id: s.id, name: s.name, blurb: blurbFor(room, s), listedMonth: lm, price: round2(price(room, s.id, month)), history: series(room, s.id, lm, month) });
    }
  }
  return { assets, stocks };
}

export function news(room, month) {
  const out = [];
  const k0 = startIndex(room);
  // Game month m is calendar month m+1 of the first year (month 0 = January),
  // priced as of the start of that month. A month's headline appears once its
  // prices have landed, so news never tips anyone off before the market moves.
  for (let m = 1; m <= month; m++) {
    const c = m - 1;
    const key = `${room.startYear + Math.floor(c / 12)}-${String((c % 12) + 1).padStart(2, '0')}`;
    if (HEADLINES[key]) out.push({ month: m, kind: 'news', text: HEADLINES[key], at: c });
  }
  for (const s of STOCKS) {
    const lm = s.listed - k0;
    if (lm > STOCKS_UNLOCK && lm <= month) out.push({ month: lm, kind: 'listing', text: `New on the market: ${s.name}. ${blurbFor(room, s)}` });
  }
  for (const e of room.events) {
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
    for (let m = 0; m < end; m += PAY_EVERY) units += PAYCHECK / price(room, asset, m);
    return round2(units * price(room, asset, end));
  };
  let inflation = 1;
  for (let y = room.startYear; y < room.startYear + years; y++) inflation *= 1 + CPI[y - FIRST_YEAR];
  const stocks = STOCKS.filter((s) => stockListedMonth(room, s) < end && s.listed - k0 <= end).map((s) => {
    const lm = stockListedMonth(room, s);
    return { id: s.id, name: s.name, real: REAL_NAMES[s.ticker] || s.ticker, ticker: s.ticker, change: round2(price(room, s.id, end) / price(room, s.id, lm) - 1) };
  });
  // What really happened, with the real dates.
  const MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const timeline = [];
  for (let c = 0; c < end; c++) {
    const y = room.startYear + Math.floor(c / 12);
    const key = `${y}-${String((c % 12) + 1).padStart(2, '0')}`;
    if (HEADLINES[key]) timeline.push({ date: `${MONTH_NAMES_LONG[c % 12]} ${y}`, text: HEADLINES[key] });
  }
  return {
    startYear: room.startYear,
    endYear: room.startYear + years - 1,
    endedEarly: end < GAME_MONTHS,
    contributed: Math.min(GAME_MONTHS / PAY_EVERY, Math.floor((end - 1) / PAY_EVERY) + 1) * PAYCHECK,
    benchmarks: {
      savings: strategy('savings'),
      treasury: strategy('treasury'),
      index: strategy('index'),
      gold: strategy('gold'),
    },
    inflation: round2(inflation),
    stocks,
    timeline,
  };
}

export const REAL_NAMES = {
  KO: 'Coca-Cola', AAPL: 'Apple', MSFT: 'Microsoft', IBM: 'IBM', GE: 'General Electric', XOM: 'Exxon Mobil',
  WMT: 'Walmart', MCD: "McDonald's", DIS: 'Disney', NKE: 'Nike', INTC: 'Intel', HPQ: 'Hewlett-Packard',
  XRX: 'Xerox', F: 'Ford', BA: 'Boeing', HD: 'Home Depot', JNJ: 'Johnson & Johnson', PG: 'Procter & Gamble',
  C: 'Citigroup', AIG: 'AIG', CSCO: 'Cisco', SBUX: 'Starbucks', AMZN: 'Amazon', NVDA: 'Nvidia',
  NFLX: 'Netflix', GOOGL: 'Google',
};
