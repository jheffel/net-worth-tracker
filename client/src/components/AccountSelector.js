import React from 'react';

const AccountSelector = ({ accounts, selectedAccounts, onAccountToggle, onSelectAll, onDeselectAll }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>
        Account Selection
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          className="btn btn-primary" 
          onClick={onSelectAll}
          style={{ marginRight: '10px' }}
        >
          Select All
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={onDeselectAll}
        >
          Deselect All
        </button>
      </div>

      <div className="account-list">
        {accounts.length === 0 ? (
          <p style={{ color: '#cccccc', textAlign: 'center' }}>
            No accounts available. Import data to get started.
          </p>
        ) : (
          accounts.map(account => {
            const groupNames = ['operating', 'investing', 'crypto', 'equity', 'summary'];
            const isGroup = groupNames.includes(account);
            return (
              <div key={account} className="account-item">
                <input
                  type="checkbox"
                  id={account}
                  checked={selectedAccounts.includes(account)}
                  onChange={() => onAccountToggle(account)}
                />
                <label htmlFor={account} style={isGroup ? { fontWeight: 'bold', color: '#ffd700' } : {}}>
                  {account} {isGroup && <span style={{ fontSize: '11px', color: '#aaa' }}>(Group)</span>}
                </label>
              </div>
            );
          })
        )}
      </div>

      {accounts.length > 0 && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#333', 
          borderRadius: '4px',
          fontSize: '12px',
          color: '#cccccc'
        }}>
          {selectedAccounts.length} of {accounts.length} accounts selected
        </div>
      )}
    </div>
  );
};

export default AccountSelector;
