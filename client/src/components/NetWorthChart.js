import React, { useState, useEffect } from 'react';
//import { getFxRate, getFxRatesBatch } from '../utils/fx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';
/*
// Utility: fetch stock price for a ticker and date
async function getStockPrice(ticker, date) {
  // You may want to cache results for performance
  try {
    const res = await fetch(`/api/stock-price?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.price ?? null;
  } catch {
    return null;
  }
}
*/

/*
// Utility: flatten and factor in stock prices
async function flattenBalancesWithStock(balances) {
  const rows = [];
  for (const [account, currencies] of Object.entries(balances)) {
    for (const [currency, tickers] of Object.entries(currencies)) {
      for (const [ticker, dates] of Object.entries(tickers)) {
        for (const [date, balance] of Object.entries(dates)) {
          let value = balance;
          if (ticker) {
            const price = await getStockPrice(ticker, date);
            if (price != null) value = balance * price;
          }
          rows.push({ account, currency, ticker, date, balance: value });
        }
      }
    }
  }
  return rows;
}
*/

// NetWorth / Total FX-aware interpolation chart
const NetWorthChart = ({ balances = {}, selectedAccounts = [], mainCurrency, onPointClick, startDate, endDate, groupMap = {}, timeframe, loading: parentLoading = false, theme, ignoreForTotal = [] }) => {
  //const [fxCache, setFxCache] = useState({}); // key: date_base_target -> rate
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      //build the chart rows in Recharts format
      const dateAccountMap = {};
      for (const [account, dates] of Object.entries(balances)) {
        for (const [date, balance] of Object.entries(dates)) {
          if (!dateAccountMap[date]) dateAccountMap[date] = { date };
          if (!dateAccountMap[date][account]) dateAccountMap[date][account] = balance;
        }
      }

      // Convert map to sorted array
      const newChartRows = Object.values(dateAccountMap).sort((a, b) => a.date.localeCompare(b.date));
      if (!cancelled) setChartData(newChartRows);
    };
    fetchData();
    return () => { cancelled = true; };
  }, [balances, selectedAccounts, mainCurrency, startDate, endDate, timeframe, groupMap, ignoreForTotal]);

  
  const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: mainCurrency, minimumFractionDigits: 2, maximumFractionDigits: 6
  }).format(value || 0);
  
  const formatDate = (date) => moment(date).format('MMM DD, YYYY');

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--control-border)', borderRadius: '4px', padding: '10px', color: 'var(--text-primary)' }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{formatDate(label)}</p>
          {payload.map((entry, i) => {
            const isRaw = balances[entry.dataKey] && balances[entry.dataKey][label];
            const isInterpolated = !isRaw;
            return (
              <p key={i} style={{ margin: '2px 0', color: entry.color, fontSize: '12px', fontStyle: isInterpolated ? 'italic' : 'normal', opacity: isInterpolated ? 0.8 : 1 }}>
                {entry.name}: {formatCurrency(entry.value)}{isInterpolated && <span style={{ fontSize: '10px', marginLeft: 5 }}>(interpolated)</span>}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Busy bar component
  const BusyBar = () => (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      background: 'linear-gradient(90deg, #4361ee 0%, #6d89ff 100%)',
      zIndex: 20,
      animation: 'busybar-move 1.2s linear infinite'
    }}>
      <style>{`
        @keyframes busybar-move {
          0% { background-position: 0% 0; }
          100% { background-position: 100% 0; }
        }
      `}</style>
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {parentLoading && <BusyBar />}
      {parentLoading && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(30,30,30,0.7)', zIndex: 10
        }}>
          <div className="spinner" style={{
            border: theme === 'light' ? '6px solid #e0e6ef' : '6px solid #eee',
            borderTop: theme === 'light' ? '6px solid #3557b7' : '6px solid #8884d8',
            borderRadius: '50%',
            width: 48, height: 48,
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
        </div>
      )}
      <ResponsiveContainer>
        <LineChart
          data={chartData}
          margin={{ top: 30, right: 60, left: 60, bottom: 40 }}
          onClick={(e) => { if (e && e.activeLabel) onPointClick?.(e.activeLabel, e.activePayload); }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#d0d5dd' : '#444'} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            padding={{ left: 40, right: 40 }}
            minTickGap={15}
            stroke={theme === 'light' ? '#384454' : '#aaa'}
            tick={{ fill: theme === 'light' ? '#384454' : '#ddd', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={v => formatCurrency(v)}
            padding={{ top: 40, bottom: 40 }}
            minTickGap={15}
            stroke={theme === 'light' ? '#384454' : '#aaa'}
            tick={{ fill: theme === 'light' ? '#384454' : '#ddd', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: 'var(--text-primary)' }} />
          {selectedAccounts.map((acct, idx) => (
            <Line
              key={acct}
              type="monotone"
              dataKey={acct}
              stroke={(theme === 'light'
                ? ['#3557b7','#1f8f5f','#c28a00','#d45800','#005fb3','#009f7a','#b8860b','#cc5c28']
                : ['#8884d8','#82ca9d','#ffc658','#ff7300','#0088FE','#00C49F','#FFBB28','#FF8042'])[idx % 8]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
