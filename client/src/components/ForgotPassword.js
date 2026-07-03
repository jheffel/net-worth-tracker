import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/auth/forgot`, { email });
            setMessage(res.data.message);
            setToken(res.data.token);
        } catch (err) {
            setError(err.response?.data?.error || 'Request failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Forgot Password</h2>
                {error && <div className="auth-error">{error}</div>}
                {message && <div className="auth-success" style={{ color: '#4caf50', marginBottom: 12, fontSize: 14 }}>{message}</div>}
                {token && (
                    <div style={{ marginBottom: 16, padding: 12, background: 'var(--control-bg, #2a2a3e)', borderRadius: 6, fontSize: 13, wordBreak: 'break-all' }}>
                        <p style={{ margin: '0 0 8px 0', color: 'var(--text-secondary, #aaa)' }}>Your reset token (use on the reset page):</p>
                        <code style={{ color: 'var(--accent, #4a6cf7)' }}>{token}</code>
                        <p style={{ marginTop: 12 }}>
                            <Link to={`/reset/${token}`} style={{ color: 'var(--accent, #4a6cf7)' }}>Click here to reset your password</Link>
                        </p>
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                </form>
                <p className="auth-footer">
                    <Link to="/login">Back to Login</Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;