import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';
import NetWorthChart from './components/NetWorthChart';
import PieCharts from './components/PieCharts';
import AccountSelector from './components/AccountSelector';
import FileUpload from './components/FileUpload';
import Controls from './components/Controls';
import './App.css';

function App() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [timeframe, setTimeframe] = useState('All Data');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [mainCurrency, setMainCurrency] = useState('CAD');
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      loadBalances();
    }
  }, [accounts, selectedAccounts, timeframe, startDate, endDate]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [accountsRes, currenciesRes] = await Promise.all([
        axios.get(`${API_BASE}/accounts`),
        axios.get(`${API_BASE}/currencies`)
      ]);
      
      setAccounts(accountsRes.data);
      setCurrencies(currenciesRes.data);
      setSelectedAccounts(accountsRes.data);
    } catch (err) {
      setError('Failed to load initial data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async () => {
    try {
      const params = {
        accounts: selectedAccounts,
        startDate,
        endDate
      };
      console.log('Requesting balances with params:', params);
      const response = await axios.get(`${API_BASE}/balances`, { params });
      setBalances(response.data);
    } catch (err) {
      setError('Failed to load balance data');
      if (err.response) {
        console.error('API error:', err.response.status, err.response.data);
      } else {
        console.error('Network or other error:', err);
      }
    }
  };

  const handleAccountToggle = (account) => {
    setSelectedAccounts(prev => 
      prev.includes(account) 
        ? prev.filter(acc => acc !== account)
        : [...prev, account]
    );
  };

  const handleSelectAll = () => {
    setSelectedAccounts(accounts);
  };

  const handleDeselectAll = () => {
    setSelectedAccounts([]);
  };

  const handleCurrencyChange = async (currency) => {
    try {
      await axios.put(`${API_BASE}/currency`, { currency });
      setMainCurrency(currency);
      setSuccess('Currency updated successfully');
      setTimeout(() => setSuccess(null), 3000);

      // Reload balances with new currency
      await loadBalances();
    } catch (err) {
      setError('Failed to update currency');
      console.error(err);
    }
  };

  const handleFileUpload = async (file) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_BASE}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(`Successfully imported ${response.data.importedCount} records`);
      setTimeout(() => setSuccess(null), 5000);
      
      // Reload data
      await loadInitialData();
    } catch (err) {
      setError('Failed to import file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChartClick = (date) => {
    setSelectedDate(moment(date).format('YYYY-MM-DD'));
  };

  if (loading && accounts.length === 0) {
    return (
      <div className="App">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  // updateChartData is no longer needed, as useEffect handles updates

  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <h1>Net Worth Tracker</h1>
        </div>

        {error && (
          <div className="error">
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="success">
            {success}
            <button onClick={() => setSuccess(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              ×
            </button>
          </div>
        )}

        <Controls
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          mainCurrency={mainCurrency}
          currencies={currencies}
          onCurrencyChange={handleCurrencyChange}
          //updateChartData={updateChartData}
        />

        <div className="main-content">
          <div className="sidebar">
            <AccountSelector
              accounts={accounts}
              selectedAccounts={selectedAccounts}
              onAccountToggle={handleAccountToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
            
            <FileUpload onFileUpload={handleFileUpload} />
          </div>

          <div className="chart-container">
            <NetWorthChart
              balances={balances}
              selectedAccounts={selectedAccounts}
              mainCurrency={mainCurrency}
              onPointClick={handleChartClick}
            />
            
            <PieCharts
              selectedDate={selectedDate}
              mainCurrency={mainCurrency}
              API_BASE={API_BASE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
