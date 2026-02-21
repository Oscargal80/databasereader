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
                    background: 'radial-gradient(circle at top left, #0a192f 0%, #020c1b 100%)',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    p: 6
                }}
            >
                {/* Decorative Elements */}
                <Box
                    sx={{
                        position: 'absolute', top: '-10%', left: '-10%',
                        width: '50%', height: '50%',
                        background: 'radial-gradient(circle, rgba(100,255,218,0.1) 0%, transparent 70%)',
                        zIndex: 0
                    }}
                />

                <Box sx={{ zIndex: 1, maxWidth: 480 }}>
                    <Box display="flex" alignItems="center" mb={2}>
                        <StorageIcon sx={{ fontSize: 48, color: '#64ffda', mr: 2 }} />
                        <Typography variant="h3" fontWeight="800" letterSpacing={1}>
                            Universal DB
                        </Typography>
                    </Box>
                    <Typography variant="h5" color="#8892b0" mb={6} fontWeight="300">
                        Enterprise Database Management Platform v1.1
                    </Typography>

                    <Box display="flex" flexDirection="column" gap={4}>
                        <Box display="flex" alignItems="flex-start">
                            <SecurityIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                            <Box>
                                <Typography variant="h6" fontWeight="600">Secure Connectivity</Typography>
                                <Typography variant="body2" color="#8892b0">End-to-end encrypted tunnels for safe remote database access.</Typography>
                            </Box>
                        </Box>
                        <Box display="flex" alignItems="flex-start">
                            <ApiIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                            <Box>
                                <Typography variant="h6" fontWeight="600">Multi-Engine Support</Typography>
                                <Typography variant="body2" color="#8892b0">Seamlessly manage PostgreSQL, MySQL, Firebird, and SQLite from one console.</Typography>
                            </Box>
                        </Box>
                        <Box display="flex" alignItems="flex-start">
                            <SpeedIcon sx={{ color: '#64ffda', mr: 2, mt: 0.5 }} />
                            <Box>
                                <Typography variant="h6" fontWeight="600">AI-Powered Analytics</Typography>
                                <Typography variant="body2" color="#8892b0">Generate SQL queries instantly using advanced natural language processing.</Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Minimalist Footer */}
                <Box sx={{ position: 'absolute', bottom: 32, opacity: 0.6, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="caption">&copy; {new Date().getFullYear()} BinariaOS Technologies</Typography>
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
                            p: { xs: 4, sm: 6 },
                            width: '100%',
                            maxWidth: 500,
                            borderRadius: 4,
                            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18)',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <Box mb={4} textAlign={isMobile ? 'center' : 'left'}>
                            {isMobile && (
                                <Box display="flex" justifyItems="center" justifyContent="center" mb={2}>
                                    <StorageIcon sx={{ fontSize: 40, color: '#1976d2' }} />
                                </Box>
                            )}
                            <Typography variant="h4" fontWeight="700" color="text.primary" gutterBottom>
                                Connection Setup
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Enter your database credentials to begin session.
                            </Typography>
                        </Box>

                        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
                        {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{success}</Alert>}

                        <form onSubmit={handleSubmit}>
                            <Grid container spacing={2.5}>
                                {/* Database Type */}
                                <Grid item xs={12}>
                                    <FormControl fullWidth size="medium">
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
                                                label="Host Server or IP"
                                                name="host"
                                                value={credentials.host}
                                                onChange={handleChange}
                                                placeholder="e.g. localhost, 192.168.1.10"
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><DnsIcon color="action" /></InputAdornment>,
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                required
                                                fullWidth
                                                label="Port"
                                                name="port"
                                                value={credentials.port}
                                                onChange={handleChange}
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><PortIcon color="action" /></InputAdornment>,
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
                                        label={credentials.dbType === 'sqlite' ? "Absolute SQLite File Path" : "Database Alias / Path"}
                                        name="database"
                                        value={credentials.database}
                                        onChange={handleChange}
                                        placeholder={credentials.dbType === 'sqlite' ? "/var/data/db.sqlite" : (credentials.dbType === 'firebird' ? "/path/to/db.fdb" : "dbname")}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><StorageIcon color="action" /></InputAdornment>,
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
                                                label="Username"
                                                name="user"
                                                value={credentials.user}
                                                onChange={handleChange}
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><PersonIcon color="action" /></InputAdornment>,
                                                    sx: { borderRadius: 2 }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                required
                                                fullWidth
                                                label="Password"
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={credentials.password}
                                                onChange={handleChange}
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start"><LockIcon color="action" /></InputAdornment>,
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                                                {showPassword ? <VisibilityOff /> : <Visibility />}
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
                                <Grid item xs={12} sx={{ mt: 2 }}>
                                    <Button
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        disabled={loading}
                                        sx={{
                                            py: 1.5,
                                            borderRadius: 2,
                                            fontWeight: 700,
                                            fontSize: '1rem',
                                            textTransform: 'none',
                                            boxShadow: '0 8px 16px 0 rgba(25, 118, 210, 0.24)',
                                            '&:hover': {
                                                boxShadow: '0 12px 20px 0 rgba(25, 118, 210, 0.4)'
                                            }
                                        }}
                                    >
                                        {loading ? <CircularProgress size={26} color="inherit" /> : 'Connect Database'}
                                    </Button>
                                </Grid>

                                {/* Testing Area (Hidden for SQLite) */}
                                {credentials.dbType !== 'sqlite' && (
                                    <Grid item xs={12} sx={{ mt: 1 }}>
                                        <Box display="flex" justifyContent="center" gap={2}>
                                            <Button
                                                variant="outlined"
                                                color="secondary"
                                                size="small"
                                                onClick={handleTestHost}
                                                disabled={testHostLoading || !credentials.host}
                                                sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
                                            >
                                                {testHostLoading ? <CircularProgress size={16} /> : 'Ping Host'}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                color="info"
                                                size="small"
                                                onClick={handleTestDb}
                                                disabled={testDbLoading || !credentials.database}
                                                sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
                                            >
                                                {testDbLoading ? <CircularProgress size={16} /> : 'Test Connection'}
                                            </Button>
                                        </Box>
                                    </Grid>
                                )}
                            </Grid>
                        </form>

                        <Box mt={4} textAlign="center">
                            <Typography variant="body2" color="text.secondary">
                                Need help? View the <Link href="/README.md" target="_blank" underline="hover">Documentation</Link> or ensure backend port 5000 is reachable.
                            </Typography>
                        </Box>
                    </Paper>
                </Fade>
            </Grid>
        </Grid>
    );
};

export default Login;
