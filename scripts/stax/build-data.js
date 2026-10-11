// Builds api/_lib/stax-data.js: monthly value indexes for every investment in Stax,
// from real history.
//   node scripts/stax/build-data.js
//
// Sources
// - annual-returns.csv: yearly total returns from Aswath Damodaran (NYU Stern),
//   "Historical Returns on Stocks, Bonds, Bills..." (histretSP.xls).
//   S&P 500 incl. dividends, 3-month T-bill, 10-year T-bond, Baa corporate
//   bonds, US home prices, gold, and CPI inflation.
// - rates.csv: monthly rates from the Federal Reserve's H.15 release.
//   CDs: the 6-month CD rate (secondary market) through June 2013, when the
//   Fed stopped publishing it, then the 1-year Treasury yield.
//   Government bonds: 1-month, 3-month and 1-year Treasury yields. The
//   1-month series starts in July 2001; before that we use the 3-month.
//   Credit cards (for late bills): the Fed's G.19 commercial bank rate on
//   credit card plans, all accounts (quarterly, from Nov 1994), and before
//   that the yearly averages in the Fed's 2014 Report to the Congress on the
//   Profitability of Credit Card Operations.
// - Yahoo Finance monthly closes: the S&P 500 (^GSPC) for the month-to-month
//   shape of the index fund, and dividend/split-adjusted closes for each
//   company in companies.js.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { COMPANIES } from './companies.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FIRST_YEAR = 1985; // Yahoo's monthly history for most companies starts here
const LAST_YEAR = 2025;
const MONTHS = (LAST_YEAR - FIRST_YEAR + 1) * 12; // index[0] = end of Dec FIRST_YEAR-1

async function annual() {
  const text = await fs.readFile(path.join(ROOT, 'scripts/stax/annual-returns.csv'), 'utf8');
  const [head, ...rows] = text.trim().split('\n');
  const cols = head.split(',');
  const out = {};
  for (const row of rows) {
    const v = row.split(',');
    const rec = {};
    cols.forEach((c, i) => { rec[c] = Number(v[i]); });
    out[rec.year] = rec;
  }
  return out;
}

async function yahoo(symbol) {
  const p1 = Date.UTC(FIRST_YEAR - 1, 11, 1) / 1000;
  const p2 = Date.UTC(LAST_YEAR + 1, 0, 1) / 1000;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1mo`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const r = (await res.json()).chart.result[0];
  const closes = (r.indicators.adjclose?.[0]?.adjclose) || r.indicators.quote[0].close;
  // Month k of our index = month-end close of that calendar month.
  const byMonth = new Array(MONTHS + 1).fill(null);
  r.timestamp.forEach((ts, i) => {
    const d = new Date((ts + 14 * 86400) * 1000); // bars are stamped at the 1st, local exchange time
    const k = (d.getUTCFullYear() - FIRST_YEAR) * 12 + d.getUTCMonth() + 1;
    if (k >= 0 && k <= MONTHS && closes[i] != null) byMonth[k] = closes[i];
  });
  return byMonth;
}

// Smooth monthly path that compounds to each year's return.
function smooth(years, key) {
  const idx = [1];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    const m = Math.pow(1 + years[y][key], 1 / 12);
    for (let i = 0; i < 12; i++) idx.push(idx[idx.length - 1] * m);
  }
  return idx;
}

// Real monthly ups and downs of the S&P 500, scaled so each calendar year
// lands exactly on its total return (price moves + dividends).
function indexFund(years, gspc) {
  const idx = [1];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
    const base = (y - FIRST_YEAR) * 12;
    const priceRatio = gspc[base + 12] / gspc[base];
    const k = Math.pow((1 + years[y].sp500) / priceRatio, 1 / 12);
    for (let i = 1; i <= 12; i++) {
      idx.push(idx[base] * (gspc[base + i] / gspc[base]) * Math.pow(k, i));
    }
  }
  return idx;
}

const round = (a) => a.map((v) => (v == null ? null : Number(v.toPrecision(6))));

async function main() {
  const years = await annual();
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) if (!years[y]) throw new Error(`missing year ${y}`);

  const gspc = await yahoo('^GSPC');
  // Yahoo's monthly ^GSPC starts in Jan 1985; S&P 500 close on 12/31/1984.
  if (gspc[0] == null) gspc[0] = 167.24;
  if (gspc.some((v) => v == null)) throw new Error('^GSPC has gaps');

  const assets = {
    savings: round(smooth(years, 'tbill')),
    index: round(indexFund(years, gspc)),
    realestate: round(smooth(years, 'realestate')),
    gold: round(smooth(years, 'gold')),
  };

  const stocks = [];
  for (const c of COMPANIES) {
    const raw = await yahoo(c.ticker);
    const first = raw.findIndex((v) => v != null);
    // Fill any single-month gaps with the previous close.
    for (let k = first + 1; k <= MONTHS; k++) if (raw[k] == null) raw[k] = raw[k - 1];
    const norm = raw.map((v) => (v == null ? null : v / raw[first]));
    stocks.push({ ...c, listed: first, prices: round(norm) });
    console.log(`${c.ticker.padEnd(6)} listed month ${first} (${FIRST_YEAR + Math.floor((first - 1) / 12)})`);
    await new Promise((r) => setTimeout(r, 250));
  }

  // Rates for each index month k (the average for calendar month k).
  const rateText = await fs.readFile(path.join(ROOT, 'scripts/stax/rates.csv'), 'utf8');
  const [rateHead, ...rateRows] = rateText.trim().split('\n');
  const rcols = rateHead.split(',');
  const byMonth = {};
  for (const row of rateRows) {
    const v = row.split(',');
    const rec = {};
    rcols.forEach((c, i) => { rec[c] = v[i] === '' || v[i] == null ? null : Number(v[i]) / 100; });
    byMonth[v[0]] = rec;
  }
  const pick = (rec, ...keys) => { for (const k of keys) if (rec?.[k] != null) return rec[k]; return null; };
  const rates = { cd: [], b1: [], b3: [], b12: [], card: [] };
  for (let k = 0; k <= MONTHS; k++) {
    const y = FIRST_YEAR + Math.floor((k - 1) / 12);
    const m = ((k - 1) % 12 + 12) % 12 + 1;
    const rec = byMonth[`${y}-${String(m).padStart(2, '0')}`];
    rates.cd.push(pick(rec, 'cd6m', 'tsy1y'));
    rates.b1.push(pick(rec, 'tsy1m', 'tsy3m'));
    rates.b3.push(pick(rec, 'tsy3m', 'bill3m'));
    rates.b12.push(pick(rec, 'tsy1y'));
    rates.card.push(pick(rec, 'card'));
  }
  for (const [key, arr] of Object.entries(rates)) {
    if (arr.slice(12).some((v) => v == null)) throw new Error(`${key} rates have gaps`);
  }

  const cpi = [];
  for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) cpi.push(Number(years[y].cpi.toFixed(5)));

  const out = `// Generated by scripts/stax/build-data.js — do not edit by hand.
// Monthly value indexes; month 0 is the end of December ${FIRST_YEAR - 1}.
export const FIRST_YEAR = ${FIRST_YEAR};
export const LAST_YEAR = ${LAST_YEAR};
export const ASSET_INDEX = ${JSON.stringify(assets)};
export const STOCKS = ${JSON.stringify(stocks)};
export const CPI = ${JSON.stringify(cpi)};
// Annual rates (decimal) for each month: CDs, 1-month, 3-month and 1-year
// government bonds, and the average credit card rate. null where there's no data.
export const RATES = ${JSON.stringify(rates)};
`;
  await fs.mkdir(path.join(ROOT, 'api/_lib'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'api/_lib/stax-data.js'), out);
  console.log(`wrote api/_lib/stax-data.js (${(out.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
