import React, { useState } from 'react';
import {
    Grid, Box, Typography, TextField, Button, Paper, Alert,
    CircularProgress, useTheme, Fade, InputAdornment
} from '@mui/material';
import {
    VpnKey as VpnKeyIcon,
    Fingerprint as FingerprintIcon,
    Security as SecurityIcon,
    CheckCircleOutline as CheckCircleIcon
} from '@mui/icons-material';
import api from '../services/api';

const LicenseEntry = ({ machineCode, onActivated }) => {
    const theme = useTheme();
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleActivate = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await api.post('/sys-check/activate', { key });
            if (response.data.success) {
                setSuccess(true);
                setTimeout(() => {
                    onActivated();
                }, 1500); // Brief pause to show success animation
            } else {
                setError(response.data.message || 'Invalid Activation Key');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification Error. Check connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Grid container sx={{ minHeight: '100vh', backgroundColor: theme.palette.background.default, alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <Fade in={true} timeout={800}>
                <Paper
                    elevation={24}
                    sx={{
                        p: { xs: 4, md: 6 },
                        width: '100%',
                        maxWidth: 600,
                        borderRadius: 4,
                        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.3)',
                        backgroundColor: theme.palette.background.paper,
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Decorative Top Bar */}
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #1976d2, #64ffda)' }} />

                    <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
                        <SecurityIcon sx={{ fontSize: 56, color: '#1976d2', mb: 2 }} />
                        <Typography variant="h4" fontWeight="800" color="text.primary" align="center" gutterBottom>
                            System Activation
                        </Typography>
                        <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 450 }}>
                            Universal DB Admin requires a valid enterprise activation key to unlock its full potential.
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                    <form onSubmit={handleActivate}>
                        <TextField
                            required
                            fullWidth
                            id="licenseKey"
                            label="Enter Activation Key"
                            name="licenseKey"
                            autoComplete="off"
                            autoFocus
                            value={key}
                            onChange={(e) => setKey(e.target.value.toUpperCase())}
                            placeholder="XXXXX-XXXXX-XXXXX"
                            variant="outlined"
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><VpnKeyIcon color="action" /></InputAdornment>,
                                sx: { borderRadius: 2, fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: 2, textAlign: 'center' }
                            }}
                            sx={{ mb: 4 }}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            color={success ? "success" : "primary"}
                            size="large"
                            disabled={loading || key.length < 15 || success}
                            sx={{
                                py: 1.8,
                                borderRadius: 2,
                                fontWeight: 700,
                                fontSize: '1.1rem',
                                textTransform: 'none',
                                boxShadow: success ? '0 8px 16px 0 rgba(46, 125, 50, 0.4)' : '0 8px 16px 0 rgba(25, 118, 210, 0.24)',
                                transition: 'all 0.3s ease'
                            }}
                            startIcon={success ? <CheckCircleIcon /> : null}
                        >
                            {loading ? <CircularProgress size={28} color="inherit" /> : success ? 'Activation Successful!' : 'Activate License'}
                        </Button>
                    </form>
                </Paper>
            </Fade>
        </Grid>
    );
};

export default LicenseEntry;
