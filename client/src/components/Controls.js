import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import moment from 'moment';

const Controls = ({ 
  timeframe, 
  setTimeframe, 
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate, 
  mainCurrency, 
  currencies, 
  onCurrencyChange,
  theme,
  onToggleTheme,
  //updateChartData // new prop
}) => {
  const timeframes = [
    'All Data',
    'Last Year',
    'Last 6 Months',
    'Last 3 Months',
    'Last Month',
    'Custom'
  ];

  return (
    <div className="controls controls-flex">
      <div className="controls-main">
        <div className="control-group">
          <label>Timeframe:</label>
          <select 
            value={timeframe} 
            onChange={(e) => {
              const value = e.target.value;
              setTimeframe(value);
              let newStart, newEnd;
              if (value === 'Last Year') {
                newStart = moment().subtract(1, 'year').format('YYYY-MM-DD');
                newEnd = moment().format('YYYY-MM-DD');
              } else if (value === 'Last 6 Months') {
                newStart = moment().subtract(6, 'months').format('YYYY-MM-DD');
                newEnd = moment().format('YYYY-MM-DD');
              } else if (value === 'Last 3 Months') {
                newStart = moment().subtract(3, 'months').format('YYYY-MM-DD');
                newEnd = moment().format('YYYY-MM-DD');
              } else if (value === 'Last Month') {
                newStart = moment().subtract(1, 'month').format('YYYY-MM-DD');
                newEnd = moment().format('YYYY-MM-DD');
              } else if (value === 'All Data') {
                newStart = '2020-01-01';
                newEnd = moment().format('YYYY-MM-DD');
              }
              if (value !== 'Custom') {
                setStartDate(newStart);
                setEndDate(newEnd);
              }
            }}
          >
            {timeframes.map(tf => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>

        {timeframe === 'Custom' && (
          <>
            <div className="control-group">
              <label>Start Date:</label>
              <DatePicker
                selected={new Date(startDate)}
                onChange={(date) => {
                  setStartDate(date.toISOString().split('T')[0]);
                }}
                dateFormat="yyyy-MM-dd"
                className="date-picker"
              />
            </div>

            <div className="control-group">
              <label>End Date:</label>
              <DatePicker
                selected={new Date(endDate)}
                onChange={(date) => {
                  setEndDate(date.toISOString().split('T')[0]);
                }}
                dateFormat="yyyy-MM-dd"
                className="date-picker"
              />
            </div>
          </>
        )}

        <div className="control-group">
          <label>Main Currency:</label>
          <select
            value={mainCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            {currencies.map(currency => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default Controls;

