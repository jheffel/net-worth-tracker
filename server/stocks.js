// Net Worth Tracker
// Copyright (C) 2025 jheffel
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

const sqlite3 = require('sqlite3').verbose();
const path = require('path');


const dbFile = path.join(__dirname, '../db/stock.db');

function openDb() {
  const db = new sqlite3.Database(dbFile);
  db.run('PRAGMA busy_timeout=5000');
  return db;
}

function _initializeDB() {
const db = openDb();
db.run(`
    CREATE TABLE IF NOT EXISTS stock_prices (
    date TEXT,
    symbol TEXT,
    currency TEXT,
    price REAL,
    PRIMARY KEY (date, symbol)
    )
`, (err) => {
    if (err) console.error('Error initializing stock_prices table:', err.message);
    db.close();
});
}


function addPrice(date, symbol, currency, price) {
return new Promise((resolve, reject) => {
    const db = openDb();
    db.run(
    'INSERT OR REPLACE INTO stock_prices (date, symbol, currency, price) VALUES (?, ?, ?, ?)',
    [date, symbol, currency, price],
    function(err) {
        db.close();
        if (err) reject(err);
        else resolve();
    }
    );
});
}

function getAllPricesForSymbol(symbol) {
    return new Promise((resolve, reject) => {
        const db = openDb();
        db.all(
            'SELECT date, price, currency FROM stock_prices WHERE symbol = ? ORDER BY date ASC',
            [symbol],
            (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}





function getPrice(date, symbol) {
return new Promise((resolve, reject) => {
    const db = openDb();
    db.get(
    'SELECT price FROM stock_prices WHERE date = ? AND symbol = ?',
    [date, symbol],
    (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row ? row.price : null);
    }
    );
});
}

function getNearestPrice(date, symbol) {
return new Promise((resolve, reject) => {
    const db = openDb();
    db.get(
    'SELECT price FROM stock_prices WHERE date <= ? AND symbol = ? ORDER BY date DESC LIMIT 1',
    [date, symbol],
    (err, row) => {
        if (err) {
        db.close();
        return reject(err);
        }
        if (row) {
        db.close();
        return resolve(row.price);
        } else {
        db.get(
            'SELECT price FROM stock_prices WHERE date >= ? AND symbol = ? ORDER BY date ASC LIMIT 1',
            [date, symbol],
            (err2, row2) => {
            db.close();
            if (err2) return reject(err2);
            if (row2) return resolve(row2.price);
            resolve(null);
            }
        );
        }
    }
    );
});
}


module.exports = { getPrice, addPrice, getNearestPrice, getAllPricesForSymbol };
