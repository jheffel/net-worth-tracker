import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import moment from 'moment';
import NetWorthChart from './components/NetWorthChart';
import PieCharts from './components/PieCharts';
import AccountSelector from './components/AccountSelector';
import FileUpload from './components/FileUpload';
import Controls from './components/Controls';
import './App.css';
import './chartLayout.css';

function App() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [timeframe, setTimeframe] = useState('All Data');
  const [startDate, setStartDate] = useState('1970-01-01');
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [mainCurrency, setMainCurrency] = useState('CAD');
  const [currencies, setCurrencies] = useState([]);
  const [groupMap, setGroupMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [splitRatio, setSplitRatio] = useState(0.66); // portion of space for main graph (0-1)
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });
  const [ignoreForTotal, setIgnoreForTotal] = useState([]);
  const containerRef = useRef(null);
  // Load ignoreForTotal list
  useEffect(() => {
    fetch('/config/ignoreForTotal.txt').then(r => r.text()).then(txt => {
      setIgnoreForTotal(txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
    }).catch(() => setIgnoreForTotal([]));
  }, []);

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top; // distance from top of container
    const ratio = offsetY / rect.height;
    // enforce min / max to keep panels usable
    setSplitRatio(clamp(ratio, 0.2, 0.85));
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(false);
  }, [dragging]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // API base URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadInitialData();
    loadGroupMap();
  }, []);

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const loadGroupMap = async () => {
    try {
      const res = await axios.get(`${API_BASE}/account-groups`);
      setGroupMap(res.data);
    } catch (err) {
      setGroupMap({});
      setError('Failed to load account groups');
    }
  };

  useEffect(() => {
    if (accounts.length > 0) {
      loadBalances();
    }
  }, [accounts, selectedAccounts, timeframe, startDate, endDate, mainCurrency]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [accountsRes, currenciesRes] = await Promise.all([
        axios.get(`${API_BASE}/accounts`),
        axios.get(`${API_BASE}/currencies`)
      ]);
      setAccounts(accountsRes.data);
      setCurrencies(currenciesRes.data);
      // Do not select any accounts by default
      setSelectedAccounts([]);
    } catch (err) {
      setError('Failed to load initial data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Replace loadBalances with a version that accepts a currency override
  const loadBalances = async (currencyOverride) => {
    try {
      // Always fetch balances for all accounts (including ungrouped)
      const params = {
        accounts: accounts, // use the full accounts list
        currency: currencyOverride || mainCurrency
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


      // Clear balances immediately to avoid showing stale data
      setBalances({});
      // Reload balances with new currency, force using the new currency
      await loadBalances(currency);
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

        <div className="header header-flex">
          <h1>Net Worth Tracker</h1>
          <div className="header-theme">
            <label style={{marginRight: 8}}>Theme:</label>
            <button type="button" onClick={toggleTheme} className="btn" style={{minWidth: '110px'}}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error">
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              ×
            </button>
          </div>
        )}



        <div className="main-content">
          <div className="sidebar">
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
            <AccountSelector
              accounts={accounts}
              selectedAccounts={selectedAccounts}
              onAccountToggle={handleAccountToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              groupMap={groupMap}
              ignoreForTotal={ignoreForTotal}
            />
            <FileUpload onFileUpload={handleFileUpload} />
          </div>

            <div className="chart-container vertical-split panel-split" ref={containerRef}>
              <div className="main-graph-panel panel-box" style={{ flex: `${splitRatio} 1 0%` }}>
                <NetWorthChart
                  balances={balances}
                  selectedAccounts={selectedAccounts}
                  mainCurrency={mainCurrency}
                  onPointClick={handleChartClick}
                  startDate={startDate}
                  endDate={endDate}
                  groupMap={groupMap}
                  timeframe={timeframe}
                  loading={loading}
                  theme={theme}
                  ignoreForTotal={ignoreForTotal}
                />
              </div>
              <div
                className={`panel-divider${dragging ? ' dragging' : ''}`}
                onMouseDown={handleDividerMouseDown}
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize panels"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') setSplitRatio(r => clamp(r - 0.02, 0.2, 0.85));
                  if (e.key === 'ArrowDown') setSplitRatio(r => clamp(r + 0.02, 0.2, 0.85));
                }}
              >
                <div className="grip" />
              </div>
              <div className="piecharts-panel panel-box" style={{ flex: `${Math.max(0.15, 1 - splitRatio)} 0.7 0%`, minHeight: '120px', maxHeight: '350px' }}>
                <PieCharts
                  balances={balances}
                  selectedAccounts={selectedAccounts}
                  groupMap={groupMap}
                  selectedDate={selectedDate}
                  mainCurrency={mainCurrency}
                  theme={theme}
                />
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;
