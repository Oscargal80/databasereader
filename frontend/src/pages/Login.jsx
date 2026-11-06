import React, { useState, useMemo } from 'react';
import { Grid, useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { recentDatabasesFor, rememberDatabase } from '../utils/recentConnections';

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
        role: '',
        dbType: 'firebird'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [testHostLoading, setTestHostLoading] = useState(false);
    const [testDbLoading, setTestDbLoading] = useState(false);
    const [serverDatabases, setServerDatabases] = useState([]);
    const [searchDbLoading, setSearchDbLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let updates = { [name]: value };

        if (name === 'dbType') {
            setServerDatabases([]);
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

    // Suggestions for the database field: found on the server, then used before on this device
    const databaseOptions = useMemo(() => {
        const found = serverDatabases.map(label => ({ label, group: 'En el servidor' }));
        const seen = new Set(serverDatabases);
        const recent = recentDatabasesFor(credentials.dbType, credentials.host)
            .filter(name => !seen.has(name))
            .map(label => ({ label, group: 'Recientes' }));
        return [...found, ...recent];
    }, [serverDatabases, credentials.dbType, credentials.host]);

    const handleDatabaseInput = (value) => {
        setCredentials(previous => ({ ...previous, database: value }));
    };

    const handleSearchDatabases = async () => {
        if (!credentials.host || !credentials.user) {
            setError('Completa host, usuario y contraseña para buscar las bases del servidor');
            return;
        }
        setSearchDbLoading(true);
        setError('');
        setSuccess('');
        try {
            const result = await api.post('/auth/list-databases', credentials);
            setServerDatabases(result.data.databases);
            setSuccess(`Se encontraron ${result.data.databases.length} base(s). Elige una en el campo de la base.`);
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setSearchDbLoading(false);
        }
    };

    // Native file picker, only offered by the desktop app and only for a server on this machine
    const desktop = window.sqlCopilotDesktop;
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(String(credentials.host).trim().toLowerCase());
    const canBrowseFile = Boolean(desktop && desktop.pickDatabaseFile) && isLocalHost;
    let browseHint = 'Elegir el archivo de la base en este equipo';
    if (!desktop) {
        browseHint = 'Solo disponible en la app de escritorio. Desde el navegador o el celular escribe la ruta tal como la ve el servidor.';
    } else if (!isLocalHost) {
        browseHint = 'Examinar solo funciona si el servidor es este equipo (localhost). Para un servidor remoto escribe la ruta tal como la ve ese servidor.';
    }

    const handleBrowseFile = async () => {
        const filePath = await desktop.pickDatabaseFile();
        if (filePath) setCredentials(previous => ({ ...previous, database: filePath }));
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
                rememberDatabase(credentials);
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
                databaseOptions={databaseOptions}
                handleDatabaseInput={handleDatabaseInput}
                handleSearchDatabases={handleSearchDatabases}
                searchDbLoading={searchDbLoading}
                canBrowseFile={canBrowseFile}
                browseHint={browseHint}
                handleBrowseFile={handleBrowseFile}
                isMobile={isMobile}
                t={t}
            />
        </Grid>
    );
};

export default Login;
