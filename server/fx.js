// Node.js module to fetch FX rates from the SQLite database, similar to exchange_rates.py
// Usage: const fx = require('./fx'); fx.getRate(date, base, target).then(rate => ...)

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/exchange_rates.db');


async function getRate(date, base, target) {
  if (base === target) return 1.0;
  // If either is CAD, use direct lookup as before
  if (base === 'CAD' || target === 'CAD') {
    return await directOrNearest(date, base, target);
  }
  // Otherwise, use CAD as intermediary: base->CAD, then CAD->target
  const toCad = await directOrNearest(date, base, 'CAD');
  if (toCad == null) {
    //console.warn(`fx.getRate: No rate for ${base}->CAD on ${date}`);
    return null;
  }
  const fromCad = await directOrNearest(date, 'CAD', target);
  if (fromCad == null) {
    //console.warn(`fx.getRate: No rate for CAD->${target} on ${date}`);
    return null;
  }
  return toCad * fromCad;
}


function directOrNearest(date, base, target) {
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
        // Try reverse direction (reciprocal)
        const dbRev = new sqlite3.Database(DB_PATH);
        dbRev.get(
          'SELECT rate FROM exchange_rates WHERE date = ? AND base_currency = ? AND target_currency = ?',
          [date, target, base],
          (errRev, rowRev) => {
            dbRev.close();
            if (errRev) return reject(errRev);
            if (rowRev && rowRev.rate) {
              //console.warn(`fx.getRate: Using reciprocal for ${base}->${target} on ${date}`);
              return resolve(1.0 / rowRev.rate);
            }
            // Try nearest previous date
            const prevQuery = `SELECT rate FROM exchange_rates WHERE date <= ? AND base_currency = ? AND target_currency = ? ORDER BY date DESC LIMIT 1`;
            const db2 = new sqlite3.Database(DB_PATH);
            db2.get(prevQuery, [date, base, target], (err2, row2) => {
              db2.close();
              if (err2) return reject(err2);
              if (row2 && row2.rate) return resolve(row2.rate);
              // Try reverse previous
              const db2Rev = new sqlite3.Database(DB_PATH);
              db2Rev.get(prevQuery, [date, target, base], (err2r, row2r) => {
                db2Rev.close();
                if (err2r) return reject(err2r);
                if (row2r && row2r.rate) {
                  //console.warn(`fx.getRate: Using reciprocal for previous ${base}->${target} before ${date}`);
                  return resolve(1.0 / row2r.rate);
                }
                // Try nearest next date
                const nextQuery = `SELECT rate FROM exchange_rates WHERE date >= ? AND base_currency = ? AND target_currency = ? ORDER BY date ASC LIMIT 1`;
                const db3 = new sqlite3.Database(DB_PATH);
                db3.get(nextQuery, [date, base, target], (err3, row3) => {
                  db3.close();
                  if (err3) return reject(err3);
                  if (row3 && row3.rate) return resolve(row3.rate);
                  // Try reverse next
                  const db3Rev = new sqlite3.Database(DB_PATH);
                  db3Rev.get(nextQuery, [date, target, base], (err3r, row3r) => {
                    db3Rev.close();
                    if (err3r) return reject(err3r);
                    if (row3r && row3r.rate) {
                      //console.warn(`fx.getRate: Using reciprocal for next ${base}->${target} after ${date}`);
                      return resolve(1.0 / row3r.rate);
                    }
                    // No rate found
                    resolve(null);
                  });
                });
              });
            });
          }
        );
      }
    );
  });
}

module.exports = { getRate };
