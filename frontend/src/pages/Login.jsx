import React, { useState } from 'react';
import { Grid, useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

import LoginFeatures from '../components/login/LoginFeatures';
import LoginForm from '../components/login/LoginForm';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [credentials, setCredentials] = useState({
        host: '',
        port: '3050',
        database: '',
        user: 'SYSDBA',
        password: '',
        dbType: 'firebird'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [testHostLoading, setTestHostLoading] = useState(false);
    const [testDbLoading, setTestDbLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let updates = { [name]: value };

        if (name === 'dbType') {
            if (value === 'postgres') {
                updates.port = '5432';
                updates.user = 'postgres';
                updates.host = credentials.host || 'localhost';
            } else if (value === 'mysql') {
                updates.port = '3306';
                updates.user = 'root';
                updates.host = credentials.host || 'localhost';
            } else if (value === 'mssql') {
                updates.port = '1433';
                updates.user = 'sa';
                updates.host = credentials.host || 'localhost';
            } else if (value === 'sqlite') {
                updates.port = '';
                updates.user = '';
                updates.host = '';
            } else {
                updates.port = '3050';
                updates.user = 'SYSDBA';
                updates.host = credentials.host || 'localhost';
            }
        }

        setCredentials({ ...credentials, ...updates });
    };

    const handleTestHost = async () => {
        if (!credentials.host) {
            setError('Host is required for testing');
            return;
        }
        setTestHostLoading(true);
        setError('');
        setSuccess('');
        try {
            const result = await api.post('/auth/test-host', { host: credentials.host });
            setSuccess(result.data.message);
        } catch (err) {
            setError('Host test failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setTestHostLoading(false);
        }
    };

    const handleTestDb = async () => {
        setTestDbLoading(true);
        setError('');
        setSuccess('');
        try {
            const result = await api.post('/auth/test-db', credentials);
            setSuccess(result.data.message);
        } catch (err) {
            setError('DB test failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setTestDbLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const result = await login(credentials);
            if (result.success) {
                navigate('/');
            } else {
                setError(result.message || 'Login failed');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Connection error. Check settings.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Grid container sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
            <LoginFeatures />
            <LoginForm
                credentials={credentials}
                showPassword={showPassword}
                error={error}
                success={success}
                loading={loading}
                testHostLoading={testHostLoading}
                testDbLoading={testDbLoading}
                handleChange={handleChange}
                handleTestHost={handleTestHost}
                handleTestDb={handleTestDb}
                handleSubmit={handleSubmit}
                setShowPassword={setShowPassword}
                isMobile={isMobile}
                t={t}
            />
        </Grid>
    );
};

export default Login;
