import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const requirements = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'A digit', test: (p) => /[0-9]/.test(p) },
    { label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }
        const missing = requirements.find(r => !r.test(password));
        if (missing) {
            setError(`Password must contain: ${missing.label.toLowerCase()}`);
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/auth/reset/${token}`, { password });
            setSuccess(res.data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Reset Password</h2>
                {error && <div className="auth-error">{error}</div>}
                {success && <div className="auth-success" style={{ color: '#4caf50', marginBottom: 12, fontSize: 14 }}>{success} Redirecting to login...</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>New Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {password && (
                            <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, fontSize: 12, listStyle: 'none' }}>
                                {requirements.map((r, i) => (
                                    <li key={i} style={{ color: r.test(password) ? '#4caf50' : 'var(--text-secondary, #aaa)', marginBottom: 2 }}>
                                        {r.test(password) ? '\u2713' : '\u2717'} {r.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
                <p className="auth-footer">
                    <Link to="/login">Back to Login</Link>
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;