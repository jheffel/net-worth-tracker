const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const bcrypt = require('bcrypt');

const { getNearestPrice, getAllPricesForSymbol } = require('./stocks');
const { convertBalance } = require('./convert');

class Database {
  constructor() {
    this._accountBalancesCache = new Map();
    this.dbPath = path.join(__dirname, '../db/finance.db');
    this.ensureDataDirectory();
    this.init();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  // Invalidate the cache
  invalidateCache() {
    this._accountBalancesCache.clear();
  }

  init() {
    this.db = new sqlite3.Database(this.dbPath);

    // Create tables
    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Account balances table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS account_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_name TEXT,
          date TEXT,
          balance REAL,
          currency TEXT,
          ticker TEXT,
          user_id INTEGER,
          UNIQUE (account_name, date, currency, ticker, user_id),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `, async (err) => {
        if (!err) {
          // Check for user_id column existence and migrate if needed
          this.checkAndMigrateSchema();
        }
      });

      // Settings table (global for simplicity, or could be per user if needed later)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // Insert default main currency
      this.db.run(`
        INSERT OR IGNORE INTO settings (key, value) VALUES ('main_currency', 'CAD')
      `);

      // Account groups table (per user)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS account_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          group_type TEXT NOT NULL,
          account_name TEXT NOT NULL,
          UNIQUE(user_id, group_type, account_name),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);
    });
  }

  checkAndMigrateSchema() {
    // Check if user_id column exists
    this.db.all("PRAGMA table_info(account_balances)", async (err, rows) => {
      if (err) return console.error('Error checking schema:', err);

      const hasUserId = rows.some(r => r.name === 'user_id');

      if (!hasUserId) {
        console.log('Migrating database: Adding user_id column...');
        this.db.run("ALTER TABLE account_balances ADD COLUMN user_id INTEGER", async (alterErr) => {
          if (alterErr) return console.error('Error adding user_id:', alterErr);
          await this.migrateOrphanData();
        });
      } else {
        // Even if column exists, check for NULL user_ids
        await this.migrateOrphanData();
      }
    });
  }

  async migrateOrphanData() {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT COUNT(*) as count FROM account_balances WHERE user_id IS NULL", async (err, row) => {
        if (err) return reject(err);
        if (row.count > 0) {
          console.log(`Found ${row.count} orphan records. Assigning to default admin user.`);
          try {
            let admin = await this.getUserByUsername('admin');
            if (!admin) {
              const hash = await bcrypt.hash('admin', 10);
              const result = await this.createUser('admin', hash);
              admin = { id: result.id };
              console.log('Created default admin user (password: admin).');
            }

            this.db.run("UPDATE account_balances SET user_id = ? WHERE user_id IS NULL", [admin.id], (updateErr) => {
              if (updateErr) console.error('Error migrating data:', updateErr);
              else console.log('Successfully migrated orphan data.');
              resolve();
            });
          } catch (e) {
            console.error('Migration failed:', e);
            reject(e);
          }
        } else {
          resolve();
        }
      });
    });
  }

  // User operations
  async createUser(username, passwordHash) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        [username, passwordHash],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, username });
        }
      );
    });
  }

  async getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT id, username, created_at FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Account operations
  async addBalance(userId, accountName, date, balance, currency, ticker = '') {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO account_balances (account_name, date, balance, currency, ticker, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [accountName, date, balance, currency, ticker, userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    }).then((result) => {
      this.invalidateCache();
      return result;
    });
  }

  async getAllAccounts(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT DISTINCT account_name FROM account_balances WHERE user_id = ? ORDER BY account_name',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.account_name));
        }
      );
    });
  }

  async getAccountBalances(userId, startDate = null, endDate = null, accounts = null, targetCurrency = 'CAD') {
    const cacheKey = JSON.stringify({ userId, startDate, endDate, accounts, targetCurrency });
    if (this._accountBalancesCache.has(cacheKey)) {
      return this._accountBalancesCache.get(cacheKey);
    }

    // Small helpers for dates
    const toISO = (d) => new Date(d).toISOString().slice(0, 10);
    const addDaysStr = (dateStr, days) => {
      const t = new Date(dateStr).getTime() + days * 24 * 60 * 60 * 1000;
      return new Date(t).toISOString().slice(0, 10);
    };

    // Memoized FX rates and ticker prices for this invocation
    const fxRateCache = new Map(); // key: from|to|date => rate (for balance=1)
    const getFxRate = async (from, to, date) => {
      if (from === to) return 1;
      const key = `${from}|${to}|${date}`;
      if (fxRateCache.has(key)) return fxRateCache.get(key);
      const rate = await convertBalance({ balance: 1, currency: from, date }, to);
      fxRateCache.set(key, rate);
      return rate;
    };

    // Load all prices for a ticker once, then binary search the last known <= date (strictly previous)
    const tickerCache = new Map(); // ticker => { dates: string[], prices: number[] }
    const getTickerRatePrev = async (ticker, date) => {
      if (!ticker) return 1;
      if (!tickerCache.has(ticker)) {
        const rows = await getAllPricesForSymbol(ticker);
        const sorted = (rows || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
        tickerCache.set(
          ticker,
          {
            dates: sorted.map(r => String(r.date)),
            prices: sorted.map(r => Number(r.price))
          }
        );
      }
      const { dates, prices } = tickerCache.get(ticker);
      if (!dates.length) return 1;
      // binary search for last index <= date
      let lo = 0, hi = dates.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (dates[mid] <= date) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      if (ans < 0) return 1; // no previous price exists; avoid future lookahead
      return prices[ans];
    };

    return new Promise((resolve, reject) => {
      let query = 'SELECT account_name, date, balance, currency, ticker FROM account_balances WHERE user_id = ?';
      const params = [userId];
      const conditions = [];

      if (startDate) {
        conditions.push('date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('date <= ?');
        params.push(endDate);
      }
      if (accounts && accounts.length > 0) {
        const placeholders = accounts.map(() => '?').join(',');
        conditions.push(`account_name IN (${placeholders})`);
        params.push(...accounts);
      }
      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }
      query += ' ORDER BY account_name, date';

      this.db.all(query, params, async (err, rows) => {
        if (err) return reject(err);

        if (!rows || rows.length === 0) {
          this._accountBalancesCache.set(cacheKey, {});
          return resolve({});
        }

        // Determine effective range
        const today = new Date().toISOString().slice(0, 10);
        const minRowDate = rows.reduce((m, r) => (m && m < r.date ? m : r.date), rows[0].date);
        const maxRowDate = rows.reduce((m, r) => (m && m > r.date ? m : r.date), rows[0].date);
        const rangeStart = startDate || minRowDate;
        const rangeEnd = endDate || (today > maxRowDate ? today : maxRowDate);

        // Build per-series maps: (account|currency|ticker) -> Map(date => balance sum)
        const seriesMap = new Map();
        const seriesKey = (a, c, t) => `${a}|||${c}|||${t || ''}`;
        for (const r of rows) {
          const key = seriesKey(r.account_name, r.currency, r.ticker || '');
          let m = seriesMap.get(key);
          if (!m) { m = new Map(); seriesMap.set(key, m); }
          m.set(r.date, (m.get(r.date) || 0) + Number(r.balance));
        }

        // Preload groups once
        const groups = await this.getAccountGroups(userId);

        const result = {};

        // Iterate each series and accumulate into account totals with linear interpolation and memoized rates
        for (const [key, dateMap] of seriesMap) {
          const [account, currency, ticker] = key.split('|||');

          // Sort known dates for this series
          const knownDates = Array.from(dateMap.keys()).sort();
          if (knownDates.length === 0) continue;
          const firstKnown = knownDates[0];
          const lastKnownDate = knownDates[knownDates.length - 1];
          const knownBalances = knownDates.map(d => Number(dateMap.get(d)));
          // j points to segment [knownDates[j], knownDates[j+1]] containing d (if any)
          let j = 0;

          // Sweep the requested date range:
          // - For non-ticker series: linear interpolation between known points
          // - For ticker series: step (forward-fill) between known points (shares/units stay constant until a trade)
          for (let d = rangeStart; d <= rangeEnd; d = addDaysStr(d, 1)) {
            let balance;
            if (dateMap.has(d)) {
              balance = Number(dateMap.get(d));
              // keep j in sync if we just hit a knot
              while (j < knownDates.length - 1 && knownDates[j + 1] <= d) j++;
            } else if (d <= firstKnown) {
              // backward fill to start
              balance = knownBalances[0];
            } else if (d >= lastKnownDate) {
              // forward fill after last known
              balance = knownBalances[knownBalances.length - 1];
            } else {
              // ensure j is the left index for segment containing d
              while (j < knownDates.length - 1 && knownDates[j + 1] <= d) j++;
              // now knownDates[j] < d < knownDates[j+1]
              const leftDate = knownDates[j];
              const rightDate = knownDates[j + 1];
              const leftVal = knownBalances[j];
              const rightVal = knownBalances[j + 1];
              if (ticker) {
                // Step behavior: keep previous quantity until next known point
                balance = leftVal;
              } else {
                // Linear interpolation for non-ticker series
                const totalDays = (new Date(rightDate) - new Date(leftDate)) / (1000 * 60 * 60 * 24);
                const daysSinceLeft = (new Date(d) - new Date(leftDate)) / (1000 * 60 * 60 * 24);
                balance = leftVal + (rightVal - leftVal) * (daysSinceLeft / totalDays);
              }
            }
            // Only output for dates >= firstKnown
            if (d < firstKnown) continue;

            // Apply ticker price if present
            const tickerRate = ticker ? await getTickerRatePrev(ticker, d) : 1;
            let converted = balance * tickerRate;

            // Convert to target currency with memoized FX
            if (currency !== targetCurrency) {
              const toCad = await getFxRate(currency, 'CAD', d);
              const cadToTarget = await getFxRate('CAD', targetCurrency, d);
              if (toCad != null && cadToTarget != null) {
                converted = converted * toCad * cadToTarget;
              } else if (toCad != null && targetCurrency === 'CAD') {
                converted = converted * toCad;
              } else if (cadToTarget != null && currency === 'CAD') {
                converted = converted * cadToTarget;
              } // else leave as-is (best-effort fallback)
            }

            if (!result[account]) result[account] = {};
            result[account][d] = (result[account][d] || 0) + converted;
          }
        }

        // Compute group totals after account totals (faster, one pass per group)
        for (const groupName of Object.keys(groups)) {
          const members = groups[groupName] || [];
          if (!members.length) continue;
          for (const member of members) {
            const accDates = result[member];
            if (!accDates) continue;
            for (const [d, val] of Object.entries(accDates)) {
              if (!result[groupName]) result[groupName] = {};
              result[groupName][d] = (result[groupName][d] || 0) + val;
            }
          }
        }

        this._accountBalancesCache.set(cacheKey, result);
        return resolve(result);
      });
    });
  }

  async getPieChartData(userId, type, date) {
    return new Promise((resolve, reject) => {
      // Get account groups based on type
      // Use an internal promise wrapper since getAccountGroups is async
      this.getAccountGroups(userId).then(groups => {
        const accountGroups = groups[type] || [];

        if (!accountGroups || accountGroups.length === 0) {
          resolve({ labels: [], data: [], total: 0 });
          return;
        }

        const placeholders = accountGroups.map(() => '?').join(',');
        const query = `
              SELECT account_name, balance, currency 
              FROM account_balances 
              WHERE account_name IN (${placeholders}) 
              AND date = ?
              AND balance != 0
              AND user_id = ?
            `;

        // Add date and user_id to params
        const params = [...accountGroups, date, userId];

        this.db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else {
            const labels = rows.map(row => row.account_name);
            const data = rows.map(row => Math.abs(row.balance));
            const total = data.reduce((sum, val) => sum + val, 0);

            resolve({ labels, data, total });
          }
        });
      }).catch(reject);
    });
  }

  getAccountGroupsByType(type) {
    // Legacy method, kept for reference if needed, but getAccountGroups is preferred
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(__dirname, '../config');
    const filePath = path.join(configDir, `${type}.txt`);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      }
    } catch (e) {
      console.error(`Error reading group file for ${type}:`, e);
    }
    return [];
  }

  async getAccountGroups(userId) {
    return new Promise((resolve, reject) => {
      // 1. Get all distinct accounts for this user (for 'networth')
      this.getAllAccounts(userId).then(allAccounts => {
        // 2. Get user-defined groups from DB
        this.db.all(
          'SELECT group_type, account_name FROM account_groups WHERE user_id = ?',
          [userId],
          (err, rows) => {
            if (err) return reject(err);

            const groups = {
              operating: [],
              investing: [],
              crypto: [],
              equity: [],
              summary: [],
              ignoreForTotal: [], // special "group" for ignoring
              networth: allAccounts,
              total: []
            };

            // Populate from DB
            rows.forEach(r => {
              if (!groups[r.group_type]) groups[r.group_type] = [];
              groups[r.group_type].push(r.account_name);
            });

            // Calculate 'total' = networth - ignoreForTotal
            const ignoreList = groups['ignoreForTotal'] || [];
            groups['total'] = allAccounts.filter(acc => !ignoreList.includes(acc));

            resolve(groups);
          }
        );
      }).catch(reject);
    });
  }

  async updateAccountGroup(userId, groupType, accounts) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');

        // Delete existing entries for this group type
        this.db.run(
          'DELETE FROM account_groups WHERE user_id = ? AND group_type = ?',
          [userId, groupType],
          (err) => {
            if (err) {
              this.db.run('ROLLBACK');
              return reject(err);
            }

            if (accounts.length === 0) {
              this.db.run('COMMIT');
              return resolve();
            }

            // Insert new entries
            const placeholders = accounts.map(() => '(?, ?, ?)').join(',');
            const params = [];
            accounts.forEach(acc => {
              params.push(userId, groupType, acc);
            });

            this.db.run(
              `INSERT INTO account_groups (user_id, group_type, account_name) VALUES ${placeholders}`,
              params,
              (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  return reject(err);
                }
                this.db.run('COMMIT');
                resolve();
              }
            );
          }
        );
      });
    });
  }


  async getAvailableCurrencies() {
    const currencyFiles = [
      path.join(__dirname, '../config/available_currency.txt'),
      path.join(__dirname, '../config/available_crypto.txt')
    ];
    let all = [];
    for (const file of currencyFiles) {
      try {
        // console.log('[getAvailableCurrencies] Reading:', file);
        const txt = await fsPromises.readFile(file, 'utf8');
        // console.log(`[getAvailableCurrencies] Content of ${file}:`, JSON.stringify(txt));
        const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        // console.log(`[getAvailableCurrencies] Parsed lines:`, lines);
        all = all.concat(lines);
      } catch (e) {
        console.error(`[getAvailableCurrencies] Error reading ${file}:`, e.message);
      }
    }
    // Remove duplicates and empty
    const result = Array.from(new Set(all)).filter(Boolean);
    // console.log('[getAvailableCurrencies] Final result:', result);
    return result;
  }

  async getMainCurrency() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['main_currency'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.value : 'CAD');
        }
      );
    });
  }

  async setMainCurrency(currency) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['main_currency', currency],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getNetWorthSummary(userId, startDate = null, endDate = null, accounts = null) {
    const main = await this.getMainCurrency();
    const balances = await this.getAccountBalances(userId, startDate, endDate, accounts, main);
    // Calculate totals for each date (balances shape: { account: { date: number } })
    const summary = {};
    for (const [account, dates] of Object.entries(balances)) {
      for (const [date, value] of Object.entries(dates)) {
        if (!summary[date]) summary[date] = { total: 0, accounts: {} };
        summary[date].total += Number(value) || 0;
        summary[date].accounts[account] = Number(value) || 0;
      }
    }
    return summary;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
