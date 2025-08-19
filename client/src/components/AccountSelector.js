import React from 'react';
//import { ignoreForTotal } from '../constants/ignoreForTotal';

const AccountSelector = ({ accounts, selectedAccounts, onAccountToggle, onSelectAll, onDeselectAll, groupMap, ignoreForTotal }) => {
  // Define group membership (should match NetWorthChart.js)

  const groupNames = Object.keys(groupMap);

  return (
    <div>
      <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)' }}>
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
        {(accounts.length === 0) ? (
          <p style={{ color: '#cccccc', textAlign: 'center' }}>
            No accounts available. Import data to get started.
          </p>
        ) : (
          [...accounts].map(account => {
            // Treat 'net worth' and 'total' as groups
            let members = [];
            /*
            if (account === 'net worth') {
              const allAccounts = [...accounts];
              const groupedAccounts = Object.values(groupMap).flat();
              members = allAccounts.filter(a => !groupedAccounts.includes(a));
            } else if (account === 'total') {
              const allAccounts = [...accounts];
              const groupedAccounts = Object.values(groupMap).flat();
              members = allAccounts.filter(a => !groupedAccounts.includes(a) && !(typeof ignoreForTotal !== 'undefined' && ignoreForTotal.includes(a)));
            } else if (groupMap[account]) {
              members = groupMap[account];
            }
            */
            members = groupMap[account] || [];
            const isGroupLike = account === 'net worth' || account === 'total' || groupMap[account];
            return (
              <React.Fragment key={account}>
                <div className="account-item">
                  <input
                    type="checkbox"
                    id={account}
                    checked={selectedAccounts.includes(account)}
                    onChange={() => onAccountToggle(account)}
                  />
                  <label htmlFor={account} style={isGroupLike ? { fontWeight: 'bold', color: '#ffd700' } : {}}>
                    {account} {isGroupLike && <span style={{ fontSize: '11px', color: '#aaa' }}>(Group)</span>}
                  </label>
                </div>
                {isGroupLike && selectedAccounts.includes(account) && members.length > 0 && (
                  <div style={{ marginLeft: 24, marginBottom: 4 }}>
                    {members.map(member => (
                      <div key={account + '-' + member} className="account-item">
                        <input
                          type="checkbox"
                          id={account + '-' + member}
                          checked={true}
                          disabled
                        />
                        <label htmlFor={account + '-' + member} style={{ color: '#aaa', fontStyle: 'italic' }}>
                          {member}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {accounts.length > 0 && (
        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: 'var(--control-bg)', 
          borderRadius: '4px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          border: '1px solid var(--control-border)'
        }}>
          {selectedAccounts.length} of {accounts.length} accounts selected
        </div>
      )}
    </div>
  );
};

export default AccountSelector;
