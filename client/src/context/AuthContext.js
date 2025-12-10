import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

    useEffect(() => {
        // Check for stored token on load
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                // Check expiration
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setUser(decoded);
                    // Set default auth header
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                }
            } catch (e) {
                logout();
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
            const { token } = res.data;
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            const decoded = jwtDecode(token);
            setUser(decoded);
            return { success: true };
        } catch (err) {
            console.error(err);
            return {
                success: false,
                error: err.response?.data?.error || 'Login failed'
            };
        }
    };

    const register = async (username, password) => {
        try {
            await axios.post(`${API_BASE}/auth/register`, { username, password });
            return { success: true };
        } catch (err) {
            console.error(err);
            return {
                success: false,
                error: err.response?.data?.error || 'Registration failed'
            };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const value = {
        user,
        login,
        register,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
