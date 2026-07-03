const path = require('path');
const fs = require('fs');
const chai = require('chai');
const supertest = require('supertest');
const bcrypt = require('bcrypt');
const Database = require('../server/database');

const TEST_DB_PATH = path.join(__dirname, '../db/test_finance.db');
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.CORS_ORIGIN = '*';
process.env.TEST_DB_PATH = TEST_DB_PATH;

const app = require('../server/index');

const { expect } = chai;

let mainToken;

function resetTestDatabase() {
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

function testDb() {
  return new Database();
}

before(async function () {
  this.timeout(60000);

  await resetTestDatabase();
  const db = testDb();

  const hash1 = await bcrypt.hash('testpass123', 10);
  const hash2 = await bcrypt.hash('password456', 10);

  const user1 = await db.createUser('testuser@test.com', hash1);
  await db.createUser('other@test.com', hash2);

  const balances = [
    [user1.id, 'Chequing', '2024-01-01', 5000, 'CAD', ''],
    [user1.id, 'Chequing', '2024-02-01', 5200, 'CAD', ''],
    [user1.id, 'Savings', '2024-01-01', 10000, 'CAD', ''],
    [user1.id, 'Savings', '2024-02-01', 10500, 'CAD', ''],
    [user1.id, 'Credit Card', '2024-01-01', -1500, 'CAD', ''],
    [user1.id, 'Credit Card', '2024-02-01', -2000, 'CAD', ''],
    [user1.id, 'Mortgage', '2024-01-01', -250000, 'CAD', ''],
  ];

  for (const [uid, acct, date, bal, cur, tick] of balances) {
    await db.addBalance(uid, acct, date, bal, cur, tick);
  }

  await db.updateAccountGroup(user1.id, 'Operating', ['Chequing', 'Savings', 'Credit Card']);
  await db.updateAccountGroup(user1.id, 'equity', ['Mortgage']);
  db.close();

  const loginRes = await supertest(app)
    .post('/api/auth/login')
    .send({ email: 'testuser@test.com', password: 'testpass123' });
  mainToken = loginRes.body.token;
});

after(() => {
  try { if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH); } catch (e) {}
});

describe('Authentication', () => {
  it('should register a new user', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@test.com', password: 'newpass123' });
    expect(res.status).to.equal(201);
    expect(res.body.message).to.equal('User created');
  });

  it('should reject duplicate email registration', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email: 'testuser@test.com', password: 'testpass123' });
    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error');
  });

  it('should reject registration with missing email', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ password: 'newpass123' });
    expect(res.status).to.equal(400);
  });

  it('should reject registration with missing password', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email: 'nopass@test.com' });
    expect(res.status).to.equal(400);
  });

  it('should login with correct credentials', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@test.com', password: 'testpass123' });
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token');
    expect(res.body.email).to.equal('testuser@test.com');
    expect(res.body).to.have.property('id');
  });

  it('should reject login with wrong password', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'testuser@test.com', password: 'wrongpassword' });
    expect(res.status).to.equal(403);
  });

  it('should reject login with non-existent user', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'testpass123' });
    expect(res.status).to.equal(400);
  });
});

describe('Protected Routes', () => {
  it('should reject requests without token (401)', async () => {
    const res = await supertest(app).get('/api/accounts');
    expect(res.status).to.equal(401);
  });

  it('should reject requests with invalid token (403)', async () => {
    const res = await supertest(app)
      .get('/api/accounts')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).to.equal(403);
  });

  it('should accept requests with valid token', async () => {
    const res = await supertest(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
  });
});

describe('Security', () => {
  it('should not expose config directory publicly', async () => {
    const res = await supertest(app).get('/config/operating.txt');
    expect(res.status).to.be.oneOf([404, 301, 302]);
  });

  it('should not expose config directory listing', async () => {
    const res = await supertest(app).get('/config');
    expect(res.status).to.be.oneOf([404, 301, 302]);
  });
});

describe('Accounts API', () => {
  it('should return accounts for authenticated user', async () => {
    const res = await supertest(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
    expect(res.body).to.include.members(['Chequing', 'Savings', 'Credit Card', 'Mortgage']);
  });

  it('should return empty array for user with no data', async () => {
    const registerRes = await supertest(app)
      .post('/api/auth/register')
      .send({ email: 'empty@test.com', password: 'emptypass123' });
    expect(registerRes.status).to.equal(201);

    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'empty@test.com', password: 'emptypass123' });

    const res = await supertest(app)
      .get('/api/accounts')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array').that.is.empty;
  });
});

describe('Account Groups API', () => {
  it('should return groups for authenticated user', async () => {
    const res = await supertest(app)
      .get('/api/account-groups')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('Operating');
    expect(res.body.Operating).to.include.members(['Chequing', 'Savings', 'Credit Card']);
    expect(res.body).to.have.property('equity');
    expect(res.body.equity).to.include('Mortgage');
  });

  it('should update an account group', async () => {
    const res = await supertest(app)
      .post('/api/account-groups/Operating')
      .set('Authorization', `Bearer ${mainToken}`)
      .send({ accounts: ['Chequing', 'Savings'] });
    expect(res.status).to.equal(200);

    const getRes = await supertest(app)
      .get('/api/account-groups')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(getRes.body.Operating).to.deep.equal(['Chequing', 'Savings']);
  });

  it('should delete an account group', async () => {
    const res = await supertest(app)
      .delete('/api/account-groups/equity')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);

    const getRes = await supertest(app)
      .get('/api/account-groups')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(getRes.body).to.not.have.property('equity');
  });
});

describe('Balances API', () => {
  it('should return balances for selected accounts', async () => {
    const res = await supertest(app)
      .get('/api/balances?accounts[]=Chequing&startDate=2024-01-01&endDate=2024-03-01')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('Chequing');
  });

  it('should return empty object for non-existent account', async () => {
    const res = await supertest(app)
      .get('/api/balances?accounts[]=Nonexistent')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({});
  });

  it('should handle single accounts query param as string', async () => {
    // Express parses ?accounts=Chequing as a string, not array
    const res = await supertest(app)
      .get('/api/balances?accounts=Chequing&startDate=2024-01-01&endDate=2024-03-01')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('Chequing');
  });
});

describe('Pie Chart API', () => {
  it('should return pie chart data for a valid group', async () => {
    const res = await supertest(app)
      .get('/api/pie-chart/Operating?date=2024-01-01')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('labels');
    expect(res.body).to.have.property('data');
    expect(res.body).to.have.property('total');
    expect(res.body.labels.length).to.be.at.least(1);
  });

  it('should return empty pie chart for non-existent group', async () => {
    const res = await supertest(app)
      .get('/api/pie-chart/nonexistent?date=2024-01-01')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ labels: [], data: [], total: 0 });
  });
});

describe('Net Worth API', () => {
  it('should return net worth summary', async () => {
    const res = await supertest(app)
      .get('/api/net-worth?startDate=2024-01-01&endDate=2024-02-01')
      .set('Authorization', `Bearer ${mainToken}`);
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('object');
    const dates = Object.keys(res.body);
    expect(dates.length).to.be.greaterThan(0);
    for (const date of dates) {
      expect(res.body[date]).to.have.property('total');
      expect(res.body[date]).to.have.property('accounts');
    }
  });
});

describe('Currencies API', () => {
  it('should return available currencies (public)', async () => {
    const res = await supertest(app).get('/api/currencies');
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
    expect(res.body.length).to.be.greaterThan(0);
  });
});