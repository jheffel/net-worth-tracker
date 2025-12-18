import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../App.css';

const GroupManager = ({ user, onClose, allAccounts, groupMap, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('');
    const [localLeft, setLocalLeft] = useState([]); // Available accounts (not in group)
    const [localRight, setLocalRight] = useState([]); // Accounts in group
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);


    // All group types are now custom per user, so build from groupMap keys
    const [groupTypes, setGroupTypes] = useState([]);
    const [groupLabels, setGroupLabels] = useState({});
    useEffect(() => {
        if (groupMap) {
            const keys = Object.keys(groupMap);
            setGroupTypes(keys);
            // Use group name as label, or allow custom naming in future
            const labels = {};
            keys.forEach(k => { labels[k] = k; });
            setGroupLabels(labels);
            // Set activeTab to first group if current is not present
            if (!keys.includes(activeTab)) {
                setActiveTab(keys[0] || '');
            }
        }
    }, [groupMap]);

    const [newGroupName, setNewGroupName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(null); // groupType to confirm
    // Add a new group
    const handleAddGroup = async () => {
        const name = newGroupName.trim();
        if (!name || groupTypes.includes(name)) return;
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/account-groups/${encodeURIComponent(name)}`, { accounts: [] });
            setNewGroupName('');
            if (onUpdate) onUpdate();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to add group.' });
        } finally {
            setLoading(false);
        }
    };

    // Delete a group (with confirmation if needed)
    const handleDeleteGroup = async (type) => {
        setLoading(true);
        try {
            await axios.delete(`${API_BASE}/account-groups/${encodeURIComponent(type)}`);
            if (activeTab === type) setActiveTab(groupTypes[0] || '');
            if (onUpdate) onUpdate();
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to delete group.' });
        } finally {
            setLoading(false);
            setConfirmDelete(null);
        }
    };

    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

    // Initialize state when tab or props change
    useEffect(() => {
        if (!groupMap || !allAccounts) return;
        const currentGroupMembers = groupMap[activeTab] || [];

        // Exclude groups (aggregates) from the available accounts list
        // We assume anything in groupMap keys is a group/aggregate
        const groupNames = Object.keys(groupMap);
        const baseAccounts = allAccounts.filter(acc => !groupNames.includes(acc));

        // Left side: Accounts NOT in the current group
        const left = baseAccounts.filter(acc => !currentGroupMembers.includes(acc));
        // Right side: Accounts IN the current group
        const right = currentGroupMembers.filter(acc => allAccounts.includes(acc)); // filter to ensure valid

        setLocalLeft(left.sort());
        setLocalRight(right.sort());
        setMsg(null);
    }, [activeTab, groupMap, allAccounts]);

    const handleMoveRight = (acc) => {
        setLocalLeft(prev => prev.filter(a => a !== acc));
        setLocalRight(prev => [...prev, acc].sort());
    };

    const handleMoveLeft = (acc) => {
        setLocalRight(prev => prev.filter(a => a !== acc));
        setLocalLeft(prev => [...prev, acc].sort());
    };

    const handleAddAll = () => {
        setLocalRight(prev => [...prev, ...localLeft].sort());
        setLocalLeft([]);
    };

    const handleRemoveAll = () => {
        setLocalLeft(prev => [...prev, ...localRight].sort());
        setLocalRight([]);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/account-groups/${activeTab}`, {
                accounts: localRight
            });
            setMsg({ type: 'success', text: 'Saved successfully!' });
            if (onUpdate) onUpdate(); // Trigger dashboard refresh
        } catch (err) {
            console.error(err);
            setMsg({ type: 'error', text: 'Failed to save.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="group-manager-modal">
            <div className="group-manager-content panel-box">
                <div className="modal-header">
                    <h2>Manage Groups</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>


                <div className="group-tabs" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {groupTypes.map(type => (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <button
                                className={`tab-btn ${activeTab === type ? 'active' : ''}`}
                                onClick={() => setActiveTab(type)}
                            >
                                {groupLabels[type] || type}
                            </button>
                            {/* Delete button for group */}
                            <button
                                className="btn-small danger"
                                title="Delete group"
                                style={{ marginLeft: 2, fontSize: 13, padding: '0 6px' }}
                                onClick={() => {
                                    // If group has assignments, confirm; else delete immediately
                                    if ((groupMap[type] || []).length > 0) {
                                        setConfirmDelete(type);
                                    } else {
                                        handleDeleteGroup(type);
                                    }
                                }}
                                disabled={loading}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {/* Add group UI */}
                    <input
                        type="text"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        placeholder="New group name"
                        style={{ marginLeft: 8, fontSize: 14, padding: '2px 6px' }}
                        disabled={loading}
                    />
                    <button className="btn-small" onClick={handleAddGroup} disabled={loading || !newGroupName.trim() || groupTypes.includes(newGroupName.trim())}>
                        +
                    </button>
                </div>

                {/* Confirm delete dialog */}
                {confirmDelete && (
                    <div className="modal-overlay">
                        <div className="modal-dialog">
                            <div style={{ marginBottom: 12 }}>
                                <strong>Delete group "{confirmDelete}"?</strong><br />
                                This group has assigned accounts. Deleting it will remove all assignments. Continue?
                            </div>
                            <button className="btn danger" onClick={() => handleDeleteGroup(confirmDelete)} disabled={loading}>Delete</button>
                            <button className="btn" onClick={() => setConfirmDelete(null)} disabled={loading} style={{ marginLeft: 8 }}>Cancel</button>
                        </div>
                    </div>
                )}

                <div className="dual-list-container">
                    <div className="list-box">
                        <div className="list-header-row">
                            <h4>Available Accounts</h4>
                            {localLeft.length > 0 && (
                                <button className="btn-small" onClick={handleAddAll}>Add All &rarr;</button>
                            )}
                        </div>
                        <div className="list-content">
                            {localLeft.length === 0 && <div className="empty-msg">No accounts</div>}
                            {localLeft.map(acc => (
                                <div key={acc} className="list-item" onClick={() => handleMoveRight(acc)}>
                                    <span>{acc}</span>
                                    <span className="arrow">→</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="list-box">
                        <div className="list-header-row">
                            <h4>In {groupLabels[activeTab]}</h4>
                            {localRight.length > 0 && (
                                <button className="btn-small" onClick={handleRemoveAll}>&larr; Remove All</button>
                            )}
                        </div>
                        <div className="list-content">
                            {localRight.length === 0 && <div className="empty-msg">No accounts in group</div>}
                            {localRight.map(acc => (
                                <div key={acc} className="list-item in-group" onClick={() => handleMoveLeft(acc)}>
                                    <span className="arrow">←</span>
                                    <span>{acc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <div className="status-msg">
                        {msg && <span className={msg.type}>{msg.text}</span>}
                    </div>
                    <button className="btn primary" onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupManager;
