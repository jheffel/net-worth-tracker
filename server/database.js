const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

class Database {
  constructor() {
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

  init() {
    this.db = new sqlite3.Database(this.dbPath);
    
    // Create tables
    this.db.serialize(() => {
      // Account balances table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS account_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_name TEXT NOT NULL,
          date TEXT NOT NULL,
          balance REAL NOT NULL,
          currency TEXT NOT NULL,
          ticker TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Settings table
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
    });
  }

  // Account operations
  async addBalance(accountName, date, balance, currency, ticker = '') {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO account_balances (account_name, date, balance, currency, ticker) VALUES (?, ?, ?, ?, ?)',
        [accountName, date, balance, currency, ticker],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getAllAccounts() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT DISTINCT account_name FROM account_balances ORDER BY account_name',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.account_name));
        }
      );
    });
  }

  async getAccountBalances(startDate = null, endDate = null, accounts = null, targetCurrency = 'CAD') {
    return new Promise((resolve, reject) => {
      let query = 'SELECT account_name, date, balance, currency, ticker FROM account_balances';
      let params = [];
      let conditions = [];

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
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY date, account_name';

      this.db.all(query, params, async (err, rows) => {
        if (err) reject(err);
        else {
          // Group by account, currency, ticker, and date
          const grouped = {};
          for (const row of rows) {
            if (!grouped[row.account_name]) grouped[row.account_name] = {};
            const key = `${row.currency}|${row.ticker || ''}|${row.date}`;
            if (!grouped[row.account_name][key]) grouped[row.account_name][key] = [];
            grouped[row.account_name][key].push(row);
          }
          // Now convert and sum
          const convertBalance = require('./convert').convertBalance;
          const result = {};
          for (const [account, groups] of Object.entries(grouped)) {
            result[account] = {};
            for (const [key, entries] of Object.entries(groups)) {
              // key format: currency|ticker|date
              const [currency, ticker, date] = key.split('|');
              let sum = 0;
              let rawEntries = [];
              for (const entry of entries) {
                const converted = await convertBalance({ balance: entry.balance, currency: entry.currency, date }, targetCurrency);
                if (converted != null) sum += converted;
                rawEntries.push({ balance: entry.balance, currency: entry.currency, ticker: entry.ticker });
              }
              if (!result[account][date]) result[account][date] = { balance: 0, currency: targetCurrency, raw_entries: [] };
              result[account][date].balance += sum;
              result[account][date].currency = targetCurrency;
              result[account][date].raw_entries = result[account][date].raw_entries.concat(rawEntries);
            }
          }
          resolve(result);
        }
      });
    });
  }

  async getPieChartData(type, date) {
    return new Promise((resolve, reject) => {
      // Get account groups based on type
      const accountGroups = this.getAccountGroupsByType(type);
      
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
      `;

      this.db.all(query, [...accountGroups, date], (err, rows) => {
        if (err) reject(err);
        else {
          const labels = rows.map(row => row.account_name);
          const data = rows.map(row => Math.abs(row.balance));
          const total = data.reduce((sum, val) => sum + val, 0);

          resolve({ labels, data, total });
        }
      });
    });
  }

  getAccountGroupsByType(type) {
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

  async getAccountGroups() {
    const fs = require('fs');
    const path = require('path');
    const configDir = path.join(__dirname, '../config');
    const groupFiles = ['operating', 'investing', 'crypto', 'equity', 'summary'];
    const groups = {};
    for (const group of groupFiles) {
      const filePath = path.join(configDir, `${group}.txt`);
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          groups[group] = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        } else {
          groups[group] = [];
        }
      } catch (e) {
        console.error(`Error reading group file for ${group}:`, e);
        groups[group] = [];
      }
    }

    const allAccounts = this.getAllAccounts();
    groups['networth'] = await allAccounts;
    const tempList = {};
    const ignoreFilePath = path.join(configDir, 'ignorefortotal.txt');
    try {
      if (fs.existsSync(ignoreFilePath)) {
        const content = fs.readFileSync(ignoreFilePath, 'utf-8');
        tempList['ignorefortotal'] = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      } else {
        tempList['ignorefortotal'] = [];
      }
    } catch (e) {
      console.error(`Error reading group file for ignorefortotal:`, e);
      tempList['ignorefortotal'] = [];
    }

    if (groups['networth'] && tempList['ignorefortotal']) {
      groups['total'] = groups['networth'].filter(
        account => !tempList['ignorefortotal'].includes(account)
      );
    } else {
      groups['total'] = [];
    }

    return groups;
  }


  async getAvailableCurrencies() {
    const currencyFiles = [
      path.join(__dirname, '../config/available_currency.txt'),
      path.join(__dirname, '../config/available_crypto.txt')
    ];
    let all = [];
    for (const file of currencyFiles) {
      try {
        console.log('[getAvailableCurrencies] Reading:', file);
        const txt = await fsPromises.readFile(file, 'utf8');
        console.log(`[getAvailableCurrencies] Content of ${file}:`, JSON.stringify(txt));
        const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        console.log(`[getAvailableCurrencies] Parsed lines:`, lines);
        all = all.concat(lines);
      } catch (e) {
        console.error(`[getAvailableCurrencies] Error reading ${file}:`, e.message);
      }
    }
    // Remove duplicates and empty
    const result = Array.from(new Set(all)).filter(Boolean);
    console.log('[getAvailableCurrencies] Final result:', result);
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
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getNetWorthSummary(startDate = null, endDate = null, accounts = null) {
    const balances = await this.getAccountBalances(startDate, endDate, accounts, targetCurrency = this.getMainCurrency());

    // Calculate totals for each date
    const summary = {};
    Object.keys(balances).forEach(account => {
      Object.keys(balances[account]).forEach(date => {
        if (!summary[date]) {
          summary[date] = { total: 0, accounts: {} };
        }
        summary[date].total += balances[account][date].balance;
        summary[date].accounts[account] = balances[account][date].balance;
      });
    });

    return summary;
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
