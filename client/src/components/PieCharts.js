import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import axios from 'axios';
import moment from 'moment';

const PieCharts = ({ selectedDate, mainCurrency, API_BASE }) => {
  const [pieData, setPieData] = useState({});
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadPieChartData();
  }, [selectedDate]);

  const loadPieChartData = async () => {
    setLoading(true);
    try {
      const promises = chartTypes.map(async (type) => {
        try {
          const response = await axios.get(`${API_BASE}/pie-chart/${type.key}`, {
            params: { date: selectedDate }
          });
          return { type: type.key, data: response.data };
        } catch (error) {
          console.error(`Error loading ${type.key} pie chart:`, error);
          return { type: type.key, data: { labels: [], data: [], total: 0 } };
        }
      });

      const results = await Promise.all(promises);
      const newPieData = {};
      results.forEach(result => {
        newPieData[result.type] = result.data;
      });
      setPieData(newPieData);
    } catch (error) {
      console.error('Error loading pie chart data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        color: '#cccccc'
      }}>
        Loading pie charts...
      </div>
    );
  }

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
