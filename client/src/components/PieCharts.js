import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import moment from 'moment';


const PieCharts = ({ balances, selectedAccounts, groupMap, selectedDate, mainCurrency }) => {

  const chartTypes = [
    { key: 'operating', title: 'Operating Accounts' },
    { key: 'investing', title: 'Investment Accounts' },
    { key: 'crypto', title: 'Crypto Accounts' },
    { key: 'equity', title: 'Equity Accounts' },
    { key: 'summary', title: 'Summary Distribution' }
  ];

  const colors = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000',
    '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'
  ];


  // Helper: interpolate value for a given date from accountData
  const interpolateValue = (accountData, date) => {
    if (!accountData) return 0;
    const dates = Object.keys(accountData).sort();
    if (dates.length === 0) return 0;
    if (accountData[date]) return accountData[date].balance;
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
      return accountData[prev].balance + (accountData[next].balance - accountData[prev].balance) * ratio;
    } else if (prev && !next) {
      return accountData[prev].balance;
    } else if (!prev && next) {
      // Do not extend backward
      return 0;
    }
    return 0;
  };

  // Build pie data for each chart type
  const buildPieData = (type) => {
    // Always use the groupMap's account list for each chart type
    let groupMembers = [];
    if (type === 'summary') {
      // For summary, use all accounts in all groups (union of all groupMap values)
      const allGroupAccounts = Object.values(groupMap).flat();
      groupMembers = Array.from(new Set(allGroupAccounts));
    } else {
      // For other types, use groupMap[type] if present
      groupMembers = groupMap[type] || [];
    }
    // Remove duplicates
    groupMembers = Array.from(new Set(groupMembers));
    // For each member, interpolate value for selectedDate
    const labels = [];
    const data = [];
    let total = 0;
    groupMembers.forEach(account => {
      const value = interpolateValue(balances[account], selectedDate);
      if (value !== 0) {
        labels.push(account);
        data.push(Math.abs(value));
        total += Math.abs(value);
      }
    });
    return { labels, data, total };
  };

  const pieData = {};
  chartTypes.forEach(type => {
    pieData[type.key] = buildPieData(type.key);
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: mainCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={{
          backgroundColor: '#2d2d2d',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '10px',
          color: '#ffffff'
        }}>
          <p style={{ margin: '0', fontWeight: 'bold' }}>
            {data.name}
          </p>
          <p style={{ margin: '5px 0 0 0', color: data.color }}>
            {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderPieChart = (type, data) => {
    if (!data || data.labels.length === 0) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '200px',
          color: '#cccccc',
          fontSize: '14px'
        }}>
          No data available for {moment(selectedDate).format('MMM DD, YYYY')}
        </div>
      );
    }

    const chartData = data.labels.map((label, index) => ({
      name: label,
      value: data.data[index]
    }));

    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  };



  return (
    <div>
      <h3 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>
        Portfolio Distribution - {moment(selectedDate).format('MMM DD, YYYY')}
      </h3>
      <div className="pie-charts">
        {chartTypes.map((type) => (
          <div key={type.key} className="pie-chart">
            <h3>{type.title}</h3>
            {renderPieChart(type.key, pieData[type.key])}
            {pieData[type.key] && pieData[type.key].total > 0 && (
              <p style={{
                textAlign: 'center',
                margin: '10px 0 0 0',
                color: '#cccccc',
                fontSize: '14px'
              }}>
                Total: {formatCurrency(pieData[type.key].total)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PieCharts;
