
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

const NetWorthChart = ({ balances, selectedAccounts, mainCurrency, onPointClick, startDate, endDate, groupMap, timeframe }) => {
  console.log('NetWorthChart balances (full object):', JSON.stringify(balances, null, 2));
  console.log('Account keys:', Object.keys(balances));
  console.log('Selected accounts:', selectedAccounts);
  // Add synthetic groups: networth (all individual accounts), total (all individual accounts minus ignoreForTotal)
  const [ignoreForTotal, setIgnoreForTotal] = React.useState([]);
  React.useEffect(() => {
    fetch('/config/ignoreForTotal.txt').then(res => res.text()).then(txt => {
      setIgnoreForTotal(txt.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    }).catch(() => setIgnoreForTotal([]));
  }, []);

  const chartData = useMemo(() => {
    if (!balances || Object.keys(balances).length === 0) {
      return [];
    }

    // Use groupMap from props (already destructured)

    // Helper to get members for synthetic groups
    // Helper to get all accounts not in any group
    const getIndividualAccounts = (accounts, groupMap) => {
      const groupNames = new Set(Object.keys(groupMap));
      return accounts.filter(a => !groupNames.has(a));
    };

    const getSyntheticGroupMembers = (group) => {
      const allAccounts = Object.keys(balances);
      if (group === 'networth') {
        return getIndividualAccounts(allAccounts, groupMap);
      } else if (group === 'total') {
        return getIndividualAccounts(allAccounts, groupMap).filter(a => !ignoreForTotal.includes(a));
      }
      return [];
    };

    // Get all unique dates, but only display data in the selected timeframe
    const allDates = new Set();
    Object.values(balances).forEach(accountData => {
      Object.keys(accountData).forEach(date => {
        allDates.add(date);
      });
    });


    // Use startDate and endDate props for the timeframe
    const today = moment().format('YYYY-MM-DD');
    const firstDataDate = allDates.size > 0 ? Array.from(allDates).sort()[0] : null;
    // If timeframe is 'All Data', start at first data point; else use selected startDate
    let rangeStart = startDate;
    if (timeframe === 'All Data' && firstDataDate) {
      rangeStart = firstDataDate;
    }
    const rangeEnd = endDate || today;
    let sortedDates = [];
    if (rangeStart && rangeEnd) {
      let current = moment(rangeStart);
      while (current.format('YYYY-MM-DD') <= rangeEnd) {
        sortedDates.push(current.format('YYYY-MM-DD'));
        current = current.add(1, 'day');
      }
    }

    // Filter balances to only include data in the selected timeframe
    const filteredBalances = {};
    Object.entries(balances).forEach(([account, accountData]) => {
      filteredBalances[account] = {};
      Object.entries(accountData).forEach(([date, value]) => {
        if (date >= rangeStart && date <= rangeEnd) {
          filteredBalances[account][date] = value;
        }
      });
    });

    // Helper function to interpolate between two values
    const interpolate = (value1, value2, ratio) => {
      return value1 + (value2 - value1) * ratio;
    };

    // Helper function to find the nearest previous and next values for an account
    const findNearestValues = (account, targetDate) => {
      const accountData = balances[account];
      if (!accountData) return { prev: null, next: null };

      const dates = Object.keys(accountData).sort();
      let prevDate = null;
      let nextDate = null;
      let prevValue = null;
      let nextValue = null;

      // Find the nearest previous date
      for (let i = dates.length - 1; i >= 0; i--) {
        if (dates[i] <= targetDate) {
          prevDate = dates[i];
          prevValue = accountData[dates[i]].balance;
          break;
        }
      }

      // Find the nearest next date
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] >= targetDate) {
          nextDate = dates[i];
          nextValue = accountData[dates[i]].balance;
          break;
        }
      }

      return { prev: { date: prevDate, value: prevValue }, next: { date: nextDate, value: nextValue } };
    };

    // Create data points for each date with interpolation
    // Track last known value for each account
    // Prepare group lines and individual lines
    // For each account, find the last value before rangeStart (if any)
    let lastValueBeforeRange = {};
    selectedAccounts.forEach(account => {
      let members = [];
      if (account === 'networth' || account === 'total') {
        members = getSyntheticGroupMembers(account);
      } else if (groupMap[account]) {
        members = groupMap[account];
      } else {
        members = [account];
      }
      // For groups (real or synthetic), sum last values of members
      let sum = 0;
      let memberHas = false;
      members.forEach(member => {
        const accountData = balances[member];
        if (accountData) {
          const dates = Object.keys(accountData).filter(d => d < rangeStart).sort();
          const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
          if (lastDate) {
            sum += accountData[lastDate].balance;
            memberHas = true;
          }
        }
      });
      lastValueBeforeRange[account] = memberHas ? sum : undefined;
    });

    let chartRows = sortedDates.map((date, idx) => {
      const dataPoint = { date };
      let total = 0;

      selectedAccounts.forEach(account => {
        let members = [];
        if (account === 'networth' || account === 'total') {
          members = getSyntheticGroupMembers(account);
        } else if (groupMap[account]) {
          members = groupMap[account];
        } else {
          members = [account];
        }
        if (members.length > 1) {
          // Group (real or synthetic)
          let groupSum = 0;
          members.forEach(member => {
            const accountData = filteredBalances[member];
            if (accountData && accountData[date]) {
              groupSum += accountData[date].balance;
            } else if (accountData) {
              // Interpolate or extend for member
              const dates = Object.keys(accountData).sort();
              let prev = null, next = null;
              for (let i = 0; i < dates.length; i++) {
                if (dates[i] < date) prev = dates[i];
                if (dates[i] > date) { next = dates[i]; break; }
                if (dates[i] === date) { prev = dates[i]; next = dates[i]; break; }
              }
              if (prev && next && prev !== next) {
                const prevTime = moment(prev).valueOf();
                const nextTime = moment(next).valueOf();
                const currentTime = moment(date).valueOf();
                const ratio = (currentTime - prevTime) / (nextTime - prevTime);
                groupSum += interpolate(accountData[prev].balance, accountData[next].balance, ratio);
              } else if (prev && !next) {
                groupSum += accountData[prev].balance;
              } else if (!prev && next) {
                // Do not extend backward before first data point
                // no-op
              } else if (idx === 0 && lastValueBeforeRange[account] !== undefined) {
                // Extend last value forward to first date in range
                groupSum += lastValueBeforeRange[account];
              }
            } else if (idx === 0 && lastValueBeforeRange[account] !== undefined) {
              // Extend last value forward to first date in range
              groupSum += lastValueBeforeRange[account];
            }
          });
          dataPoint[account] = groupSum;
          total += groupSum;
        } else {
          // Individual account
          const accountData = filteredBalances[account];
          if (accountData && accountData[date]) {
            const balance = accountData[date].balance;
            dataPoint[account] = balance;
            total += balance;
          } else if (accountData) {
            // Interpolate or extend
            const dates = Object.keys(accountData).sort();
            let prev = null, next = null;
            for (let i = 0; i < dates.length; i++) {
              if (dates[i] < date) prev = dates[i];
              if (dates[i] > date) { next = dates[i]; break; }
              if (dates[i] === date) { prev = dates[i]; next = dates[i]; break; }
            }
            if (prev && next && prev !== next) {
              const prevTime = moment(prev).valueOf();
              const nextTime = moment(next).valueOf();
              const currentTime = moment(date).valueOf();
              const ratio = (currentTime - prevTime) / (nextTime - prevTime);
              const interpolatedValue = interpolate(accountData[prev].balance, accountData[next].balance, ratio);
              dataPoint[account] = interpolatedValue;
              total += interpolatedValue;
            } else if (prev && !next) {
              dataPoint[account] = accountData[prev].balance;
              total += accountData[prev].balance;
            } else if (!prev && next) {
              // Do not extend backward before first data point
              // leave undefined so the line does not render
            } else if (idx === 0 && lastValueBeforeRange[account] !== undefined) {
              // Extend last value forward to first date in range
              dataPoint[account] = lastValueBeforeRange[account];
              total += lastValueBeforeRange[account];
            } else {
              dataPoint[account] = 0;
            }
          } else if (idx === 0 && lastValueBeforeRange[account] !== undefined) {
            // Extend last value forward to first date in range
            dataPoint[account] = lastValueBeforeRange[account];
            total += lastValueBeforeRange[account];
          } else {
            dataPoint[account] = 0;
          }
        }
      });

  return dataPoint;
    });

    // Check if all values in the selected range are missing (and only fill if the range is not the full data range)
    const hasAnyDataInRange = chartRows.some(row =>
      selectedAccounts.some(account => row[account] && row[account] !== 0)
    );
    // Only fill if there is no data in the range, and the selected range starts after the first data point
    if (!hasAnyDataInRange && firstDataDate && moment(rangeStart).isAfter(firstDataDate)) {
      // For each account, find the latest value before the start of the timeframe
      let lastValues = {};
      let hasAnyLastValue = false;
      selectedAccounts.forEach(account => {
        if (groupMap[account]) {
          // Sum last values of group members
          let sum = 0;
          let memberHas = false;
          groupMap[account].forEach(member => {
            const accountData = balances[member];
            if (accountData) {
              const dates = Object.keys(accountData).filter(d => d < rangeStart).sort();
              const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
              if (lastDate) {
                sum += accountData[lastDate].balance;
                memberHas = true;
              }
            }
          });
          lastValues[account] = memberHas ? sum : 0;
          hasAnyLastValue = hasAnyLastValue || memberHas;
        } else {
          const accountData = balances[account];
          if (accountData) {
            const dates = Object.keys(accountData).filter(d => d < rangeStart).sort();
            const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
            if (lastDate) {
              lastValues[account] = accountData[lastDate].balance;
              hasAnyLastValue = true;
            } else {
              lastValues[account] = 0;
            }
          } else {
            lastValues[account] = 0;
          }
        }
      });
      if (hasAnyLastValue) {
        // Fill every day in the range with the last value
        chartRows = sortedDates.map(date => {
          const dataPoint = { date };
          let total = 0;
          selectedAccounts.forEach(account => {
            dataPoint[account] = lastValues[account];
            total += lastValues[account];
          });
          return dataPoint;
        });
      } else {
        // No value before rangeStart, show nothing
        chartRows = [];
      }
    }
    // Add a datapoint for today if it doesn't exist, using the last known value for each account
    if (!chartRows.find(row => row.date === today)) {
      const lastRow = chartRows.length > 0 ? chartRows[chartRows.length - 1] : null;
      if (lastRow) {
        const todayRow = { date: today };
        let total = 0;
        selectedAccounts.forEach(account => {
          todayRow[account] = lastRow[account] || 0;
          total += todayRow[account];
        });
  chartRows.push(todayRow);
      }
    }
    // For non-'All Data' timeframes, prepend a data point at the start of the range with the last value before the range
    if (timeframe !== 'All Data' && firstDataDate && moment(rangeStart).isAfter(firstDataDate)) {
      let lastValues = {};
      let hasAnyLastValue = false;
      selectedAccounts.forEach(account => {
        if (groupMap[account]) {
          let sum = 0;
          let memberHas = false;
          groupMap[account].forEach(member => {
            const accountData = balances[member];
            if (accountData) {
              const dates = Object.keys(accountData).filter(d => d < rangeStart).sort();
              const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
              if (lastDate) {
                sum += accountData[lastDate].balance;
                memberHas = true;
              }
            }
          });
          lastValues[account] = memberHas ? sum : 0;
          hasAnyLastValue = hasAnyLastValue || memberHas;
        } else {
          const accountData = balances[account];
          if (accountData) {
            const dates = Object.keys(accountData).filter(d => d < rangeStart).sort();
            const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
            if (lastDate) {
              lastValues[account] = accountData[lastDate].balance;
              hasAnyLastValue = true;
            } else {
              lastValues[account] = 0;
            }
          } else {
            lastValues[account] = 0;
          }
        }
      });
      if (hasAnyLastValue) {
        const firstRow = { date: rangeStart };
        let total = 0;
        selectedAccounts.forEach(account => {
          firstRow[account] = lastValues[account];
          total += lastValues[account];
        });
        firstRow.total = total;
        chartRows = [firstRow, ...chartRows];
      }
    }
    return chartRows;
  }, [balances, selectedAccounts, ignoreForTotal]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: mainCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date) => {
    return moment(date).format('MMM DD, YYYY');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#2d2d2d',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '10px',
          color: '#ffffff'
        }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>
            {formatDate(label)}
          </p>
          {payload.map((entry, index) => {
            const isInterpolated = !balances[entry.dataKey] || !balances[entry.dataKey][label];
            return (
              <p key={index} style={{ 
                margin: '2px 0', 
                color: entry.color,
                fontSize: '12px',
                fontStyle: isInterpolated ? 'italic' : 'normal',
                opacity: isInterpolated ? 0.8 : 1
              }}>
                {entry.name}: {formatCurrency(entry.value)}
                {isInterpolated && <span style={{ fontSize: '10px', marginLeft: '5px' }}>(interpolated)</span>}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const handleChartClick = (data) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const date = data.activePayload[0].payload.date;
      onPointClick(date);
    }
  };

  if (chartData.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
        color: '#cccccc'
      }}>
        No data available for selected accounts and timeframe
      </div>
    );
  }

  const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000',
    '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'
  ];

  return (
    <div style={{ height: '400px', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>
        Net Worth Over Time ({mainCurrency})
        <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#cccccc', marginLeft: '10px' }}>
          (Dots show actual data points, lines interpolate between values)
        </span>
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={handleChartClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            stroke="#cccccc"
            fontSize={12}
          />
          <YAxis 
            tickFormatter={formatCurrency}
            stroke="#cccccc"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} trigger="hover" />
          <Legend />
          {selectedAccounts.map((account, index) => (
            <Line
              key={account}
              type="monotone"
              dataKey={account}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props) => {
                // Only show dots for actual data points, not interpolated ones
                const isActualData = balances[account] && balances[account][props.payload.date];
                return isActualData ? (
                  <circle
                    key={props.payload.date + '-' + account}
                    cx={props.cx}
                    cy={props.cy}
                    r={4}
                    fill={colors[index % colors.length]}
                    stroke="none"
                  />
                ) : null;
              }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
