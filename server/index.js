const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');
const moment = require('moment');
const Database = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Only serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Initialize database
const db = new Database();
const { convertBalance } = require('./convert');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// API Routes

// Get all account data
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await db.getAllAccounts();
    const groups = await db.getAccountGroups();
    // Only include groups that have at least one member present in the database
    const validGroups = Object.entries(groups)
      .filter(([group, members]) => members.some(member => accounts.includes(member)))
      .map(([group]) => group);
    const allAccounts = Array.from(new Set([...accounts, ...validGroups]));
    res.json(allAccounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account balances for a specific date range
app.get('/api/balances', async (req, res) => {
  try {
    const { startDate, endDate, accounts, currency } = req.query;
    const balances = await db.getAccountBalances(startDate, endDate, accounts);
    let targetCurrency = currency;
    if (!targetCurrency) {
      // If not specified, get main currency from DB
      targetCurrency = await db.getMainCurrency();
    }
    // Convert all balances to targetCurrency
    const converted = {};
    for (const [account, dates] of Object.entries(balances)) {
      converted[account] = {};
      for (const [date, entry] of Object.entries(dates)) {
        const convertedBalance = await convertBalance({
          balance: entry.balance,
          currency: entry.currency,
          date
        }, targetCurrency);
        converted[account][date] = {
          ...entry,
          balance: convertedBalance,
          currency: targetCurrency
        };
      }
    }
    res.json(converted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pie chart data for a specific date
app.get('/api/pie-chart/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { date } = req.query;
    const pieData = await db.getPieChartData(type, date);
    res.json(pieData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import Excel/ODS file
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const importedData = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      if (data.length > 1) {
        const headers = data[0];
        // Require first header cell to be 'account' (case-insensitive)
        if (!headers[0] || headers[0].toString().toLowerCase() !== 'account') continue;
        // Each row after the header is a single account's data
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const accountName = row[0];
          const dateCell = row[1];
          const balance = parseFloat(row[2]);
          const currency = row[3] || 'CAD';
          const ticker = row[4] || '';
          console.log('Raw dateCell:', dateCell, 'Type:', typeof dateCell);
          if (!accountName || !dateCell || isNaN(balance)) continue;
          let date = null;
          // Try to handle Excel/ODS serial dates and string dates
          if (typeof dateCell === 'number') {
            // Excel/ODS serial date: days since 1899-12-30
            date = moment('1899-12-30').add(dateCell, 'days').format('YYYY-MM-DD');
          } else if (typeof dateCell === 'string' && moment(dateCell, moment.ISO_8601, true).isValid()) {
            date = moment(dateCell).format('YYYY-MM-DD');
          } else if (moment(dateCell).isValid()) {
            date = moment(dateCell).format('YYYY-MM-DD');
          }
          if (!date) continue;
          await db.addBalance(accountName, date, balance, currency, ticker);
          importedData.push({
            account: accountName,
            date,
            balance,
            currency,
            ticker
          });
        }
      }
    }

  console.log('Imported data:', JSON.stringify(importedData, null, 2));
  res.json({ 
      message: 'Data imported successfully', 
      importedCount: importedData.length,
      data: importedData 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available currencies
app.get('/api/currencies', async (req, res) => {
  try {
    const currencies = await db.getAvailableCurrencies();
    res.json(currencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account groups (operating, investing, crypto, equity, summary)
app.get('/api/account-groups', async (req, res) => {
  try {
    const groups = await db.getAccountGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update main currency
app.put('/api/currency', async (req, res) => {
  try {
    const { currency } = req.body;
    await db.setMainCurrency(currency);
    res.json({ message: 'Currency updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get net worth summary
app.get('/api/net-worth', async (req, res) => {
  try {
    const { startDate, endDate, accounts } = req.query;
    const summary = await db.getNetWorthSummary(startDate, endDate, accounts);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app for any other routes (only in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
