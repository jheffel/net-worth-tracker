import React, { useState } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
//import { ignoreForTotal } from '../constants/ignoreForTotal';

const AccountSelector = ({ accounts, selectedAccounts, onAccountToggle, onSelectAll, onDeselectAll, groupMap, ignoreForTotal, compact = false, onFileUpload, onGroupChange, showSumLine, setShowSumLine }) => {
          {/* Toggle for plotting sum of selected accounts */}
          <div style={{ marginBottom: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="show-sum-line"
              checked={!!showSumLine}
              onChange={e => setShowSumLine?.(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="show-sum-line" style={{ fontSize: 14, color: 'var(--text-primary)', userSelect: 'none' }}>
              Plot sum of selected accounts
            </label>
          </div>
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [overridePrompt, setOverridePrompt] = useState(false);
    const [pendingGroup, setPendingGroup] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  // Define group membership (should match NetWorthChart.js)

  const groupNames = Object.keys(groupMap);

  return (
    <div className="account-panel">
      <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)' }}>
        Account Selection
      </h3>

      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-start' }}>
        <button
          className="btn btn-tertiary"
          onClick={() => { setShowGroupModal(true); setGroupName(''); setErrorMsg(''); setOverridePrompt(false); }}
          disabled={selectedAccounts.length === 0}
        >
          Create Group from Selection
        </button>
      </div>
      <div style={{ marginBottom: '15px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button 
          className="btn btn-primary" 
          onClick={onSelectAll}
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
      {/* Modal for group name and override confirmation */}
      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            {!overridePrompt ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <strong>Create Group from Selection</strong>
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="text"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="Group name"
                      style={{ fontSize: 15, padding: '4px 8px', width: 220 }}
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  {errorMsg && <div style={{ color: 'red', marginTop: 6 }}>{errorMsg}</div>}
                </div>
                <button
                  className="btn primary"
                  onClick={async () => {
                    setErrorMsg('');
                    const name = groupName.trim();
                    if (!name) { setErrorMsg('Group name required'); return; }
                    if (groupMap[name]) {
                      setOverridePrompt(true);
                      setPendingGroup(name);
                      return;
                    }
                    setLoading(true);
                    try {
                      await axios.post(`${API_BASE}/account-groups/${encodeURIComponent(name)}`, { accounts: selectedAccounts });
                      setShowGroupModal(false);
                      setGroupName('');
                      setErrorMsg('');
                      setOverridePrompt(false);
                      if (onGroupChange) onGroupChange(name, selectedAccounts);
                    } catch (err) {
                      setErrorMsg('Failed to create group.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >Create</button>
                <button className="btn" onClick={() => setShowGroupModal(false)} style={{ marginLeft: 8 }} disabled={loading}>Cancel</button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <strong>Group already exists.</strong><br />
                  Override with current selection?
                </div>
                <button
                  className="btn danger"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await axios.post(`${API_BASE}/account-groups/${encodeURIComponent(pendingGroup)}`, { accounts: selectedAccounts });
                      setShowGroupModal(false);
                      setGroupName('');
                      setErrorMsg('');
                      setOverridePrompt(false);
                      setPendingGroup(null);
                      if (onGroupChange) onGroupChange(pendingGroup, selectedAccounts);
                    } catch (err) {
                      setErrorMsg('Failed to override group.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >Override</button>
                <button className="btn" onClick={() => { setOverridePrompt(false); setPendingGroup(null); }} style={{ marginLeft: 8 }} disabled={loading}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="account-list-scroll">
        <div className={`account-list ${compact ? 'compact' : ''}`}>
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
                    style={compact ? { width: 22, height: 22 } : {}}
                  />
                  <label htmlFor={account} style={isGroupLike ? { fontWeight: 'bold', color: '#ffd700' } : {}}>
                    {account} {isGroupLike && <span style={{ fontSize: compact ? '10px' : '11px', color: '#aaa' }}>(Group)</span>}
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

      <div className="import-inline">
        <FileUpload onFileUpload={onFileUpload} />
      </div>
    </div>
  );
};

export default AccountSelector;
