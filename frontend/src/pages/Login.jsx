import React, { useState } from 'react';
import {
    Container, Box, Typography, TextField, Button, Paper,
    Alert, CircularProgress, InputAdornment, IconButton,
    FormControl, InputLabel, Select, MenuItem, Grid, Divider, Link
} from '@mui/material';
import {
    Dns as DnsIcon, SettingsInputComponent as PortIcon, Storage as StorageIcon,
    Person as PersonIcon, Lock as LockIcon, Visibility, VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
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

        // Auto-fill default ports when switching DB type
        if (name === 'dbType') {
            if (value === 'postgres') {
                updates.port = '5432';
                updates.user = 'postgres';
            } else {
                updates.port = '3050';
                updates.user = 'SYSDBA';
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
            setError(err.response?.data?.message || 'Connection error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Grid container sx={{ height: '100vh' }}>
            {/* Left side: Background Image */}
            <Grid
                item
                xs={false}
                sm={4}
                md={7}
                sx={{
                    backgroundImage: 'url(/login-bg.jpg)',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: (t) =>
                        t.palette.mode === 'light' ? t.palette.grey[50] : t.palette.grey[900],
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: { xs: 'none', sm: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 4,
                    color: 'white',
                    position: 'relative',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        zIndex: 1
                    }
                }}
            >
                <Box sx={{ zIndex: 2, textAlign: 'center', maxWidth: 450 }}>
                    <Typography variant="h3" fontWeight="bold" gutterBottom>
                        Universal DB Admin
                    </Typography>
                    <Typography variant="h6" sx={{ opacity: 0.9 }}>
                        Manage your Firebird and PostgreSQL databases with ease.
                    </Typography>
                </Box>
            </Grid>

            {/* Right side: Login Form */}
            <Grid item xs={12} sm={8} md={5} lg={4} component={Paper} elevation={6} square sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Box
                    sx={{
                        my: 4,
                        mx: { xs: 3, md: 6 },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography component="h1" variant="h5" gutterBottom fontWeight="bold" color="primary">
                        Welcome Back
                    </Typography>
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
                        Login to manage your database connections
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2, width: '100%' }}>{success}</Alert>}

                    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                        <FormControl fullWidth margin="dense" size="small">
                            <InputLabel>Database Type</InputLabel>
                            <Select
                                name="dbType"
                                value={credentials.dbType}
                                label="Database Type"
                                onChange={handleChange}
                            >
                                <MenuItem value="firebird">Firebird</MenuItem>
                                <MenuItem value="postgres">PostgreSQL</MenuItem>
                            </Select>
                        </FormControl>

                        <Grid container spacing={1}>
                            <Grid item xs={12} sm={8}>
                                <TextField
                                    margin="dense"
                                    required
                                    fullWidth
                                    size="small"
                                    label="Host / IP"
                                    name="host"
                                    value={credentials.host}
                                    onChange={handleChange}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><DnsIcon fontSize="small" color="action" /></InputAdornment> }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    margin="dense"
                                    required
                                    fullWidth
                                    size="small"
                                    label="Port"
                                    name="port"
                                    value={credentials.port}
                                    onChange={handleChange}
                                />
                            </Grid>
                        </Grid>

                        <TextField
                            margin="dense"
                            required
                            fullWidth
                            size="small"
                            label={credentials.dbType === 'postgres' ? "Database Name" : "Database Path"}
                            name="database"
                            placeholder={credentials.dbType === 'postgres' ? "postgres" : "C:\\DB\\MYDB.FDB"}
                            value={credentials.database}
                            onChange={handleChange}
                            InputProps={{ startAdornment: <InputAdornment position="start"><StorageIcon fontSize="small" color="action" /></InputAdornment> }}
                        />
                        <TextField
                            margin="dense"
                            required
                            fullWidth
                            size="small"
                            label="User"
                            name="user"
                            value={credentials.user}
                            onChange={handleChange}
                            InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" color="action" /></InputAdornment> }}
                        />
                        <TextField
                            margin="dense"
                            required
                            fullWidth
                            size="small"
                            label="Password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            value={credentials.password}
                            onChange={handleChange}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" color="action" /></InputAdornment>,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />

                        <Box sx={{ display: 'flex', gap: 1.5, mt: 3, mb: 1 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                color="info"
                                size="medium"
                                sx={{ fontWeight: 'bold' }}
                                onClick={handleTestDb}
                                disabled={testDbLoading || loading}
                            >
                                {testDbLoading ? <CircularProgress size={20} /> : 'Test'}
                            </Button>
                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="medium"
                                sx={{ fontWeight: 'bold' }}
                                disabled={loading || testDbLoading}
                            >
                                {loading ? <CircularProgress size={20} /> : 'Connect'}
                            </Button>
                        </Box>
                    </form>

                    <Divider sx={{ width: '100%', my: 2.5 }} />

                    <Typography variant="caption" color="textSecondary" align="center">
                        Universal DB Admin v1.0 • Dev by{' '}
                        <Link href="https://binariaos.com.py" target="_blank" rel="noopener" color="inherit" sx={{ fontWeight: 'bold' }}>
                            BinariaOS
                        </Link>{' '}
                        2026
                    </Typography>
                </Box>
            </Grid>
        </Grid>
    );
};

export default Login;
