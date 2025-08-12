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
