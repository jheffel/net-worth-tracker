import React from 'react';

const AccountSelector = ({ accounts, selectedAccounts, onAccountToggle, onSelectAll, onDeselectAll, groupMap }) => {
  // Add synthetic groups 'networth' and 'total' to the group list
  // Compute members for synthetic groups
  // Helper to get all accounts not in any group
  const getIndividualAccounts = (accounts, groupMap) => {
    const groupNames = new Set(Object.keys(groupMap));
    return accounts.filter(a => !groupNames.has(a));
  };

  const getSyntheticGroupMembers = (group, accounts, groupMap, ignoreForTotal) => {
    if (group === 'networth') {
      return getIndividualAccounts(accounts, groupMap);
    } else if (group === 'total') {
      return getIndividualAccounts(accounts, groupMap).filter(a => !ignoreForTotal.includes(a));
    }
    return [];
  };

  const [ignoreForTotal, setIgnoreForTotal] = React.useState([]);
  React.useEffect(() => {
    fetch('/config/ignoreForTotal.txt').then(res => res.text()).then(txt => {
      const ignoreList = txt.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      console.log('DEBUG: ignoreForTotal loaded:', ignoreList);
      setIgnoreForTotal(ignoreList);
    }).catch(() => setIgnoreForTotal([]));
  }, []);

  // Exclude 'summary' from the account selector group list
  const groupNames = [...Object.keys(groupMap).filter(g => g !== 'summary'), 'networth', 'total'];

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

  <div className="account-list-scroll">
        {accounts.length === 0 ? (
          <p style={{ color: '#cccccc', textAlign: 'center' }}>
            No accounts available. Import data to get started.
          </p>
        ) : (
          // Show all groups (including synthetic) first, then individual accounts
          [
            ...groupNames.map(account => {
              const isSynthetic = account === 'networth' || account === 'total';
              let members = isSynthetic
                ? getSyntheticGroupMembers(account, accounts, groupMap, ignoreForTotal)
                : groupMap[account];
              // For 'total', filter out ignoreForTotal accounts from the displayed members
              if (account === 'total' && Array.isArray(members)) {
                members = members.filter(m => !ignoreForTotal.includes(m));
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
                    <label htmlFor={account} style={{ fontWeight: 'bold', color: '#ffd700' }}>
                      {account} <span style={{ fontSize: '11px', color: '#aaa' }}>(Group)</span>
                    </label>
                  </div>
                  {members && selectedAccounts.includes(account) && (
                    <div style={{ marginLeft: 24, marginBottom: 4 }}>
                      {members.map(member => (
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
                </React.Fragment>
              );
            }),
            ...accounts.filter(account => !groupNames.includes(account)).map(account => {
              return (
                <div key={account} className="account-item">
                  <input
                    type="checkbox"
                    id={account}
                    checked={selectedAccounts.includes(account)}
                    onChange={() => onAccountToggle(account)}
                  />
                  <label htmlFor={account}>{account}</label>
                </div>
              );
            })
          ]
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
