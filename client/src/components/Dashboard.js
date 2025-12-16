import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';

import NetWorthChart from './NetWorthChart';
import PieCharts from './PieCharts';
import AccountSelector from './AccountSelector';
import Controls from './Controls';
import GroupManager from './GroupManager';
import '../App.css';
import '../chartLayout.css';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
    // State for sum toggle
    const [showSumLine, setShowSumLine] = useState(false);
    const { logout, user } = useAuth();

    // Sidebar drawer state (slides in on desktop and mobile)
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
    const [groupManagerOpen, setGroupManagerOpen] = useState(false);
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;

    // Close sidebar on navigation or overlay click
    const handleSidebarClose = () => setSidebarOpen(false);
    const handleRightSidebarClose = () => setRightSidebarOpen(false);

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

    // When layout-affecting drawers open/close, trigger a resize so charts recalc width/height
    // When layout-affecting drawers open/close, trigger a resize so charts recalc width/height
    useEffect(() => {
        if (typeof window === 'undefined') return;
        // dispatch a couple times: soon after toggle and after CSS transition
        const dispatchResize = () => window.dispatchEvent(new Event('resize'));
        const t1 = setTimeout(dispatchResize, 80);
        const t2 = setTimeout(dispatchResize, 360);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [sidebarOpen, rightSidebarOpen, pieOpen]);

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
            setError('Failed to load initial data. Authentication might be required.');
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
            // console.log('Requesting balances with params:', params);
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

    return (
        <div className="App">
            <div className="container">
                {/* Drawer tab - fixed on left edge to pull/push the sidebar */}
                <button aria-label="Toggle menu" title="Toggle menu" type="button" className={`drawer-tab ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(s => !s)}>
                    {sidebarOpen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" fill="currentColor" />
                        </svg>
                    )}
                </button>

                {/* Right sidebar tab */}
                <button aria-label="Toggle user menu" title="Toggle user menu" type="button" className={`right-drawer-tab ${rightSidebarOpen ? 'open' : ''}`} onClick={() => setRightSidebarOpen(s => !s)}>
                    {rightSidebarOpen ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor" />
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                    {/* Sidebar overlay shared? No, maybe independent or shared. Let's make them independent for now. */}
                    {(sidebarOpen || rightSidebarOpen) && (
                        <div className="sidebar-overlay" onClick={() => { setSidebarOpen(false); setRightSidebarOpen(false); }} />
                    )}
                    {/* Right Sidebar Drawer */}
                    <div className={`right-sidebar drawer${rightSidebarOpen ? ' open' : ''}`}>
                        <div className="sidebar-header">
                            <h1 style={{ margin: 0 }}>My Profile</h1>
                        </div>
                        <div className="right-sidebar-content">
                            <div className="user-info-large" style={{ padding: '20px 0', textAlign: 'center' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <h3 style={{ margin: 0 }}>{user?.username}</h3>
                            </div>

                            <div className="right-sidebar-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 12px' }}>
                                <button onClick={() => setGroupManagerOpen(true)} className="btn" title="Manage Groups" style={{ justifyContent: 'flex-start', display: 'flex', gap: '10px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span>Manage Groups</span>
                                </button>
                                <button aria-label="Toggle theme" title="Toggle theme" type="button" onClick={toggleTheme} className="btn" style={{ justifyContent: 'flex-start', display: 'flex', gap: '10px' }}>
                                    {theme === 'dark' ? (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor" />
                                            </svg>
                                            <span>Dark Mode</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.8 1.8-1.8zM1 13h3v-2H1v2zm10 9h2v-3h-2v3zm7.24-2.84l1.79 1.79 1.79-1.79-1.79-1.8-1.79 1.8zM20 11v2h3v-2h-3zM4.22 19.78l1.79-1.79-1.79-1.79L2.43 18l1.79 1.78zM12 5a7 7 0 100 14 7 7 0 000-14z" fill="currentColor" />
                                            </svg>
                                            <span>Light Mode</span>
                                        </>
                                    )}
                                </button>
                                <button aria-label="Toggle fullscreen" title="Toggle fullscreen" type="button" onClick={handleToggleFullscreen} className="btn" style={{ justifyContent: 'flex-start', display: 'flex', gap: '10px' }}>
                                    {isFullscreen ? (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                <path d="M6 6h6V4H4v8h2V6zm12 12h-6v2h8v-8h-2v6zM6 18v-6H4v8h8v-2H6zm12-12v6h2V4h-8v2h6z" fill="currentColor" />
                                            </svg>
                                            <span>Exit Fullscreen</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                                <path d="M3 3h8v2H5v6H3V3zm10 0h8v8h-2V5h-6V3zm8 18h-8v-2h6v-6h2v8zM3 21v-8h2v6h6v2H3z" fill="currentColor" />
                                            </svg>
                                            <span>Fullscreen</span>
                                        </>
                                    )}
                                </button>
                                <button onClick={logout} className="btn" title="Logout" style={{ justifyContent: 'flex-start', display: 'flex', gap: '10px', color: '#ff6b6b' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span>Logout</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Sidebar drawer */}
                    <div className={`sidebar drawer${sidebarOpen ? ' open' : ''}`}>
                        <div className="sidebar-header">
                            <h1 style={{ margin: 0 }}>Net Worth Tracker</h1>
                            <div className="sidebar-actions">
                                {/* Actions moved to right sidebar */}
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
                            onGroupChange={(groupName, groupAccounts) => {
                                setSelectedAccounts(groupAccounts);
                                loadGroupMap();
                                loadInitialData();
                            }}
                            onGroupSelect={groupAccounts => setSelectedAccounts(groupAccounts)}
                            showSumLine={showSumLine}
                            setShowSumLine={setShowSumLine}
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
                                onRangeSelect={(start, end) => {
                                    if (start && end) {
                                        setStartDate(start);
                                        setEndDate(end);
                                        setTimeframe('Custom');
                                    } else {
                                        setTimeframe('All Data');
                                    }
                                }}
                                showSumLine={showSumLine}
                                setShowSumLine={setShowSumLine}
                            />
                        </div>

                        {/* Bottom pie-chart drawer (slides up) */}
                        <button aria-label="Toggle pie charts" title="Toggle pie charts" type="button" className={`bottom-drawer-tab ${pieOpen ? 'open' : ''}`} onClick={() => setPieOpen(s => !s)}>
                            {pieOpen ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                    <path d="M7 14l5-5 5 5H7z" fill="currentColor" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                    <path d="M7 10l5 5 5-5H7z" fill="currentColor" />
                                </svg>
                            )}
                        </button>

                        <div className={`bottom-drawer${pieOpen ? ' open' : ''}`} role="dialog" aria-label="Pie charts drawer" aria-hidden={!pieOpen}>
                            <div className="panel-box" style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
                                <div className="drawer-header">
                                    <div className="drawer-header-title">Portfolio Distribution - {moment(selectedDate).format('MMM DD, YYYY')}</div>
                                    <button className="drawer-close-btn" aria-label="Close pie charts" onClick={() => setPieOpen(false)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 105.7 7.11L10.59 12l-4.9 4.89a1 1 0 101.41 1.41L12 13.41l4.89 4.9a1 1 0 001.41-1.41L13.41 12l4.9-4.89a1 1 0 000-1.4z" fill="currentColor" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="piecharts-content" style={{ overflow: 'auto', padding: 18, height: 'calc(100% - 56px)' }}>
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

                {groupManagerOpen && (
                    <GroupManager
                        user={user}
                        allAccounts={accounts}
                        groupMap={groupMap}
                        onClose={() => setGroupManagerOpen(false)}
                        onUpdate={() => {
                            loadGroupMap(); // Reload groups
                            loadBalances(); // Reload balances to reflect changes if necessary
                            loadInitialData(); // Also reload accounts
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default Dashboard;
