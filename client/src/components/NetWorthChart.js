import React, { useState, useEffect, useRef } from 'react';
//import { getFxRate, getFxRatesBatch } from '../utils/fx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import moment from 'moment';

// NetWorth / Total FX-aware interpolation chart
// Added: onRangeSelect callback for drag-to-select
const NetWorthChart = ({ balances = {}, selectedAccounts = [], mainCurrency, onPointClick, startDate, endDate, groupMap = {}, timeframe, loading: parentLoading = false, theme, ignoreForTotal = [], compact = false, onRangeSelect, showSumLine = false, setShowSumLine }) => {
  // --- Drag-to-select state ---
  const [dragStart, setDragStart] = useState(null); // {x, date} or null
  const [dragEnd, setDragEnd] = useState(null); // {x, date} or null
  const [isDragging, setIsDragging] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [sumData, setSumData] = useState([]);
  const [hoveredYs, setHoveredYs] = useState([]);
  const containerRef = useRef(null);

  // Utility: get x position from event (mouse or touch)
  const getRelativeX = (e) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    if (e.touches && e.touches.length) {
      return e.touches[0].clientX - rect.left;
    } else if (e.changedTouches && e.changedTouches.length) {
      return e.changedTouches[0].clientX - rect.left;
    } else {
      return e.clientX - rect.left;
    }
  };

  // Utility: get date from x position
  const getDateFromX = (x) => {
    if (!chartData.length || !containerRef.current) return null;
    const width = containerRef.current.offsetWidth;
    const idx = Math.round((x / width) * (chartData.length - 1));
    return chartData[Math.max(0, Math.min(chartData.length - 1, idx))].date;
  };

  // Mouse/touch event handlers
  const handleChartMouseDown = (e) => {
    if (parentLoading) return;
    const x = getRelativeX(e);
    const date = getDateFromX(x);
    setDragStart({ x, date });
    setDragEnd(null);
    setIsDragging(true);
  };
  const handleChartMouseMoveDrag = (e) => {
    if (!isDragging) return;
    const x = getRelativeX(e);
    const date = getDateFromX(x);
    setDragEnd({ x, date });
  };
  const handleChartMouseUp = (e) => {
    setIsDragging(false);
    const x = getRelativeX(e);
    const date = getDateFromX(x);
    let start = dragStart?.date;
    let end = date;
    if (start && end) {
      if (moment(start).isAfter(moment(end))) {
        [start, end] = [end, start];
      }
      if (start !== end) {
        onRangeSelect?.(start, end);
      } else {
        onRangeSelect?.(null, null);
      }
    } else {
      onRangeSelect?.(null, null);
    }
    setDragStart(null);
    setDragEnd(null);
  };
  // Touch events
  const handleTouchStart = (e) => { handleChartMouseDown(e); };
  const handleTouchMove = (e) => { handleChartMouseMoveDrag(e); };
  const handleTouchEnd = (e) => { handleChartMouseUp(e); };

  // Handler to update hoveredYs on mouse move
  const handleMouseMove = (state) => {
    if (!state || !state.activePayload || !state.activePayload.length) {
      setHoveredYs([]);
      return;
    }
    setHoveredYs(state.activePayload.map(p => p.value));
  };
  const handleMouseLeave = () => setHoveredYs([]);

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

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      const dateAccountMap = {};
      for (const [account, dates] of Object.entries(balances)) {
        for (const [date, balance] of Object.entries(dates)) {
          if (!dateAccountMap[date]) dateAccountMap[date] = { date };
          if (!dateAccountMap[date][account]) dateAccountMap[date][account] = balance;
        }
      }
      const newChartRows = Object.values(dateAccountMap).sort((a, b) => a.date.localeCompare(b.date));
      if (!cancelled) setChartData(newChartRows);
      if (showSumLine && selectedAccounts.length > 0) {
        const sumRows = newChartRows.map(row => {
          let sum = selectedAccounts.reduce((acc, acct) => acc + (row[acct] || 0), 0);
          return { date: row.date, __sum__: sum };
        });
        if (!cancelled) setSumData(sumRows);
      } else {
        if (!cancelled) setSumData([]);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [balances, selectedAccounts, mainCurrency, startDate, endDate, timeframe, groupMap, ignoreForTotal, showSumLine]);

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



  // --- Highlight region rendering ---
  let highlight = null;
  if (isDragging && dragStart && dragEnd && dragStart.x !== null && dragEnd.x !== null) {
    const left = Math.min(dragStart.x, dragEnd.x);
    const width = Math.abs(dragEnd.x - dragStart.x);
    highlight = (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left,
          width,
          height: '100%',
          background: 'rgba(53, 87, 183, 0.18)',
          pointerEvents: 'none',
          zIndex: 8,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', userSelect: isDragging ? 'none' : undefined }}
      onMouseDown={handleChartMouseDown}
      onMouseMove={handleChartMouseMoveDrag}
      onMouseUp={handleChartMouseUp}
      onMouseLeave={() => { setIsDragging(false); setDragStart(null); setDragEnd(null); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toggle for plotting sum of selected accounts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, justifyContent: 'flex-end' }}>
        <input
          type="checkbox"
          id="show-sum-line"
          checked={!!showSumLine}
          onChange={e => setShowSumLine?.(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        <label htmlFor="show-sum-line" style={{ fontSize: 14, color: 'var(--text-primary)', userSelect: 'none', marginRight: 8 }}>
          Plot sum of selected accounts
        </label>
      </div>
      {highlight}
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
      <ResponsiveContainer height={'100%'}>
        <LineChart
          data={clipChartData(
            chartData.map(row => {
              // Always include all selected account keys, even if value is 0, to keep columns stable
              const newRow = { ...row };
              selectedAccounts.forEach(acct => {
                if (!(acct in newRow)) newRow[acct] = 0;
              });
              return newRow;
            }),
            timeframe,
            selectedAccounts
          )}
          margin={compact ? { top: 12, right: 18, left: 18, bottom: 12 } : { top: 16, right: 24, left: 24, bottom: 20 }}
          onClick={(e) => { if (e && e.activeLabel) onPointClick?.(e.activeLabel, e.activePayload); }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {hoveredYs && hoveredYs.length > 0 && hoveredYs.map((y, i) => (
            <ReferenceLine
              key={i}
              y={y}
              stroke={theme === 'light' ? '#888' : '#fff'}
              strokeWidth={1}
              strokeDasharray={undefined}
            />
          ))}
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#d0d5dd' : '#444'} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            padding={compact ? { left: 12, right: 12 } : { left: 40, right: 40 }}
            minTickGap={compact ? 8 : 15}
            stroke={theme === 'light' ? '#384454' : '#aaa'}
            tick={{ fill: theme === 'light' ? '#384454' : '#ddd', fontSize: compact ? 10 : 12 }}
          />
          <YAxis
            width={72}
            tickFormatter={v => formatCurrency(v)}
            padding={compact ? { top: 12, bottom: 12 } : { top: 12, bottom: 12 }}
            minTickGap={compact ? 8 : 15}
            stroke={theme === 'light' ? '#384454' : '#aaa'}
            tick={{ fill: theme === 'light' ? '#384454' : '#ddd', fontSize: compact ? 10 : 12 }}
            domain={(() => {
              // Compute min/max across all selected accounts and sum (if shown)
              let min = Infinity, max = -Infinity;
              const data = clipChartData(
                chartData.map(row => {
                  const newRow = { ...row };
                  selectedAccounts.forEach(acct => {
                    if (!(acct in newRow)) newRow[acct] = 0;
                  });
                  return newRow;
                }),
                timeframe,
                selectedAccounts
              );
              data.forEach(row => {
                selectedAccounts.forEach(acct => {
                  if (typeof row[acct] === 'number') {
                    if (row[acct] < min) min = row[acct];
                    if (row[acct] > max) max = row[acct];
                  }
                });
              });
              if (showSumLine && sumData.length > 0) {
                const sumRows = clipChartData(sumData, timeframe, ['__sum__']);
                sumRows.forEach(row => {
                  if (typeof row.__sum__ === 'number') {
                    if (row.__sum__ < min) min = row.__sum__;
                    if (row.__sum__ > max) max = row.__sum__;
                  }
                });
              }
              if (!isFinite(min) || !isFinite(max)) return ['auto', 'auto'];
              if (min === max) return [min - 1, max + 1];
              // Add a small margin
              const margin = (max - min) * 0.05;
              return [min - margin, max + margin];
            })()}
          />
          <Tooltip content={<CustomTooltip />} wrapperStyle={compact ? { fontSize: '0.85em', padding: 2 } : {}} />
          <Legend wrapperStyle={{ color: 'var(--text-primary)', fontSize: compact ? '0.85em' : undefined }} />
          {selectedAccounts.map((acct, idx) => (
            <Line
              key={acct}
              type="monotone"
              dataKey={acct}
              stroke={(theme === 'light'
                ? ['#3557b7','#1f8f5f','#c28a00','#d45800','#005fb3','#009f7a','#b8860b','#cc5c28']
                : ['#8884d8','#82ca9d','#ffc658','#ff7300','#0088FE','#00C49F','#FFBB28','#FF8042'])[idx % 8]}
              strokeWidth={compact ? 1.5 : 2}
              dot={false}
              activeDot={{ r: compact ? 4 : 6 }}
            />
          ))}
          {showSumLine && sumData.length > 0 && (
            <Line
              type="monotone"
              dataKey="__sum__"
              data={clipChartData(sumData, timeframe, ['__sum__'])}
              stroke="#e91e63"
              strokeWidth={compact ? 2.5 : 3}
              dot={false}
              activeDot={{ r: compact ? 5 : 7 }}
              name="Sum of Selected"
              legendType="rect"
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
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
}
export default NetWorthChart;
