import React from 'react';
//import { ignoreForTotal } from '../constants/ignoreForTotal';

const AccountSelector = ({ accounts, selectedAccounts, onAccountToggle, onSelectAll, onDeselectAll, groupMap, ignoreForTotal }) => {
  // Define group membership (should match NetWorthChart.js)
  /*
  const groupMap = {
    operating: ['chequing', 'credit card', 'savings'],
    investing: ['RRSP', 'Margin'],
    crypto: ['Bitcoin', 'Eth'],
    equity: ['mortgage', 'House value'],
    summary: ['chequing', 'credit card', 'savings', 'RRSP', 'Margin', 'Bitcoin', 'Eth', 'mortgage', 'House value']
  };
  */
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
          [...accounts, 'net worth', 'total'].map(account => {
            const isGroup = groupNames.includes(account);
            const isSynthetic = account === 'net worth' || account === 'total';
            let syntheticMembers = [];
            if (isSynthetic) {
              // net worth: all accounts not in any group
              // total: all accounts not in any group and not in ignoreForTotal
              const allAccounts = [...accounts];
              const groupedAccounts = Object.values(groupMap).flat();
              if (account === 'net worth') {
                syntheticMembers = allAccounts.filter(a => !groupedAccounts.includes(a));
               
              } else if (account === 'total') {
                // If you have an ignoreForTotal list, filter here; otherwise, just show ungrouped
                
                syntheticMembers = allAccounts.filter(a => !groupedAccounts.includes(a) && !ignoreForTotal.includes(a));
              } 
            }
            return (
              <React.Fragment key={account}>
                <div className="account-item">
                  <input
                    type="checkbox"
                    id={account}
                    checked={selectedAccounts.includes(account)}
                    onChange={() => onAccountToggle(account)}
                  />
                  <label htmlFor={account} style={isGroup ? { fontWeight: 'bold', color: '#ffd700' } : isSynthetic ? { fontWeight: 'bold', color: '#4361ee' } : {}}>
                    {account} {isGroup && <span style={{ fontSize: '11px', color: '#aaa' }}>(Group)</span>}
                    {isSynthetic && <span style={{ fontSize: '11px', color: '#aaa' }}>(Synthetic)</span>}
                  </label>
                </div>
                {isGroup && selectedAccounts.includes(account) && (
                  <div style={{ marginLeft: 24, marginBottom: 4 }}>
                    {groupMap[account]?.map(member => (
                      <div key={member} className="account-item">
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
                {isSynthetic && selectedAccounts.includes(account) && syntheticMembers.length > 0 && (
                  <div style={{ marginLeft: 24, marginBottom: 4 }}>
                    {syntheticMembers.map(member => (
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
