import React, { useState } from 'react';
import {
    Box, Typography, TextField, Button, Paper,
    Alert, CircularProgress, InputAdornment, IconButton,
    FormControl, InputLabel, Select, MenuItem, Grid, Link,
    useTheme, useMediaQuery, Fade
} from '@mui/material';
import {
    Dns as DnsIcon, SettingsInputComponent as PortIcon, Storage as StorageIcon,
    Person as PersonIcon, Lock as LockIcon, Visibility, VisibilityOff,
    Security as SecurityIcon, Speed as SpeedIcon, Api as ApiIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
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

        // Auto-fill default ports when switching DB type
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
        <Grid container sx={{ minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
            {/* Left Side: Premium Branding (Hidden on Mobile) */}
            <Grid
                item
                xs={12}
                md={5}
                lg={6}
                sx={{
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundImage: 'url(/login-bg.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    p: 6,
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        zIndex: 0
                    }
                }}
            >
                {/* Decorative overlay element removed since we have the image with overlay now */}


                <Box sx={{ zIndex: 1, maxWidth: 480 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                        <StorageIcon sx={{ fontSize: 36, color: '#64ffda', mr: 2 }} />
                        <Typography variant="h4" fontWeight="800" letterSpacing={1}>
                            Universal DB
                        </Typography>
                    </Box>
                    <Typography variant="h6" color="#8892b0" mb={3} fontWeight="300">
                        Enterprise Database Platform v1.1
                    </Typography>

                    <Box display="flex" flexDirection="column" gap={2}>
                        <Box display="flex" alignItems="flex-start">
                            <SecurityIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                            <Box>
                                <Typography variant="subtitle1" fontWeight="600">Secure Connectivity</Typography>
                                <Typography variant="body2" color="#8892b0">End-to-end encrypted tunnels for safe remote database access.</Typography>
                            </Box>
                        </Box>
                        <Box display="flex" alignItems="flex-start">
                            <ApiIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                            <Box>
                                <Typography variant="subtitle1" fontWeight="600">Multi-Engine Support</Typography>
                                <Typography variant="body2" color="#8892b0">Seamlessly manage PostgreSQL, MySQL, Firebird, and SQLite from one console.</Typography>
                            </Box>
                        </Box>
                        <Box display="flex" alignItems="flex-start">
                            <SpeedIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                            <Box>
                                <Typography variant="subtitle1" fontWeight="600">AI-Powered Analytics</Typography>
                                <Typography variant="body2" color="#8892b0">Generate SQL queries instantly using advanced natural language processing.</Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Minimalist Footer */}
                <Box sx={{ position: 'absolute', bottom: 16, zIndex: 1, opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption">
                        &copy; {new Date().getFullYear()} Designed by <Link href="https://binariaos.com.py" target="_blank" color="inherit" underline="hover">BinariaOS</Link> Technologies
                    </Typography>
                </Box>
            </Grid>

            {/* Right Side: Elegant Form */}
            <Grid
                item
                xs={12}
                md={7}
                lg={6}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3
                }}
            >
                <Fade in={true} timeout={800}>
                    <Paper
                        elevation={24}
                        sx={{
                            p: { xs: 3, sm: 4 },
                            width: '100%',
                            maxWidth: 500,
                            borderRadius: 4,
                            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18)',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <Box mb={2} textAlign={isMobile ? 'center' : 'left'}>
                            {isMobile && (
                                <Box display="flex" justifyContent="center" mb={1}>
                                    <StorageIcon sx={{ fontSize: 32, color: '#1976d2' }} />
                                </Box>
                            )}
                            <Typography variant="h5" fontWeight="700" color="text.primary" gutterBottom>
                                Connection Setup
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Enter your database credentials to begin session.
                            </Typography>
                        </Box>

                        {error && <Alert severity="error" sx={{ mb: 2, py: 0, borderRadius: 2 }}>{error}</Alert>}
                        {success && <Alert severity="success" sx={{ mb: 2, py: 0, borderRadius: 2 }}>{success}</Alert>}

                        <form onSubmit={handleSubmit}>
                            <Grid container spacing={1.5}>
                                {/* Database Type */}
                                <Grid item xs={12}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Database Engine</InputLabel>
                                        <Select
                                            name="dbType"
                                            value={credentials.dbType}
                                            label="Database Engine"
                                            onChange={handleChange}
                                            sx={{ borderRadius: 2 }}
                                        >
                                            <MenuItem value="firebird"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#e53935' }} /> Firebird SQL</Box></MenuItem>
                                            <MenuItem value="postgres"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#1976d2' }} /> PostgreSQL</Box></MenuItem>
                                            <MenuItem value="mssql"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#0083c2' }} /> SQL Server</Box></MenuItem>
                                            <MenuItem value="mysql"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#f57c00' }} /> MySQL / MariaDB</Box></MenuItem>
                                            <MenuItem value="sqlite"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#757575' }} /> SQLite (Local)</Box></MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Host & Port (Hidden for SQLite) */}
                                {credentials.dbType !== 'sqlite' && (
                                    <>
                                        <Grid item xs={12} sm={8}>
                                            <TextField
                                                required
                                                fullWidth
                                                size="small"
                                                label="Host Server or IP"
                                                name="host"
                                                value={credentials.host}
                                                onChange={handleChange}
                                                placeholder="e.g. localhost, 192.168.1.10"
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><DnsIcon fontSize="small" color="action" /></InputAdornment>,
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                required
                                                fullWidth
                                                size="small"
                                                label="Port"
                                                name="port"
                                                value={credentials.port}
                                                onChange={handleChange}
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><PortIcon fontSize="small" color="action" /></InputAdornment>,
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />
                                        </Grid>
                                    </>
                                )}

                                {/* Database Path/Name */}
                                <Grid item xs={12}>
                                    <TextField
                                        required
                                        fullWidth
                                        size="small"
                                        label={credentials.dbType === 'sqlite' ? "Absolute SQLite File Path" : "Database Alias / Path"}
                                        name="database"
                                        value={credentials.database}
                                        onChange={handleChange}
                                        placeholder={credentials.dbType === 'sqlite' ? "/var/data/db.sqlite" : (credentials.dbType === 'firebird' ? "/path/to/db.fdb" : "dbname")}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><StorageIcon fontSize="small" color="action" /></InputAdornment>,
                                            sx: { borderRadius: 2 }
                                        }}
                                    />
                                </Grid>

                                {/* User & Password (Hidden for SQLite) */}
                                {credentials.dbType !== 'sqlite' && (
                                    <>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                required
                                                fullWidth
                                                size="small"
                                                label="Username"
                                                name="user"
                                                value={credentials.user}
                                                onChange={handleChange}
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" color="action" /></InputAdornment>,
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                required
                                                fullWidth
                                                size="small"
                                                label="Password"
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={credentials.password}
                                                onChange={handleChange}
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" color="action" /></InputAdornment>,
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                                                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                            </IconButton>
                                                        </InputAdornment>
                                                    ),
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />
                                        </Grid>
                                    </>
                                )}

                                {/* Action Buttons */}
                                <Grid item xs={12} sx={{ mt: 1 }}>
                                    <Button
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        disabled={loading}
                                        sx={{
                                            py: 1,
                                            borderRadius: 2,
                                            fontWeight: 700,
                                            textTransform: 'none',
                                            boxShadow: '0 8px 16px 0 rgba(25, 118, 210, 0.24)',
                                            '&:hover': {
                                                boxShadow: '0 12px 20px 0 rgba(25, 118, 210, 0.4)'
                                            }
                                        }}
                                    >
                                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Connect Database'}
                                    </Button>
                                </Grid>

                                {/* Testing Area (Hidden for SQLite) */}
                                {credentials.dbType !== 'sqlite' && (
                                    <Grid item xs={12}>
                                        <Box display="flex" justifyContent="center" gap={1}>
                                            <Button
                                                variant="outlined"
                                                color="secondary"
                                                size="small"
                                                onClick={handleTestHost}
                                                disabled={testHostLoading || !credentials.host}
                                                sx={{ borderRadius: 2, textTransform: 'none', px: 2 }}
                                            >
                                                {testHostLoading ? <CircularProgress size={16} /> : 'Ping Host'}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="info"
                                                size="small"
                                                onClick={handleTestDb}
                                                disabled={testDbLoading || !credentials.database}
                                                sx={{ borderRadius: 2, textTransform: 'none', px: 2 }}
                                            >
                                                {testDbLoading ? <CircularProgress size={16} /> : 'Test Connection'}
                                            </Button>
                                        </Box>
                                    </Grid>
                                )}
                            </Grid>
                        </form>

                        <Box mt={2} textAlign="center">
                            <Typography variant="caption" color="text.secondary">
                                Need help? <Link href="/README.md" target="_blank" underline="hover">Documentation</Link>
                            </Typography>
                        </Box>
                    </Paper>
                </Fade>
            </Grid>
        </Grid>
    );
};

export default Login;
