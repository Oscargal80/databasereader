import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // First, try standard cookie-based session
            const response = await api.get('/auth/me');
            setUser(response.data);
            localStorage.setItem('firebird_user_cache', JSON.stringify(response.data));
        } catch (error) {
            // Cookie failed or dropped (Electron Webkit over Localhost often does this)
            // Try fallback to LocalStorage cache
            const cached = localStorage.getItem('firebird_user_cache');
            if (cached) {
                try {
                    const parsedCache = JSON.parse(cached);
                    // Validate with backend via POST body instead of GET cookie
                    const fallbackResponse = await api.post('/auth/me', { cachedUser: parsedCache });
                    setUser(fallbackResponse.data);
                } catch (fallbackErr) {
                    console.error('Auth Check (Fallback) Error:', fallbackErr.message);
                    setUser(null);
                    localStorage.removeItem('firebird_user_cache');
                }
            } else {
                console.error('Auth Check Error:', error.response?.status, error.message);
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        if (response.data.success && response.data.user) {
            setUser(response.data.user);
            localStorage.setItem('firebird_user_cache', JSON.stringify(response.data.user));
            // Trigger checkAuth to sync backend/frontend states completely
            await checkAuth();
        } else if (response.data.success) {
            await checkAuth();
        }
        return response.data;
    };

    const logout = async () => {
        try { await api.post('/auth/logout'); } catch (e) { }
        setUser(null);
        localStorage.removeItem('firebird_user_cache');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
