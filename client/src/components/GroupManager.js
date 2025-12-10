import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../App.css';

const GroupManager = ({ user, onClose, allAccounts, groupMap, onUpdate }) => {
    const [activeTab, setActiveTab] = useState('operating');
    const [localLeft, setLocalLeft] = useState([]); // Available accounts (not in group)
    const [localRight, setLocalRight] = useState([]); // Accounts in group
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    const groupTypes = ['operating', 'investing', 'crypto', 'equity', 'summary', 'ignoreForTotal'];
    const groupLabels = {
        operating: 'Operating Cash',
        investing: 'Investments',
        crypto: 'Crypto Assets',
        equity: 'Home Equity / Other',
        summary: 'Summary Highlight',
        ignoreForTotal: 'Exclude from Net Worth'
    };

    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

    // Initialize state when tab or props change
    useEffect(() => {
        if (!groupMap || !allAccounts) return;
        const currentGroupMembers = groupMap[activeTab] || [];

        // Left side: Accounts NOT in the current group
        const left = allAccounts.filter(acc => !currentGroupMembers.includes(acc));
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

                <div className="group-tabs">
                    {groupTypes.map(type => (
                        <button
                            key={type}
                            className={`tab-btn ${activeTab === type ? 'active' : ''}`}
                            onClick={() => setActiveTab(type)}
                        >
                            {groupLabels[type] || type}
                        </button>
                    ))}
                </div>

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
