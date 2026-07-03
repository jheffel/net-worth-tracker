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

// Script to list all rows for a given account and their currencies from the finance.db
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/finance.db');
const db = new sqlite3.Database(dbPath);

const accountName = process.argv[2];
if (!accountName) {
  console.error('Usage: node scripts/check_account_currency_rows.js "Account Name"');
  process.exit(1);
}

console.log(`Rows for account: ${accountName}`);
console.log('Date        | Balance     | Currency');
console.log('-------------------------------------');
db.all('SELECT date, balance, currency FROM account_balances WHERE account_name = ? ORDER BY date', [accountName], (err, rows) => {
  if (err) {
    console.error('Error querying database:', err);
    process.exit(1);
  }
  rows.forEach(row => {
    console.log(`${row.date} | ${row.balance} | ${row.currency}`);
  });
  db.close();
});
