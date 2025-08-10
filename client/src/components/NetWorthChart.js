
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

const NetWorthChart = ({ balances, selectedAccounts, mainCurrency, onPointClick }) => {
  console.log('NetWorthChart balances (full object):', JSON.stringify(balances, null, 2));
  console.log('Account keys:', Object.keys(balances));
  console.log('Selected accounts:', selectedAccounts);
  const chartData = useMemo(() => {
    if (!balances || Object.keys(balances).length === 0) {
      return [];
    }

    // Define group membership (should match backend logic)
    const groupMap = {
      operating: ['chequing', 'credit card', 'savings'],
      investing: ['RRSP', 'Margin'],
      crypto: ['Bitcoin', 'Eth'],
      equity: ['mortgage', 'House value'],
      summary: ['chequing', 'credit card', 'savings', 'RRSP', 'Margin', 'Bitcoin', 'Eth', 'mortgage', 'House value']
    };

    // Expand selectedAccounts to include group members for synthetic group lines
    const expandedAccounts = selectedAccounts.flatMap(acc =>
      groupMap[acc] ? groupMap[acc] : acc
    );

    // Get all unique dates
    const allDates = new Set();
    Object.values(balances).forEach(accountData => {
      Object.keys(accountData).forEach(date => {
        allDates.add(date);
      });
    });

    const today = moment().format('YYYY-MM-DD');
    let minDate = today;
    if (allDates.size > 0) {
      minDate = Array.from(allDates).sort()[0];
    }
    let current = moment(minDate);
    let sortedDates = [];
    while (current.format('YYYY-MM-DD') <= today) {
      sortedDates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

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
    let chartRows = sortedDates.map(date => {
      const dataPoint = { date };
      let total = 0;

      selectedAccounts.forEach(account => {
        if (groupMap[account]) {
          // This is a group, sum its members
          let groupSum = 0;
          groupMap[account].forEach(member => {
            const accountData = balances[member];
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
                groupSum += accountData[next].balance;
              }
            }
          });
          dataPoint[account] = groupSum;
          total += groupSum;
        } else {
          // Individual account
          const accountData = balances[account];
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
              dataPoint[account] = accountData[next].balance;
              total += accountData[next].balance;
            } else {
              dataPoint[account] = 0;
            }
          } else {
            dataPoint[account] = 0;
          }
        }
      });

      dataPoint.total = total;
      return dataPoint;
    });

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
        todayRow.total = total;
        chartRows.push(todayRow);
      }
    }
    return chartRows;
  }, [balances, selectedAccounts]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: mainCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
