import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const Controls = ({ 
  timeframe, 
  setTimeframe, 
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate, 
  mainCurrency, 
  currencies, 
  onCurrencyChange 
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
    <div className="controls">
      <div className="control-group">
        <label>Timeframe:</label>
        <select 
          value={timeframe} 
          onChange={(e) => setTimeframe(e.target.value)}
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
              onChange={(date) => setStartDate(date.toISOString().split('T')[0])}
              dateFormat="yyyy-MM-dd"
              className="date-picker"
            />
          </div>

          <div className="control-group">
            <label>End Date:</label>
            <DatePicker
              selected={new Date(endDate)}
              onChange={(date) => setEndDate(date.toISOString().split('T')[0])}
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
  );
};

export default Controls;
