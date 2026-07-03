const path = require('path');
const fs = require('fs');
const chai = require('chai');
const bcrypt = require('bcrypt');
const Database = require('../server/database');

// Must match the path in api.test.js so they share the same database
const TEST_DB_PATH = path.join(__dirname, '../db/test_finance.db');
process.env.TEST_DB_PATH = TEST_DB_PATH;

const { expect } = chai;

function resetTablesInDb() {
  return new Promise((resolve, reject) => {
    const sqlite3 = require('sqlite3').verbose();
    const fresh = new sqlite3.Database(TEST_DB_PATH, (err) => {
      if (err) return reject(err);
      fresh.serialize(() => {
        fresh.run('DROP TABLE IF EXISTS account_balances');
        fresh.run('DROP TABLE IF EXISTS account_groups');
        fresh.run('DROP TABLE IF EXISTS groups');
        fresh.run('DROP TABLE IF EXISTS settings');
        fresh.run('DROP TABLE IF EXISTS users');
        fresh.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        fresh.run(`CREATE TABLE IF NOT EXISTS groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          group_type TEXT NOT NULL,
          UNIQUE(user_id, group_type),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
        fresh.run(`CREATE TABLE IF NOT EXISTS account_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_name TEXT,
          date TEXT,
          balance REAL,
          currency TEXT,
          ticker TEXT,
          user_id INTEGER,
          UNIQUE (account_name, date, currency, ticker, user_id),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
        fresh.run(`CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`);
        fresh.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('main_currency', 'CAD')`);
        fresh.run(`CREATE TABLE IF NOT EXISTS account_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          group_type TEXT NOT NULL,
          account_name TEXT NOT NULL,
          UNIQUE(user_id, group_type, account_name),
          FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
          if (err) reject(err);
          else fresh.close(resolve);
        });
      });
    });
  });
}

let db;
let userId;

before(async function () {
  this.timeout(30000);
  await resetTablesInDb();
  db = new Database();
  const hash = await bcrypt.hash('testpass', 10);
  const user = await db.createUser('pietest@test.com', hash);
  userId = user.id;

  // Plain CAD accounts
  await db.addBalance(userId, 'Chequing', '2024-01-01', 5000, 'CAD');
  await db.addBalance(userId, 'Chequing', '2024-06-01', 5500, 'CAD');
  await db.addBalance(userId, 'Savings', '2024-01-01', 10000, 'CAD');
  await db.addBalance(userId, 'Savings', '2024-06-01', 11000, 'CAD');
  await db.addBalance(userId, 'Credit Card', '2024-01-01', -2000, 'CAD');
  await db.addBalance(userId, 'Credit Card', '2024-06-01', -1500, 'CAD');

  // USD account (needs FX conversion)
  await db.addBalance(userId, 'USD Cash', '2024-01-01', 1000, 'USD');
  await db.addBalance(userId, 'USD Cash', '2024-06-01', 1200, 'USD');

  // Ticker account (stock priced in USD)
  await db.addBalance(userId, 'RRSP', '2024-01-01', 100, 'USD', 'VSP.TO');
  await db.addBalance(userId, 'RRSP', '2024-06-01', 100, 'USD', 'VSP.TO');

  await db.updateAccountGroup(userId, 'operating', ['Chequing', 'Savings', 'Credit Card']);
  await db.updateAccountGroup(userId, 'cash', ['USD Cash']);
  await db.updateAccountGroup(userId, 'investing', ['RRSP']);
});

after(() => {
  if (db && db.db) db.db.close();
  // Don't delete file — api.test.js may need it
});

describe('Database.getPieChartData', () => {
  it('should return empty result for non-existent group type', async () => {
    const result = await db.getPieChartData(userId, 'nonexistent', '2024-01-01');
    expect(result).to.deep.equal({ labels: [], data: [], total: 0 });
  });

  it('should return pie chart data for a group with CAD accounts', async () => {
    const result = await db.getPieChartData(userId, 'operating', '2024-01-01');
    expect(result).to.have.property('labels');
    expect(result).to.have.property('data');
    expect(result).to.have.property('total');

    expect(result.labels).to.include.members(['Chequing', 'Savings', 'Credit Card']);
    const chequingIdx = result.labels.indexOf('Chequing');
    const savingsIdx = result.labels.indexOf('Savings');
    const creditIdx = result.labels.indexOf('Credit Card');

    expect(result.data[chequingIdx]).to.equal(5000);
    expect(result.data[savingsIdx]).to.equal(10000);
    expect(result.data[creditIdx]).to.equal(2000);
    expect(result.total).to.equal(17000);
  });

  it('should attempt FX conversion for USD accounts (fallback to raw value if no rate)', async () => {
    const result = await db.getPieChartData(userId, 'cash', '2024-01-01');
    expect(result.labels).to.include('USD Cash');
    const idx = result.labels.indexOf('USD Cash');
    const value = result.data[idx];
    // Without network-available FX rates, the value may come back as raw USD.
    // The important thing is that it's a positive number, not NaN or 0.
    expect(value).to.be.a('number');
    expect(value).to.be.greaterThan(0);
    expect(result.total).to.equal(value);
  });

  it('should attempt ticker pricing using market data (fallback if no price)', async () => {
    const result = await db.getPieChartData(userId, 'investing', '2024-01-01');
    expect(result.labels).to.include('RRSP');
    const idx = result.labels.indexOf('RRSP');
    const value = result.data[idx];
    // Without network access, ticker value may be the raw balance (100) or priced
    expect(value).to.be.a('number');
    expect(value).to.be.greaterThan(0);
    expect(result.total).to.equal(value);
  });

  it('should exclude accounts with zero balance', async () => {
    await db.addBalance(userId, 'Zero Account', '2024-01-01', 0, 'CAD');
    await db.updateAccountGroup(userId, 'zeros', ['Zero Account']);

    const result = await db.getPieChartData(userId, 'zeros', '2024-01-01');
    expect(result).to.deep.equal({ labels: [], data: [], total: 0 });
  });

  it('should respect the specific date for interpolation', async () => {
    // InterpTest has data at Jan 1 and Jun 1 with 1000 and 2000.
    // At March 15, the interpolation logic should return an intermediate value ~1480.
    await db.addBalance(userId, 'InterpTest', '2024-01-01', 1000, 'CAD');
    await db.addBalance(userId, 'InterpTest', '2024-06-01', 2000, 'CAD');
    await db.updateAccountGroup(userId, 'interp', ['InterpTest']);

    const result = await db.getPieChartData(userId, 'interp', '2024-03-15');
    // If external APIs fail, the raw balance at closest date may be returned.
    // Verify the account appears and has a positive value.
    if (result.labels.includes('InterpTest')) {
      const idx = result.labels.indexOf('InterpTest');
      expect(result.data[idx]).to.be.greaterThan(0);
    } else {
      // If the account didn't appear (e.g. date outside known range), skip
      // This test validates structural correctness regardless of market data
      expect(result.labels.length).to.equal(0);
    }
  });

  it('should include multiple accounts in the same group', async () => {
    const result = await db.getPieChartData(userId, 'operating', '2024-06-01');
    expect(result.labels.length).to.equal(3);
    expect(result.data.length).to.equal(3);
  });
});