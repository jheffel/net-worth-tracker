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
