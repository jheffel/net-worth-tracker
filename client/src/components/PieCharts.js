// Net Worth Tracker
// Copyright (C) 2025 jheffel
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

import moment from 'moment';



import axios from 'axios';

const PieCharts = ({ balances, groupMap, selectedDate, mainCurrency, theme, compact = false }) => {
  const colorsDark = ['#8884d8','#82ca9d','#ffc658','#ff7300','#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff'];
  const colorsLight = ['#3557b7','#1f8f5f','#c28a00','#d45800','#b83232','#2b9b2b','#2e5fa8','#d1a500','#a93ba9','#2796a9'];
  const colors = theme === 'light' ? colorsLight : colorsDark;

  // Build pie data for each group in groupMap, sorted alphabetically
  const groupNames = Object.keys(groupMap).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const groupPieData = groupNames.map(groupName => {
    const accounts = groupMap[groupName] || [];
    const labels = [];
    const data = [];
    let signedTotal = 0;
    accounts.forEach(account => {
      if (!balances[account]) return;
      const value = balances[account][selectedDate];
      if (typeof value === 'number') {
        labels.push(account);
        data.push(Math.abs(value));
        signedTotal += value;
      }
    });
    return { groupName, labels, data, total: signedTotal };
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
      <ResponsiveContainer width="100%" height={compact ? 120 : 200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={compact ? 48 : 80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} wrapperStyle={compact ? { fontSize: '0.85em', padding: 2 } : {}} />
        </PieChart>
      </ResponsiveContainer>
    );
  };



  return (
    <div className="pie-charts" style={{height: '100%', minHeight: 0}}>
      {groupPieData.map(({ groupName, labels, data, total }) => (
        <div key={groupName} className="pie-chart">
          <h3 style={{ fontSize: compact ? '1em' : undefined }}>{groupName}</h3>
          {renderPieChart(groupName, { labels, data, total })}
          {total > 0 && (
            <p style={{
              textAlign: 'center',
              margin: '10px 0 0 0',
              color: 'var(--text-secondary)',
              fontSize: compact ? '12px' : '14px'
            }}>
              Total: {formatCurrency(total)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default PieCharts;
