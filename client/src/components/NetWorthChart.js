import React, { useState, useEffect } from 'react';
import { getFxRate, getFxRatesBatch } from '../utils/fx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

// NetWorth / Total FX-aware interpolation chart
const NetWorthChart = ({ balances = {}, selectedAccounts = [], mainCurrency, onPointClick, startDate, endDate, groupMap = {}, timeframe }) => {
  const [ignoreForTotal, setIgnoreForTotal] = useState([]);
  const [fxCache, setFxCache] = useState({}); // key: date_base_target -> rate
  const [chartData, setChartData] = useState([]);

  // Load ignore list
  useEffect(() => {
    fetch('/config/ignoreForTotal.txt').then(r => r.text()).then(txt => {
      setIgnoreForTotal(txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
    }).catch(() => setIgnoreForTotal([]));
  }, []);

  useEffect(() => {
    (async () => {
      if (!balances || Object.keys(balances).length === 0 || !startDate) {
        setChartData([]);
        return;
      }

      const today = moment().format('YYYY-MM-DD');
      // Collect all dates from balances
      const allDatesSet = new Set();
      Object.values(balances).forEach(acc => Object.keys(acc).forEach(d => allDatesSet.add(d)));
      const allDatesSorted = Array.from(allDatesSet).sort();
      const firstDataDate = allDatesSorted[0];

      // Determine range start
      const rangeStart = (timeframe === 'All Data' && firstDataDate) ? firstDataDate : startDate;
      const rangeEnd = endDate || today;

      // Build sorted date list inclusive
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
          // For every gap we might interpolate on sortedDates
          sortedDates.forEach(date => {
            if (accData[date]) return; // no interpolation needed
            // find prev & next
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
                if (!fxCache[key] && !neededKeys.has(key)) {
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
          setFxCache(prev => ({ ...prev, ...batchRates }));
        }
      }

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
              groupSum += accData[prev].balance;
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

      setChartData(newChartRows);
    })();
  }, [balances, selectedAccounts, mainCurrency, startDate, endDate, timeframe, groupMap, ignoreForTotal]);

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
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={(e) => { if (e && e.activeLabel) onPointClick?.(e.activeLabel, e.activePayload); }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis tickFormatter={v => formatCurrency(v)} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {selectedAccounts.map((acct, idx) => (
            <Line key={acct} type="monotone" dataKey={acct}
              stroke={['#8884d8','#82ca9d','#ffc658','#ff7300','#0088FE','#00C49F','#FFBB28','#FF8042'][idx % 8]}
              strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
