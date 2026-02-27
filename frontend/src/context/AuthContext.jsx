import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('[AUTH-CTX] Initializing AuthProvider...');
        checkAuth();
        fetchConnections();

        // Global 401 interceptor
        const interceptor = api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    console.warn('[AUTH-SESSION] 401 Unauthorized detected! URL:', error.config.url);
                    console.warn('[AUTH-SESSION] Clearing user and redirecting to login.');
                    setUser(null);
                }
                return Promise.reject(error);
            }
        );

        return () => api.interceptors.response.eject(interceptor);
    }, []);

    const checkAuth = async () => {
        try {
            const response = await api.get('/auth/me');
            setUser(response.data);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchConnections = async () => {
        try {
            const response = await api.get('/auth/connections');
            if (response.data.success) {
                setConnections(response.data.connections || []);
            }
        } catch (e) {
            console.error('Failed to fetch connections:', e);
        }
    };

    const login = async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        if (response.data.success) {
            await checkAuth();
            await fetchConnections();
        }
        return response.data;
    };

    const switchConnection = async (conn) => {
        try {
            const res = await api.post('/auth/switch', conn);
            if (res.data.success) {
                await checkAuth();
                // Force reload location to refresh all queries if needed, 
                // or just let the components re-render with new user context.
                return true;
            }
        } catch (e) {
            console.error('Switch failed:', e);
            throw e;
        }
        return false;
    };

    const removeConnection = async (conn) => {
        try {
            const res = await api.post('/auth/remove', conn);
            if (res.data.success) {
                await fetchConnections();
                await checkAuth();
                return true;
            }
        } catch (e) {
            console.error('Remove failed:', e);
        }
        return false;
    };

    const logout = async () => {
        try { await api.post('/auth/logout'); } catch (e) { }
        setUser(null);
        setConnections([]);
        localStorage.removeItem('firebird_user_cache');
    };

    return (
        <AuthContext.Provider value={{ user, connections, loading, login, logout, switchConnection, removeConnection }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
