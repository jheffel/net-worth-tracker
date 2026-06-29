const axios = require('axios');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const STOCK_DB = path.join(__dirname, '../db/stock.db');
const FX_DB = path.join(__dirname, '../db/exchange_rates.db');

const loadingStatus = { message: '', active: false };

function setStatus(msg) {
  loadingStatus.message = msg;
  loadingStatus.active = true;
}

function clearStatus() {
  loadingStatus.active = false;
  loadingStatus.message = '';
}

const EXCHANGE_SUFFIXES = ['.TO', '.V', '.L', '.DE', '.PA', '.AS', '.BR', '.MI', '.MC', '.CO', '.ST', '.OL', '.HE', '.IR', '.AX', '.NZ', '.HK', '.SI', '.TWO', '.SS', '.KS', '.NSE'];

function isExchangeTicker(ticker) {
  const upper = ticker.toUpperCase();
  return EXCHANGE_SUFFIXES.some(s => upper.endsWith(s));
}

function openDb(dbPath) {
  const db = new sqlite3.Database(dbPath);
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA busy_timeout=5000');
  return db;
}

function initStockDb() {
  const dir = path.dirname(STOCK_DB);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = openDb(STOCK_DB);
  db.run(`CREATE TABLE IF NOT EXISTS stock_prices (
    date TEXT, symbol TEXT, currency TEXT, price REAL,
    PRIMARY KEY (date, symbol)
  )`, (err) => { if (err) console.error('[fetchPrices] init stock_db error:', err.message); db.close(); });
}

function initFxDb() {
  const dir = path.dirname(FX_DB);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = openDb(FX_DB);
  db.run(`CREATE TABLE IF NOT EXISTS exchange_rates (
    date TEXT, base_currency TEXT, target_currency TEXT, rate REAL,
    PRIMARY KEY (date, base_currency, target_currency)
  )`, (err) => { if (err) console.error('[fetchPrices] init fx_db error:', err.message); db.close(); });
}

initStockDb();
initFxDb();

const BATCH_SIZE = 3;

async function runBatch(tasks, batchSize = BATCH_SIZE) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map(t => t().catch(err => {
      console.error('[fetchPrices] Batch task error:', err.message);
      return null;
    }));
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  return results;
}

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function storeStockPrices(prices) {
  return new Promise((resolve, reject) => {
    const db = openDb(STOCK_DB);
    db.on('error', (err) => { console.error('[fetchPrices] stock DB error:', err.message); });
    db.serialize(async () => {
      try {
        await dbRun(db, 'BEGIN');
        let errCount = 0;
        for (const p of prices) {
          try {
            await dbRun(db, 'INSERT OR REPLACE INTO stock_prices (date, symbol, currency, price) VALUES (?, ?, ?, ?)',
              [p.date, p.symbol, p.currency, p.price]);
          } catch (e) { errCount++; }
        }
        await dbRun(db, 'COMMIT');
        if (errCount) console.error(`[fetchPrices] ${errCount} insert errors in stock_prices`);
        resolve(prices);
      } catch (e) {
        try { await dbRun(db, 'ROLLBACK'); } catch (_) { }
        console.error('[fetchPrices] Transaction error in stock_prices:', e.message);
        resolve(prices);
      } finally {
        db.close();
      }
    });
  });
}

function storeFxRates(rates) {
  return new Promise((resolve, reject) => {
    const db = openDb(FX_DB);
    db.on('error', (err) => { console.error('[fetchPrices] FX DB error:', err.message); });
    db.serialize(async () => {
      try {
        await dbRun(db, 'BEGIN');
        for (const r of rates) {
          try {
            await dbRun(db, 'INSERT OR REPLACE INTO exchange_rates (date, base_currency, target_currency, rate) VALUES (?, ?, ?, ?)',
              [r.date, r.base, r.target, r.rate]);
          } catch (e) { /* skip failed rows */ }
        }
        await dbRun(db, 'COMMIT');
        resolve(rates);
      } catch (e) {
        try { await dbRun(db, 'ROLLBACK'); } catch (_) { }
        console.error('[fetchPrices] Transaction error in exchange_rates:', e.message);
        resolve(rates);
      } finally {
        db.close();
      }
    });
  });
}

function getExistingStockDates(symbol) {
  return new Promise((resolve, reject) => {
    const db = openDb(STOCK_DB);
    db.on('error', () => { });
    db.all('SELECT date FROM stock_prices WHERE symbol = ?', [symbol], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(new Set(rows.map(r => r.date)));
    });
  });
}

function getExistingFxDates(base, target) {
  return new Promise((resolve, reject) => {
    const db = openDb(FX_DB);
    db.on('error', () => { });
    db.all('SELECT date FROM exchange_rates WHERE base_currency = ? AND target_currency = ?', [base, target], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(new Set(rows.map(r => r.date)));
    });
  });
}

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';

async function fetchYahooPrices(ticker, startDate, endDate) {
  const period1 = Math.floor(new Date(startDate).getTime() / 1000);
  const period2 = Math.floor(new Date(endDate).getTime() / 1000) + 86400;

  const prices = await tryFetch(ticker.toUpperCase(), ticker, period1, period2);
  if (prices.length > 0) return prices;

  if (!isExchangeTicker(ticker)) {
    const cryptoFallback = `${ticker.toUpperCase()}-USD`;
    console.log(`[fetchPrices] No data for ${ticker}, trying as crypto: ${cryptoFallback}`);
    return await tryFetch(cryptoFallback, ticker, period1, period2);
  }
  return [];
}

async function tryFetch(yahooSymbol, originalTicker, period1, period2) {
  let response;
  try {
    response = await axios.get(`${YAHOO_CHART}/${encodeURIComponent(yahooSymbol)}`, {
      params: { period1, period2, interval: '1d' },
      timeout: 30000,
    });
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`[fetchPrices] Symbol not found on Yahoo Finance: ${yahooSymbol}`);
    } else {
      console.error(`[fetchPrices] Yahoo Finance error for ${yahooSymbol}:`, err.message);
    }
    return [];
  }

  const result = response.data?.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  const currency = result.meta?.currency || 'USD';
  const closes = quotes?.close || [];

  const prices = [];
  for (let i = 0; i < timestamps.length; i++) {
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    if (closes[i] != null) {
      prices.push({ date, symbol: originalTicker.toUpperCase(), currency, price: closes[i] });
    }
  }
  return prices;
}

const FRANKFURTER = 'https://api.frankfurter.app';

async function fetchFxRates(base, target, startDate, endDate) {
  if (base === target) return [];
  const url = `${FRANKFURTER}/${startDate}..${endDate}?from=${base}&to=${target}`;
  let response;
  try {
    response = await axios.get(url, { timeout: 30000 });
  } catch (err) {
    console.error(`[fetchPrices] Frankfurter error for ${base}->${target}:`, err.message);
    return [];
  }

  const rates = response.data?.rates;
  if (!rates) return [];

  const result = [];
  for (const [date, rateObj] of Object.entries(rates)) {
    const rate = rateObj[target];
    if (rate != null) {
      result.push({ date, base, target, rate });
    }
  }
  return result;
}

async function ensureStockPrices(ticker, neededDates) {
  const existing = await getExistingStockDates(ticker.toUpperCase());
  const missing = neededDates.filter(d => !existing.has(d));
  if (missing.length === 0) return;

  missing.sort();
  const startDate = missing[0];
  const endDate = missing[missing.length - 1];
  setStatus(`Fetching ${missing.length} days of prices for ${ticker}...`);
  console.log(`[fetchPrices] Fetching ${missing.length} missing stock prices for ${ticker} (${startDate} to ${endDate})`);

  const prices = await fetchYahooPrices(ticker, startDate, endDate);
  const toStore = prices.filter(p => missing.includes(p.date));
  if (toStore.length > 0) {
    await storeStockPrices(toStore);
    console.log(`[fetchPrices] Stored ${toStore.length} prices for ${ticker}`);
  }
}

async function ensureCryptoRates(ticker, neededDates) {
  const existing = await getExistingFxDates(ticker.toUpperCase(), 'CAD');
  const missing = neededDates.filter(d => !existing.has(d));
  if (missing.length === 0) return;

  missing.sort();
  const startDate = missing[0];
  const endDate = missing[missing.length - 1];
  setStatus(`Fetching ${missing.length} days of rates for ${ticker}...`);
  console.log(`[fetchPrices] Fetching ${missing.length} missing crypto rates for ${ticker} (${startDate} to ${endDate})`);

  const prices = await fetchYahooPrices(ticker, startDate, endDate);
  if (prices.length === 0) return;

  let usdCadRate = 1;
  const fxResult = await fetchFxRates('USD', 'CAD', missing[0], missing[missing.length - 1]);
  const usdCadMap = {};
  fxResult.forEach(r => { usdCadMap[r.date] = r.rate; });

  const rates = [];
  for (const p of prices) {
    if (!missing.includes(p.date)) continue;
    const usdRate = usdCadMap[p.date];
    if (usdRate) usdCadRate = usdRate;
    const cadPrice = p.price * usdCadRate;
    rates.push({ date: p.date, base: ticker.toUpperCase(), target: 'CAD', rate: cadPrice });
  }

  if (rates.length > 0) {
    await storeFxRates(rates);
    console.log(`[fetchPrices] Stored ${rates.length} crypto rates for ${ticker}->CAD`);
  }
}

async function ensureFxRates(base, target, neededDates) {
  if (base === target) return;
  const existing = await getExistingFxDates(base, target);
  const missing = neededDates.filter(d => !existing.has(d));
  if (missing.length === 0) return;

  missing.sort();
  const startDate = missing[0];
  const endDate = missing[missing.length - 1];
  setStatus(`Fetching FX rates ${base}->${target}...`);
  console.log(`[fetchPrices] Fetching ${missing.length} missing FX rates for ${base}->${target} (${startDate} to ${endDate})`);

  const rates = await fetchFxRates(base, target, startDate, endDate);
  const toStore = rates.filter(r => missing.includes(r.date));
  if (toStore.length > 0) {
    await storeFxRates(toStore);
    console.log(`[fetchPrices] Stored ${toStore.length} FX rates for ${base}->${target}`);
  }
}

module.exports = { ensureStockPrices, ensureCryptoRates, ensureFxRates, loadingStatus, runBatch, setStatus, clearStatus };
