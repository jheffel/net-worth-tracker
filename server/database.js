const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/finance.db');
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

  async getAccountBalances(startDate = null, endDate = null, accounts = null) {
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

      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          // Group by account
          const grouped = {};
          rows.forEach(row => {
            if (!grouped[row.account_name]) {
              grouped[row.account_name] = {};
            }
            grouped[row.account_name][row.date] = {
              balance: row.balance,
              currency: row.currency,
              ticker: row.ticker
            };
          });
          resolve(grouped);
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
    const groups = {
      operating: ['chequing', 'credit card', 'savings'],
      investing: ['RRSP', 'Margin'],
      crypto: ['Bitcoin', 'Eth'],
      equity: ['mortgage', 'House value'],
      summary: ['operating', 'investing', 'crypto', 'equity']
    };
    return groups[type] || [];
  }

  async getAccountGroups() {
    return {
      operating: ['chequing', 'credit card', 'savings'],
      investing: ['RRSP', 'Margin'],
      crypto: ['Bitcoin', 'Eth'],
      equity: ['mortgage', 'House value'],
      summary: ['operating', 'investing', 'crypto', 'equity']
    };
  }

  async getAvailableCurrencies() {
    return [
      'CAD', 'USD', 'INR', 'IDR', 'JPY', 'TWD', 'TRY', 'KRW', 'SEK', 'CHF',
      'EUR', 'HKD', 'MXN', 'NZD', 'SAR', 'SGD', 'ZAR', 'GBP', 'NOK', 'PEN',
      'RUB', 'AUD', 'BRL', 'CNY'
    ];
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
    const balances = await this.getAccountBalances(startDate, endDate, accounts);
    
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
