// Node.js module to fetch FX rates from the SQLite database, similar to exchange_rates.py
// Usage: const fx = require('./fx'); fx.getRate(date, base, target).then(rate => ...)

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/exchange_rates.db');

function getRate(date, base, target) {
  return new Promise((resolve, reject) => {
    if (base === target) return resolve(1.0);
    const db = new sqlite3.Database(DB_PATH);
    db.get(
      'SELECT rate FROM exchange_rates WHERE date = ? AND base_currency = ? AND target_currency = ?',
      [date, base, target],
      (err, row) => {
        db.close();
        if (err) return reject(err);
        if (row && row.rate) return resolve(row.rate);
        // Try nearest previous date
        const prevQuery = `SELECT rate FROM exchange_rates WHERE date <= ? AND base_currency = ? AND target_currency = ? ORDER BY date DESC LIMIT 1`;
        const db2 = new sqlite3.Database(DB_PATH);
        db2.get(prevQuery, [date, base, target], (err2, row2) => {
          db2.close();
          if (err2) return reject(err2);
          if (row2 && row2.rate) return resolve(row2.rate);
          // Try nearest next date
          const nextQuery = `SELECT rate FROM exchange_rates WHERE date >= ? AND base_currency = ? AND target_currency = ? ORDER BY date ASC LIMIT 1`;
          const db3 = new sqlite3.Database(DB_PATH);
          db3.get(nextQuery, [date, base, target], (err3, row3) => {
            db3.close();
            if (err3) return reject(err3);
            if (row3 && row3.rate) return resolve(row3.rate);
            // No rate found
            resolve(null);
          });
        });
      }
    );
  });
}

module.exports = { getRate };
