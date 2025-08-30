import React, { useState, useEffect } from 'react';
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
  // Sidebar drawer state (slides in on desktop and mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;

  // Close sidebar on navigation or overlay click
  const handleSidebarClose = () => setSidebarOpen(false);

  const [accounts, setAccounts] = useState([]);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [timeframe, setTimeframe] = useState('All Data');
  const [startDate, setStartDate] = useState('1970-01-01');
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
  const [mainCurrency, setMainCurrency] = useState('CAD');
  const [currencies, setCurrencies] = useState([]);
  const [groupMap, setGroupMap] = useState({});
  const [netWorthMembers, setNetWorthMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  // removed resizable split; pie charts moved to bottom drawer
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  const [ignoreForTotal, setIgnoreForTotal] = useState([]);
  // Load ignoreForTotal list
  useEffect(() => {
    fetch('/config/ignoreForTotal.txt').then(r => r.text()).then(txt => {
      setIgnoreForTotal(txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
    }).catch(() => setIgnoreForTotal([]));
  }, []);

  // pie drawer (slides from bottom)
  const [pieOpen, setPieOpen] = useState(false);

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
      const groups = res.data;
  // Dynamically set net worth and total members
  const allAccounts = accounts;
  const groupedAccounts = Object.values(groups).flat();
  setGroupMap({ ...groups });
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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleAccountToggle = (account) => {
    setSelectedAccounts(prev => 
      prev.includes(account) 
        ? prev.filter(acc => acc !== account)
        : [...prev, account]
    );
  if (isMobile) setSidebarOpen(false);
  };

  const handleSelectAll = () => {
    setSelectedAccounts(accounts);
  if (isMobile) setSidebarOpen(false);
  };

  const handleDeselectAll = () => {
    setSelectedAccounts([]);
  if (isMobile) setSidebarOpen(false);
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
        {/* Drawer tab - fixed on left edge to pull/push the sidebar */}
        <button aria-label="Toggle menu" title="Toggle menu" type="button" className={`drawer-tab ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(s => !s)}>
          {sidebarOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor"/>
            </svg>
          )}
        </button>

        {error && (
          <div className="error">
            {error}
            <button onClick={() => setError(null)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              ×
            </button>
          </div>
        )}

        <div className="main-content">
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="sidebar-overlay" onClick={handleSidebarClose} />
          )}
          {/* Sidebar drawer */}
          <div className={`sidebar drawer${sidebarOpen ? ' open' : ''}`}>
            <div className="sidebar-header">
              <h1 style={{ margin: 0 }}>Net Worth Tracker</h1>
              <div className="sidebar-actions">
                <button aria-label="Toggle theme" title="Toggle theme" type="button" onClick={toggleTheme} className="btn icon-btn small">
                  {theme === 'dark' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.8 1.8-1.8zM1 13h3v-2H1v2zm10 9h2v-3h-2v3zm7.24-2.84l1.79 1.79 1.79-1.79-1.79-1.8-1.79 1.8zM20 11v2h3v-2h-3zM4.22 19.78l1.79-1.79-1.79-1.79L2.43 18l1.79 1.78zM12 5a7 7 0 100 14 7 7 0 000-14z" fill="currentColor"/>
                    </svg>
                  )}
                </button>
                <button aria-label="Toggle fullscreen" title="Toggle fullscreen" type="button" onClick={handleToggleFullscreen} className="btn icon-btn small">
                  {isFullscreen ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M6 6h6V4H4v8h2V6zm12 12h-6v2h8v-8h-2v6zM6 18v-6H4v8h8v-2H6zm12-12v6h2V4h-8v2h6z" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M3 3h8v2H5v6H3V3zm10 0h8v8h-2V5h-6V3zm8 18h-8v-2h6v-6h2v8zM3 21v-8h2v6h6v2H3z" fill="currentColor"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
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
            />
            <AccountSelector
              accounts={accounts}
              selectedAccounts={selectedAccounts}
              onAccountToggle={handleAccountToggle}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              groupMap={groupMap}
              ignoreForTotal={ignoreForTotal}
              onFileUpload={handleFileUpload}
            />
          </div>

          <div className="chart-container panel-split">
            <div className="main-graph-panel panel-box">
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
                compact={isMobile}
              />
            </div>

            {/* Bottom pie-chart drawer (slides up) */}
            <button aria-label="Toggle pie charts" title="Toggle pie charts" type="button" className={`bottom-drawer-tab ${pieOpen ? 'open' : ''}`} onClick={() => setPieOpen(s => !s)}>
              {pieOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M7 14l5-5 5 5H7z" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
                </svg>
              )}
            </button>

            <div className={`bottom-drawer${pieOpen ? ' open' : ''}`}>
              <div className="panel-box" style={{ height: '100%', overflow: 'auto', padding: 18 }}>
                <PieCharts
                  balances={balances}
                  selectedAccounts={selectedAccounts}
                  groupMap={groupMap}
                  selectedDate={selectedDate}
                  mainCurrency={mainCurrency}
                  theme={theme}
                  compact={isMobile}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
