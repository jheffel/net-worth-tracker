import React, { useState, useEffect } from 'react';
//import { getFxRate, getFxRatesBatch } from '../utils/fx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

// NetWorth / Total FX-aware interpolation chart
const NetWorthChart = ({ balances = {}, selectedAccounts = [], mainCurrency, onPointClick, startDate, endDate, groupMap = {}, timeframe, loading: parentLoading = false, theme, ignoreForTotal = [] }) => {
  // Utility: get the earliest and latest date in chartData
  const getDateRange = (data) => {
    if (!data.length) return [null, null];
    const dates = data.map(row => row.date).sort();
    return [dates[0], dates[dates.length - 1]];
  };

  // Utility: clip chartData to timeframe
  const clipChartData = (data, timeframe, selectedAccounts) => {
    if (!data.length || !timeframe || timeframe === 'ALL') return data;

    const filteredData = data.map(row => {
      const newRow = { date: row.date };
      selectedAccounts.forEach(account => {
        if (row.hasOwnProperty(account)) {
          newRow[account] = row[account];
        }
      });
      return newRow;
    }).filter(row => selectedAccounts.some(account => row.hasOwnProperty(account)));
    data = filteredData;

    // Custom timeframe takes precedence
    if (timeframe === 'Custom') {
      if (startDate && endDate) {
        return data.filter(row =>
          moment(row.date).isSameOrAfter(moment(startDate)) &&
          moment(row.date).isSameOrBefore(moment(endDate))
        );
      }
      return data;
    }

    const [_, latest] = getDateRange(data);
    if (!latest) return data;
    let startMoment = moment(latest);
    switch (timeframe) {
      case 'Last Month': startMoment = startMoment.subtract(1, 'months'); break;
      case 'Last 3 Months': startMoment = startMoment.subtract(3, 'months'); break;
      case 'Last 6 Months': startMoment = startMoment.subtract(6, 'months'); break;
      case 'Last Year': startMoment = startMoment.subtract(1, 'years'); break;
      case 'All Data': return data;
      default: return data;
    }
    return data.filter(row => moment(row.date).isSameOrAfter(startMoment));
  };

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

  // Calculate amount changed for the displayed range (main scope)
  // If custom timeframe, clip by startDate and endDate
  let displayedData;
  if (timeframe === 'Custom') {
    displayedData = chartData.filter(row => {
      return moment(row.date).isSameOrAfter(moment(startDate)) && moment(row.date).isSameOrBefore(moment(endDate));
    });
  } else {
    displayedData = clipChartData(chartData, timeframe, selectedAccounts);
  }
  let firstVal = null, lastVal = null;
  if (displayedData.length) {
    // Sum balances for selected accounts
    firstVal = selectedAccounts.reduce((sum, acct) => sum + (displayedData[0][acct] || 0), 0);
    lastVal = selectedAccounts.reduce((sum, acct) => sum + (displayedData[displayedData.length-1][acct] || 0), 0);
  }
  const amountChanged = (firstVal !== null && lastVal !== null) ? lastVal - firstVal : null;

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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
          data={clipChartData(chartData, timeframe, selectedAccounts)}
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
        {/* Amount changed label */}
        {amountChanged !== null && (
          <div style={{
            position: 'absolute',
            left: 12,
            bottom: 8,
            fontSize: 15,
            color: theme === 'light' ? '#384454' : '#eee',
            background: theme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,30,0.85)',
            padding: '4px 12px',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            zIndex: 5
          }}>
            Amount changed: <span style={{ fontWeight: 600 }}>{formatCurrency(amountChanged)}</span>
          </div>
        )}
    </div>
  );
};

export default NetWorthChart;
