import React, { useState } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
//import { ignoreForTotal } from '../constants/ignoreForTotal';

const AccountSelector = ({ accounts, selectedAccounts, onAccountToggle, onSelectAll, onDeselectAll, groupMap, ignoreForTotal, compact = false, onFileUpload, onGroupChange, showSumLine, setShowSumLine, onGroupSelect }) => {
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
    const [showGroups, setShowGroups] = useState(true);
    const [groupName, setGroupName] = useState('');
    const [overridePrompt, setOverridePrompt] = useState(false);
    const [pendingGroup, setPendingGroup] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  // Define group membership (should match NetWorthChart.js)

  const groupNames = Object.keys(groupMap);
  // Only show accounts that are not group names
  const pureAccounts = accounts.filter(a => !groupNames.includes(a));

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

      {/* Accounts Scrollable Section */}
      <div className="account-list-scroll" style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
        <div className={`account-list ${compact ? 'compact' : ''}`}>
          <div style={{ fontWeight: 'bold', marginBottom: 6, color: 'var(--text-primary)' }}>Accounts</div>
          {pureAccounts.length === 0 ? (
            <p style={{ color: '#cccccc', textAlign: 'center' }}>
              No accounts available. Import data to get started.
            </p>
          ) : (
            pureAccounts.map(account => (
              <div className="account-item" key={account}>
                <input
                  type="checkbox"
                  id={account}
                  checked={selectedAccounts.includes(account)}
                  onChange={() => onAccountToggle(account)}
                  style={compact ? { width: 22, height: 22 } : {}}
                />
                <label htmlFor={account}>{account}</label>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Groups Scrollable Section with collapse/expand, now below accounts but above select/deselect all */}
      {groupNames.length > 0 && (
        <div className="group-list-scroll" style={{ maxHeight: 200, overflowY: showGroups ? 'auto' : 'hidden', marginBottom: 15 }}>
          <div className={`group-list ${compact ? 'compact' : ''}`} style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', marginBottom: 6, color: 'var(--text-primary)' }}>
              <span style={{ flex: 1 }}>Groups</span>
              <button
                aria-label={showGroups ? 'Collapse groups' : 'Expand groups'}
                title={showGroups ? 'Collapse groups' : 'Expand groups'}
                onClick={() => setShowGroups(g => !g)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 6 }}
              >
                {showGroups ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            </div>
            {showGroups && groupNames.map(group => (
              <div className="group-item" key={group}>
                <button
                  className="btn btn-group-select"
                  style={{ width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 15, background: 'var(--control-bg)', border: '1px solid var(--control-border)', borderRadius: 4, marginBottom: 4, color: 'var(--text-primary)', cursor: 'pointer' }}
                  onClick={() => onGroupSelect && onGroupSelect(groupMap[group])}
                >
                  {group}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
