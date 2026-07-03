// Net Worth Tracker
// Copyright (C) 2025 jheffel
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const requirements = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
    { label: 'A digit', test: (p) => /[0-9]/.test(p) },
    { label: 'A special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordFocused, setPasswordFocused] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const validateEmail = (value) => {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            setEmailError('Please enter a valid email address');
        } else {
            setEmailError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (emailError) return;

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        const missing = requirements.find(r => !r.test(password));
        if (missing) {
            setError(`Password must contain: ${missing.label.toLowerCase()}`);
            return;
        }

        const result = await register(email, password);
        if (result.success) {
            navigate('/login');
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Register</h2>
                {error && <div className="auth-error">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                            onBlur={(e) => validateEmail(e.target.value)}
                            required
                        />
                        {emailError && <div className="auth-error" style={{ fontSize: 12, marginTop: 4 }}>{emailError}</div>}
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setPasswordFocused(true)}
                            onBlur={() => setPasswordFocused(false)}
                            required
                        />
                        {passwordFocused && (
                            <div style={{ marginTop: 8, padding: 8, background: 'var(--control-bg, #2a2a3e)', borderRadius: 6, fontSize: 12 }}>
                                {requirements.map((r, i) => (
                                    <div key={i} style={{ color: r.test(password) ? '#4caf50' : 'var(--text-secondary, #aaa)', marginBottom: 2 }}>
                                        {r.test(password) ? '\u2713' : '\u2717'} {r.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-btn">Register</button>
                </form>
                <p className="auth-footer">
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
