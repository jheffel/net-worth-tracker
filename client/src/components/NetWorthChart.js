import React, { useState, useEffect } from 'react';
import { getFxRate, getFxRatesBatch } from '../utils/fx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

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

// NetWorth / Total FX-aware interpolation chart
const NetWorthChart = ({ balances = {}, selectedAccounts = [], mainCurrency, onPointClick, startDate, endDate, groupMap = {}, timeframe, loading: parentLoading = false, theme }) => {
  const [ignoreForTotal, setIgnoreForTotal] = useState([]);
  const [fxCache, setFxCache] = useState({}); // key: date_base_target -> rate
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load ignore list
  useEffect(() => {
    fetch('/config/ignoreForTotal.txt').then(r => r.text()).then(txt => {
      setIgnoreForTotal(txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
    }).catch(() => setIgnoreForTotal([]));
  }, []);

  // Effect 1: Fetch FX rates and update fxCache
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!balances || Object.keys(balances).length === 0 || !startDate) {
        setFxCache({});
        setLoading(false);
        return;
      }

      const today = moment().format('YYYY-MM-DD');
      const allDatesSet = new Set();
      Object.values(balances).forEach(acc => Object.keys(acc).forEach(d => allDatesSet.add(d)));
      const allDatesSorted = Array.from(allDatesSet).sort();
      const firstDataDate = allDatesSorted[0];
      const rangeStart = (timeframe === 'All Data' && firstDataDate) ? firstDataDate : startDate;
      const rangeEnd = endDate || today;
      const sortedDates = [];
      let cur = moment(rangeStart);
      while (cur.format('YYYY-MM-DD') <= rangeEnd) {
        sortedDates.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }

      // Utility helpers
      const getIndividualAccounts = (accounts, gmap) => {
        const groupNames = new Set(Object.keys(gmap));
        return accounts.filter(a => !groupNames.has(a));
      };
      const getSyntheticGroupMembers = (group) => {
        const allAccounts = Object.keys(balances);
        if (group === 'networth') return Object.keys(balances);
        //if (group === 'networth') return getIndividualAccounts(allAccounts, groupMap);
        if (group === 'total') return Object.keys(balances).filter(a => !ignoreForTotal.includes(a));
        //if (group === 'total') return getIndividualAccounts(allAccounts, groupMap).filter(a => !ignoreForTotal.includes(a));
        return [];
      };

      // Collect needed FX requests for interpolation ahead of time
      const neededRequests = [];
      const neededKeys = new Set();
      selectedAccounts.forEach(account => {
        let members = [];
        if (account === 'networth' || account === 'total') members = getSyntheticGroupMembers(account);
        else if (groupMap[account]) members = groupMap[account];
        else members = [account];
        members.forEach(member => {
          const accData = balances[member];
          if (!accData) return;
          const dateKeys = Object.keys(accData).sort();
          // Always fetch FX rates for all chart dates up to today, even after last real data point
          sortedDates.forEach(date => {
            let rawCurrency = null;
            if (accData[date] && accData[date].raw_currency) {
              rawCurrency = accData[date].raw_currency;
            } else if (dateKeys.length) {
              // Use last known currency before this date
              for (let k = dateKeys.length - 1; k >= 0; k--) {
                const d = dateKeys[k];
                if (d <= date && accData[d].raw_currency) {
                  rawCurrency = accData[d].raw_currency;
                  break;
                }
              }
            }
            if (rawCurrency && rawCurrency !== mainCurrency) {
              const key = `${date}_${rawCurrency}_${mainCurrency}`;
              if (!neededKeys.has(key)) {
                neededKeys.add(key);
                neededRequests.push({ date, base: rawCurrency, target: mainCurrency });
              }
            }
          });
        });
      });

      if (neededRequests.length) {
        const batchRates = await getFxRatesBatch(neededRequests);
        if (batchRates) {
          if (!cancelled) setFxCache(prev => ({ ...prev, ...batchRates }));
        }
      } else {
        if (!cancelled) setFxCache(prev => ({ ...prev }));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [balances, selectedAccounts, mainCurrency, startDate, endDate, timeframe, groupMap, ignoreForTotal]);


  


  // Effect 2: Build chartData after fxCache is updated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!balances || Object.keys(balances).length === 0 || !startDate) {
        setChartData([]);
        return;
      }

      const today = moment().format('YYYY-MM-DD');
      const allDatesSet = new Set();
      Object.values(balances).forEach(acc => Object.keys(acc).forEach(d => allDatesSet.add(d)));
      const allDatesSorted = Array.from(allDatesSet).sort();
      const firstDataDate = allDatesSorted[0];
      const rangeStart = (timeframe === 'All Data' && firstDataDate) ? firstDataDate : startDate;
      const rangeEnd = endDate || today;
      const sortedDates = [];
      let cur = moment(rangeStart);
      while (cur.format('YYYY-MM-DD') <= rangeEnd) {
        sortedDates.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }

      // Utility helpers
      const getIndividualAccounts = (accounts, gmap) => {
        const groupNames = new Set(Object.keys(gmap));
        return accounts.filter(a => !groupNames.has(a));
      };
      const getSyntheticGroupMembers = (group) => {
        const allAccounts = Object.keys(balances);
        if (group === 'networth') return getIndividualAccounts(allAccounts, groupMap);
        if (group === 'total') return getIndividualAccounts(allAccounts, groupMap).filter(a => !ignoreForTotal.includes(a));
        return [];
      };
      const interpolate = (v1, v2, r) => v1 + (v2 - v1) * r;

      /*
      // Pre-calc last value before range for each selected account/group
      const lastValueBeforeRange = {};
      selectedAccounts.forEach(account => {
        let members = [];
        if (account === 'networth' || account === 'total') members = getSyntheticGroupMembers(account);
        else if (groupMap[account]) members = groupMap[account];
        else members = [account];
        let sum = 0; let has = false;
        members.forEach(m => {
          const accData = balances[m];
            if (accData) {
              const ds = Object.keys(accData).filter(d => d < rangeStart).sort();
              const last = ds.length ? ds[ds.length - 1] : null;
              if (last) { sum += accData[last].balance; has = true; }
            }
        });
        if (has) lastValueBeforeRange[account] = sum;
      });
      */

      // Build chart rows
      let newChartRows = [];
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const row = { date };
        let hasRealData = false;
        for (const account of selectedAccounts) {
          let members = [];
          if (account === 'networth' || account === 'total') members = getSyntheticGroupMembers(account);
          else if (groupMap[account]) members = groupMap[account];
          else members = [account];
          let groupSum = 0;
          for (const member of members) {
            const accData = balances[member];
            if (!accData) continue;
            if (accData[date]) {
              groupSum += accData[date].balance;
              hasRealData = true;
              continue;
            }
            const dateKeys = Object.keys(accData).sort();
            let prev = null, next = null;
            for (let k = 0; k < dateKeys.length; k++) {
              const d = dateKeys[k];
              if (d < date) prev = d;
              if (d > date) { next = d; break; }
            }
            if (prev && next && prev !== next) {
              const prevTime = moment(prev).valueOf();
              const nextTime = moment(next).valueOf();
              const curTime = moment(date).valueOf();
              const ratio = (curTime - prevTime) / (nextTime - prevTime);
              const prevRaw = accData[prev].raw_balance;
              const nextRaw = accData[next].raw_balance;
              const interpolatedRaw = interpolate(prevRaw, nextRaw, ratio);
              const rawCurrency = accData[prev].raw_currency;
              if (rawCurrency === mainCurrency) {
                groupSum += interpolatedRaw;
              } else {
                const fxKey = `${date}_${rawCurrency}_${mainCurrency}`;
                const fxRate = fxCache[fxKey];
                if (fxRate != null) groupSum += interpolatedRaw * fxRate;
              }
            } else if (prev && !next) {
              // Forward fill: use last known raw_balance, always apply the FX rate for the current chart date
              console.log(`Forward fill prev for ${date}: prev=${prev}, accData[prev]=`, accData[prev]);
              const raw = accData[prev].raw_balance;
              const rawCurrency = accData[prev].raw_currency;
              if (rawCurrency === mainCurrency) {
                groupSum += raw;
              } else {
                // Use the FX rate for the current chart date
                const formattedDate = moment(date).format('YYYY-MM-DD');
                const fxKey = `${formattedDate}_${rawCurrency}_${mainCurrency}`;
                let fxRate = fxCache[fxKey];
                if (fxRate === undefined) {
                  // Try reciprocal
                  const reciprocalKey = `${formattedDate}_${mainCurrency}_${rawCurrency}`;
                  const reciprocalRate = fxCache[reciprocalKey];
                  if (reciprocalRate != null && reciprocalRate !== 0) {
                    fxRate = 1.0 / reciprocalRate;
                    console.log(`Used reciprocal FX rate for ${fxKey}:`, fxRate);
                  }
                }
                console.log('Forward fill:', { date, formattedDate, rawCurrency, mainCurrency, fxKey, fxRate });
                console.log('fxCache keys:', Object.keys(fxCache));
                console.log(`fxCache[${fxKey}]:`, fxCache[fxKey], 'Type:', typeof fxCache[fxKey]);
                // If not found, search backwards for the most recent available FX rate
                if (fxRate == null) {
                  for (let b = i - 1; b >= 0; b--) {
                    const prevDate = sortedDates[b];
                    const prevKey = `${prevDate}_${rawCurrency}_${mainCurrency}`;
                    if (fxCache[prevKey] != null) {
                      fxRate = fxCache[prevKey];
                      break;
                    }
                  }
                }
                console.log('fxCache:', fxCache);
                if (fxRate != null) {
                  const computedValue = raw * fxRate;
                  console.log(`Forward fill value for ${date}: raw=${raw}, fxRate=${fxRate}, computed=${computedValue}`);
                  groupSum += computedValue;
                }
                // else leave as zero (no rate at all)
              }
            } else if (!prev && next) {
              // skip backfill
            //} else if (i === 0 && lastValueBeforeRange[account] !== undefined) {
            //  groupSum += lastValueBeforeRange[account];
            }
          }



          for (const member of members) {
            const accData = balances[member];
            if (!accData) continue;
            if (accData[date] && accData[date].ticker && accData[date].raw_balance != null) {
              // If there's a ticker, fetch its price and add to groupSum
              const ticker = accData[date].ticker;
              const rawBalance = accData[date].raw_balance;
              const price = accData[date].price; // Assume price is pre-fetched and present in accData
              if (price != null) {
                groupSum += rawBalance * price;
                hasRealData = true;
              }
            }
          }


          row[account] = groupSum;
        }
        row._hasRealData = hasRealData;
        newChartRows.push(row);
        if (i > 0 && !row._hasRealData) {
          console.log(`Chart row for ${date}:`, row);
        }
      }

      // Remove leading rows with only zero values (before any real data)
      let firstRealIdx = newChartRows.findIndex(r => r._hasRealData);
      if (firstRealIdx > 0) {
        newChartRows = newChartRows.slice(firstRealIdx);
      }
      newChartRows.forEach(r => { delete r._hasRealData; });

      /*
      // Insert first rangeStart baseline if missing and timeframe not All Data
      if (timeframe !== 'All Data' && firstDataDate && moment(rangeStart).isAfter(firstDataDate)) {
        if (!newChartRows.find(r => r.date === rangeStart)) {
          const baseRow = { date: rangeStart };
          selectedAccounts.forEach(a => { baseRow[a] = lastValueBeforeRange[a] ?? 0; });
          newChartRows = [baseRow, ...newChartRows];
        }
      }
      */

      /*
      // Append today if missing
      if (!newChartRows.find(r => r.date === today) && newChartRows.length) {
        const last = newChartRows[newChartRows.length - 1];
        const todayRow = { date: today };
        selectedAccounts.forEach(a => { todayRow[a] = last[a] || 0; });
        newChartRows.push(todayRow);
      }
        */

      if (!cancelled) setChartData(newChartRows);
    })();
    return () => { cancelled = true; };
  }, [balances, selectedAccounts, mainCurrency, startDate, endDate, timeframe, groupMap, ignoreForTotal, fxCache]);

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: mainCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {(loading || parentLoading) && (
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
