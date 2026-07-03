const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const Database = require('../server/database');

const TEST_DB_PATH = path.join(__dirname, '../db/test_finance.db');

class TestSeed {
  constructor() {
    // Override db path before creating the instance
    this.db = new Database();
    this.db.dbPath = TEST_DB_PATH;
    this.db.db.close();
    // Remove old test db and re-init
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    this.db.dbPath = TEST_DB_PATH;
    this.db.ensureDataDirectory();
    this.db.init();
  }

  async seed() {
    const hash = await bcrypt.hash('testpass123', 10);
    const hash2 = await bcrypt.hash('password456', 10);

    await this.db.createUser('testuser@test.com', hash);
    await this.db.createUser('other@test.com', hash2);

    const userId = 1;

    await this.db.addBalance(userId, 'Chequing', '2024-01-01', 5000, 'CAD');
    await this.db.addBalance(userId, 'Chequing', '2024-02-01', 5200, 'CAD');
    await this.db.addBalance(userId, 'Chequing', '2024-03-01', 4800, 'CAD');

    await this.db.addBalance(userId, 'Savings', '2024-01-01', 10000, 'CAD');
    await this.db.addBalance(userId, 'Savings', '2024-02-01', 10500, 'CAD');
    await this.db.addBalance(userId, 'Savings', '2024-03-01', 11000, 'CAD');

    await this.db.addBalance(userId, 'RRSP', '2024-01-15', 100, 'USD', 'VSP.TO');
    await this.db.addBalance(userId, 'RRSP', '2024-02-15', 100, 'USD', 'VSP.TO');
    await this.db.addBalance(userId, 'RRSP', '2024-03-15', 100, 'USD', 'VSP.TO');

    await this.db.addBalance(userId, 'Credit Card', '2024-01-01', -1500, 'CAD');
    await this.db.addBalance(userId, 'Credit Card', '2024-02-01', -2000, 'CAD');
    await this.db.addBalance(userId, 'Credit Card', '2024-03-01', -1800, 'CAD');

    await this.db.addBalance(userId, 'Mortgage', '2024-01-01', -250000, 'CAD');
    await this.db.addBalance(userId, 'Mortgage', '2024-02-01', -249500, 'CAD');

    await this.db.updateAccountGroup(userId, 'operating', ['Chequing', 'Savings', 'Credit Card']);
    await this.db.updateAccountGroup(userId, 'investing', ['RRSP']);
    await this.db.updateAccountGroup(userId, 'equity', ['Mortgage']);

    console.log('Test data seeded successfully.');
    return this.db;
  }

  getDb() {
    return this.db;
  }

  close() {
    this.db.close();
  }
}

if (require.main === module) {
  const seed = new TestSeed();
  seed.seed().then(() => seed.close());
}

module.exports = TestSeed;