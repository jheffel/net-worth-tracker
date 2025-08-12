import React, { useState, useEffect } from 'react';
import { getFxRate, getFxRatesBatch } from '../utils/fx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

// NetWorth / Total FX-aware interpolation chart
const NetWorthChart = ({ balances = {}, selectedAccounts = [], mainCurrency, onPointClick, startDate, endDate, groupMap = {}, timeframe, loading: parentLoading = false }) => {
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
        if (group === 'networth') return getIndividualAccounts(allAccounts, groupMap);
        if (group === 'total') return getIndividualAccounts(allAccounts, groupMap).filter(a => !ignoreForTotal.includes(a));
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
          sortedDates.forEach(date => {
            if (accData[date]) return;
            let prev = null, next = null;
            for (let k = 0; k < dateKeys.length; k++) {
              const d = dateKeys[k];
              if (d < date) prev = d;
              if (d > date) { next = d; break; }
            }
            if (prev && next && prev !== next) {
              const rawCurrency = accData[prev].raw_currency;
              if (rawCurrency && rawCurrency !== mainCurrency) {
                const key = `${date}_${rawCurrency}_${mainCurrency}`;
                if (!neededKeys.has(key)) {
                  neededKeys.add(key);
                  neededRequests.push({ date, base: rawCurrency, target: mainCurrency });
                }
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

      // Build chart rows
      let newChartRows = [];
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const row = { date };
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
              // Forward fill: use raw_balance and apply FX for the fill date
              const raw = accData[prev].raw_balance;
              const rawCurrency = accData[prev].raw_currency;
              if (rawCurrency === mainCurrency) {
                groupSum += raw;
              } else {
                let fxKey = `${date}_${rawCurrency}_${mainCurrency}`;
                let fxRate = fxCache[fxKey];
                // Fallback: search for most recent previous FX rate in cache
                if (fxRate == null) {
                  // Try previous dates in sortedDates order
                  for (let b = i - 1; b >= 0; b--) {
                    const prevDate = sortedDates[b];
                    const prevKey = `${prevDate}_${rawCurrency}_${mainCurrency}`;
                    if (fxCache[prevKey] != null) {
                      fxRate = fxCache[prevKey];
                      break;
                    }
                  }
                }
                if (fxRate != null) groupSum += raw * fxRate;
                // else leave as zero (no rate at all)
              }
            } else if (!prev && next) {
              // skip backfill
            } else if (i === 0 && lastValueBeforeRange[account] !== undefined) {
              groupSum += lastValueBeforeRange[account];
            }
          }
          row[account] = groupSum;
        }
        newChartRows.push(row);
      }

      // Insert first rangeStart baseline if missing and timeframe not All Data
      if (timeframe !== 'All Data' && firstDataDate && moment(rangeStart).isAfter(firstDataDate)) {
        if (!newChartRows.find(r => r.date === rangeStart)) {
          const baseRow = { date: rangeStart };
          selectedAccounts.forEach(a => { baseRow[a] = lastValueBeforeRange[a] ?? 0; });
          newChartRows = [baseRow, ...newChartRows];
        }
      }

      // Append today if missing
      if (!newChartRows.find(r => r.date === today) && newChartRows.length) {
        const last = newChartRows[newChartRows.length - 1];
        const todayRow = { date: today };
        selectedAccounts.forEach(a => { todayRow[a] = last[a] || 0; });
        newChartRows.push(todayRow);
      }

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
        <div style={{ backgroundColor: '#2d2d2d', border: '1px solid #444', borderRadius: '4px', padding: '10px', color: '#ffffff' }}>
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
          background: 'rgba(30,30,30,0.7)', zIndex: 10
        }}>
          <div className="spinner" style={{
            border: '6px solid #eee',
            borderTop: '6px solid #8884d8',
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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            padding={{ left: 40, right: 40 }}
            minTickGap={15}
          />
          <YAxis
            tickFormatter={v => formatCurrency(v)}
            padding={{ top: 40, bottom: 40 }}
            minTickGap={15}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {selectedAccounts.map((acct, idx) => (
            <Line
              key={acct}
              type="monotone"
              dataKey={acct}
              stroke={['#8884d8','#82ca9d','#ffc658','#ff7300','#0088FE','#00C49F','#FFBB28','#FF8042'][idx % 8]}
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
