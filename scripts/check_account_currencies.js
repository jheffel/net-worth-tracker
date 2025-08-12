// Script to list all accounts and their currencies from the finance.db
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../db/finance.db');
const db = new sqlite3.Database(dbPath);

console.log('Account Name | Currency');
console.log('------------------------');
db.all('SELECT DISTINCT account_name, currency FROM account_balances ORDER BY account_name', [], (err, rows) => {
  if (err) {
    console.error('Error querying database:', err);
    process.exit(1);
  }
  rows.forEach(row => {
    console.log(`${row.account_name} | ${row.currency}`);
  });
  db.close();
});
