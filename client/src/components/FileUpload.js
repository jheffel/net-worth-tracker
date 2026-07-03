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

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const FileUpload = ({ onFileUpload }) => {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <div>
      <h3 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>
        Import Data
      </h3>
      
      <div 
        {...getRootProps()} 
        className={`file-upload ${isDragActive ? 'dragover' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p style={{ margin: 0, color: '#007bff' }}>
            Drop the file here...
          </p>
        ) : (
          <div>
            <p style={{ margin: '0 0 10px 0', color: '#cccccc' }}>
              Drag and drop an Excel/ODS file here, or click to select
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>
              Supported formats: .xlsx, .xls, .ods, .csv
            </p>
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#888' }}>
              Each sheet should contain: Account, Date, Balance, Currency, Ticker
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
