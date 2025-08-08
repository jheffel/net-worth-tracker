import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

const NetWorthChart = ({ balances, selectedAccounts, mainCurrency, onPointClick }) => {
  const chartData = useMemo(() => {
    if (!balances || Object.keys(balances).length === 0) {
      return [];
    }

    // Get all unique dates
    const allDates = new Set();
    Object.values(balances).forEach(accountData => {
      Object.keys(accountData).forEach(date => {
        allDates.add(date);
      });
    });

    // Convert to array and sort
    const sortedDates = Array.from(allDates).sort();

    // Create data points for each date
    return sortedDates.map(date => {
      const dataPoint = { date };
      let total = 0;

      selectedAccounts.forEach(account => {
        if (balances[account] && balances[account][date]) {
          const balance = balances[account][date].balance;
          dataPoint[account] = balance;
          total += balance;
        } else {
          dataPoint[account] = 0;
        }
      });

      dataPoint.total = total;
      return dataPoint;
    });
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
          {payload.map((entry, index) => (
            <p key={index} style={{ 
              margin: '2px 0', 
              color: entry.color,
              fontSize: '12px'
            }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
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
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {selectedAccounts.map((account, index) => (
            <Line
              key={account}
              type="monotone"
              dataKey={account}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NetWorthChart;
