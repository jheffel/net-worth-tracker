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
  compact = false,
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
  <div className={`controls controls-flex ${compact ? 'compact' : ''}`}>
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
                newStart = '1970-01-01';
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
          <label style={{ fontSize: compact ? '0.95em' : undefined }}>Main Currency:</label>
          <select
            value={mainCurrency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            style={{ padding: compact ? '6px 8px' : undefined }}
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

