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

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// API Routes

// Get all account data
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await db.getAllAccounts();
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get account balances for a specific date range
app.get('/api/balances', async (req, res) => {
  try {
    const { startDate, endDate, accounts } = req.query;
    const balances = await db.getAccountBalances(startDate, endDate, accounts);
    res.json(balances);
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

      if (data.length > 0) {
        const accountName = data[0][0] || sheetName;
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row.length >= 4 && row[0] && row[1] && row[2] && row[3]) {
            const date = moment(row[1]).format('YYYY-MM-DD');
            const balance = parseFloat(row[2]);
            const currency = row[3];
            const ticker = row[4] || '';

            if (!isNaN(balance)) {
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
      }
    }

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
