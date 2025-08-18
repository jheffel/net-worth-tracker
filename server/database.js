const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const { getNearestPrice, getAllPricesForSymbol } = require('./stocks');

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
          account_name TEXT,
          date TEXT,
          balance REAL,
          currency TEXT,
          ticker TEXT,
          UNIQUE (account_name, date, currency, ticker)
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


      console.log('Executing query:', query, 'with params:', params);

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
            
            console.log(`Processing row: ${row.account_name}, ${row.date}, ${row.balance}, ${row.currency}, ${row.ticker}`);
          }

          const myData = {};
          for (const row of rows) {

            //initialize myData
            if (!myData[row.account_name]) myData[row.account_name] = {};
            if (!myData[row.account_name][row.currency]) myData[row.account_name][row.currency] = [];
            if (!myData[row.account_name][row.currency][row.ticker]) myData[row.account_name][row.currency][row.ticker] = [];
            if (!myData[row.account_name][row.currency][row.ticker][row.date]) myData[row.account_name][row.currency][row.ticker][row.date] = [];

            myData[row.account_name][row.currency][row.ticker][row.date].push(row.balance);

          }
          /*
          console.log("_____________________________\n\n\n\n\n\n\n\n\n")

          console.log("_____________________________\n\n\n\n\n\n\n\n\n")

          for (const account in myData) {
            console.log(`Account: ${account}`);
            for (const currency in myData[account]) {
              console.log(`  Currency: ${currency}`);
              for (const ticker in myData[account][currency]) {
                console.log(`    Ticker: ${ticker}`);
                for (const date in myData[account][currency][ticker]) {
                  console.log(`      Date: ${date}`);
                  const balance = myData[account][currency][ticker][date];
                  console.log(`         Balances: ${balance}`);
                }
              }
            }
          }

          console.log("_____________________________\n\n\n\n\n\n\n\n\n")
          */

          const interpolateDates = (dates) => {
            // dates: array of date strings, e.g. ['2024-06-01', '2024-06-03']
            const result = [];
            if (dates.length === 0) return result;
            const sortedDates = dates.sort();
            const start = new Date(sortedDates[0]);
            const end = new Date(sortedDates[sortedDates.length - 1]);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              result.push(d.toISOString().slice(0, 10));
            }
            return result;
          };

          for (const account in myData) {
            for (const currency in myData[account]) {
              for (const ticker in myData[account][currency]) {
              const dateKeys = Object.keys(myData[account][currency][ticker]);
              const allDates = interpolateDates(dateKeys);

              // Get actual data points as sorted array of {date, balance}
              const points = dateKeys
                .map(date => ({
                date,
                balance: myData[account][currency][ticker][date][0]
                }))
                .sort((a, b) => a.date.localeCompare(b.date));

              for (let i = 0; i < allDates.length; i++) {
                const date = allDates[i];

                // If actual data point, continue
                if (myData[account][currency][ticker][date]) continue;

                // Find previous and next actual data points
                let prevIdx = -1, nextIdx = -1;
                for (let j = 0; j < points.length; j++) {
                if (points[j].date < date) prevIdx = j;
                if (points[j].date > date && nextIdx === -1) nextIdx = j;
                }

                if (prevIdx !== -1 && nextIdx !== -1) {
                // Linear interpolation
                const prev = points[prevIdx];
                const next = points[nextIdx];
                const totalDays = (new Date(next.date) - new Date(prev.date)) / (1000 * 60 * 60 * 24);
                const daysSincePrev = (new Date(date) - new Date(prev.date)) / (1000 * 60 * 60 * 24);
                const interpolated = prev.balance + (next.balance - prev.balance) * (daysSincePrev / totalDays);
                myData[account][currency][ticker][date] = [interpolated];
                console.log(`Interpolated (smooth) balance for ${account} ${currency} ${ticker} on ${date}: ${interpolated}`);
                } else if (prevIdx !== -1) {
                // Use previous balance (forward fill)
                myData[account][currency][ticker][date] = [points[prevIdx].balance];
                console.log(`Forward filled balance for ${account} ${currency} ${ticker} on ${date}: ${points[prevIdx].balance}`);
                } else if (nextIdx !== -1) {
                // Use next balance (backward fill)
                myData[account][currency][ticker][date] = [points[nextIdx].balance];
                console.log(`Backward filled balance for ${account} ${currency} ${ticker} on ${date}: ${points[nextIdx].balance}`);
                }
              }
              }
            }
          }

          
          let result = {};
          //Calculate all chart data
          for (const account in myData) {
            console.log(`Account: ${account}`);

            if (!result[account]) result[account] = {};

            for (const currency in myData[account]) {
              console.log(`  Currency: ${currency}`);
              for (const ticker in myData[account][currency]) {
                console.log(`    Ticker: ${ticker}`);
                  //const tickerData = await getAllPricesForSymbol(ticker);
                  //console.log(`    Ticker Data: ${JSON.stringify(tickerData).slice(0, 100)}`);


                for (const date in myData[account][currency][ticker]) {
                  // Get the nearest ticker rate for this ticker and date
                  let tickerRate = null;
                  if (ticker !== "") {
                    tickerRate = await getNearestPrice(date, ticker);

                  }else{
                    //this is not a ticker so set it to 1 == no effect to balance
                    tickerRate = 1;
                  }
                  //console.log(`      Date: ${date}, Ticker Rate: ${tickerRate}`);

                  //console.log(`      Date: ${date}`);
                  let balance = myData[account][currency][ticker][date];
                  //console.log(`         Balances: ${balance}`);

                  // Multiply balance by ticker rate
                  balance *= tickerRate;
                  

                  
                  if (currency == 'CAD'){
                    result[account][date] = balance;
                  }
                  else {
                    //convert to CAD
                    const { convertBalance } = require('./convert');
                    const converted = await convertBalance({ balance, currency, date }, 'CAD');
                    if (converted != null) {
                      balance = converted;
                    }

                    //convert to main currency from CAD
                    targetCurrency = await this.getMainCurrency();
                    console.log('target currency: ', targetCurrency);
                    const converted2 = await convertBalance({ balance, currency: 'CAD', date }, targetCurrency);
                    if (converted2 != null) {
                      balance = converted2;
                    }

                    result[account][date] = balance;


                  }

                }
              }
            }
          }

          



          /*
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
              
              //if (!result[account][date]) result[account][date] = { balance: 0, currency: targetCurrency, raw_entries: [] };
              if(!result[account][date]){
                result[account][date] = { balance: 0, currency: targetCurrency, raw_entries: [] };
              }


              result[account][date].balance += sum;
              result[account][date].currency = targetCurrency;
              result[account][date].raw_entries = result[account][date].raw_entries.concat(rawEntries);
            }
          }
          */


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
