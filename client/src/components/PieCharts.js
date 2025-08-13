import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import moment from 'moment';



import axios from 'axios';
const PieCharts = ({ balances, selectedAccounts, groupMap, selectedDate, mainCurrency, theme }) => {
  const [ignoreForTotal, setIgnoreForTotal] = useState([]);
  const [summaryGroups, setSummaryGroups] = useState([]);

  useEffect(() => {
    // Load ignoreForTotal.txt for 'total' group
    axios.get('/config/ignoreForTotal.txt').then(res => {
      setIgnoreForTotal(res.data.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    }).catch(() => setIgnoreForTotal([]));
    // Load summary.txt for summary pie chart
    axios.get('/config/summary.txt').then(res => {
      setSummaryGroups(res.data.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    }).catch(() => setSummaryGroups(['operating','investing','crypto','equity']));
  }, []);

  const chartTypes = [
    { key: 'summary', title: 'Summary Distribution' },
    { key: 'operating', title: 'Operating Accounts' },
    { key: 'investing', title: 'Investment Accounts' },
    { key: 'crypto', title: 'Crypto Accounts' },
    { key: 'equity', title: 'Equity Accounts' }
  ];

  const colorsDark = ['#8884d8','#82ca9d','#ffc658','#ff7300','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff'];
  const colorsLight = ['#3557b7','#1f8f5f','#c28a00','#d45800','#b83232','#2b9b2b','#2e5fa8','#d1a500','#a93ba9','#2796a9'];
  const colors = theme === 'light' ? colorsLight : colorsDark;


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
    if (type === 'summary') {
      // For summary, show one slice per group in summary.txt, each as the sum of its members
      const labels = [];
      const data = [];
      let signedTotal = 0;
      summaryGroups.forEach(group => {
        const members = groupMap[group] || [];
        let groupSum = 0;
        members.forEach(account => {
          const value = interpolateValue(balances[account], selectedDate);
          groupSum += value;
        });
        if (groupSum !== 0) {
          labels.push(group);
          data.push(Math.abs(groupSum));
          signedTotal += groupSum;
        }
      });
      return { labels, data, total: signedTotal };
    }
    // ...existing code for other types...
    let groupMembers = [];
    if (type === 'networth') {
      groupMembers = Object.keys(balances).filter(acc => !(acc in groupMap));
    } else if (type === 'total') {
      groupMembers = Object.keys(balances).filter(acc => !(acc in groupMap) && !ignoreForTotal.includes(acc));
    } else {
      groupMembers = groupMap[type] || [];
    }
    groupMembers = Array.from(new Set(groupMembers));
    const labels = [];
    const data = [];
    let signedTotal = 0;
    groupMembers.forEach(account => {
      const value = interpolateValue(balances[account], selectedDate);
      if (value !== 0) {
        labels.push(account);
        data.push(Math.abs(value));
        signedTotal += value;
      }
    });
    return { labels, data, total: signedTotal };
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
          backgroundColor: 'var(--tooltip-bg)',
          border: '1px solid var(--control-border)',
          borderRadius: '4px',
          padding: '10px',
          color: 'var(--text-primary)'
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
          color: 'var(--text-secondary)',
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
    <>
      <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)' }}>
        Portfolio Distribution - {moment(selectedDate).format('MMM DD, YYYY')}
      </h3>
      <div className="pie-charts" style={{height: '100%', minHeight: 0}}>
        {chartTypes.map((type) => (
          <div key={type.key} className="pie-chart">
            <h3>{type.title}</h3>
            {renderPieChart(type.key, pieData[type.key])}
            {pieData[type.key] && pieData[type.key].total > 0 && (
              <p style={{
                textAlign: 'center',
                margin: '10px 0 0 0',
                color: 'var(--text-secondary)',
                fontSize: '14px'
              }}>
                Total: {formatCurrency(pieData[type.key].total)}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default PieCharts;
