import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, CircularProgress, Container } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    withCredentials: true
});

const LicenseEntry = ({ machineCode, onActivated }) => {
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleActivate = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const response = await api.post('/license/activate', { key });
            if (response.data.success) {
                onActivated();
            } else {
                setError(response.data.message || 'Invalid Key');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Verification Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <Paper elevation={6} sx={{ p: 4, width: '100%', borderRadius: 3, textAlign: 'center' }}>
                    <LockOutlinedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography component="h1" variant="h5" fontWeight={700} gutterBottom>
                        Universal DB Admin
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        This Enterprise Software requires activation to run on this machine. Please provide your HWID to your administrator to receive an Activation Key.
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, mb: 3, border: '1px dashed grey' }}>
                        <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" justifyContent="center" gap={1}>
                            <FingerprintIcon fontSize="small" /> MACHINE CODE (HWID)
                        </Typography>
                        <Typography variant="h6" fontWeight={800} letterSpacing={2} color="primary.main" mt={1}>
                            {machineCode}
                        </Typography>
                    </Box>

                    <form onSubmit={handleActivate}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="licenseKey"
                            label="Activation Key"
                            name="licenseKey"
                            autoComplete="off"
                            autoFocus
                            value={key}
                            onChange={(e) => setKey(e.target.value.toUpperCase())}
                            placeholder="XXXXX-XXXXX-XXXXX"
                            inputProps={{ style: { textAlign: 'center', letterSpacing: 2, fontWeight: 600 } }}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={loading || key.length < 15}
                            sx={{ mt: 3, mb: 2, py: 1.5, fontWeight: 'bold' }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Activate Software'}
                        </Button>
                    </form>
                </Paper>
            </Box>
        </Container>
    );
};

export default LicenseEntry;
