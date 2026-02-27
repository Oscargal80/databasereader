import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, TextField, Button, Grid,
    Alert, CircularProgress, Divider, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, IconButton, Chip
} from '@mui/material';
import {
    Save as SaveIcon, Settings as SettingsIcon,
    Delete as DeleteIcon, SwapHoriz as SwapIcon,
    Storage as StorageIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
    const { user, connections, switchConnection, removeConnection } = useAuth();
    const [settings, setSettings] = useState({
        OPENAI_API_KEY: '',
        GEMINI_API_KEY: '',
        PORT: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const baseURL = import.meta.env.VITE_API_URL || (window.location.protocol === 'file:' ? 'http://127.0.0.1:5005/api' : '/api');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${baseURL}/settings`, { withCredentials: true });
            if (res.data.success) {
                setSettings(res.data.settings);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
            setMessage({ type: 'error', text: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setMessage({ type: '', text: '' });
            const res = await axios.post(`${baseURL}/settings`, settings, { withCredentials: true });
            if (res.data.success) {
                setMessage({ type: 'success', text: res.data.message });
            }
        } catch (err) {
            console.error('Error saving settings:', err);
            const errorMsg = err.response?.data?.message || 'Failed to save settings.';
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <SettingsIcon sx={{ mr: 1, fontSize: 30, color: 'primary.main' }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Configuration
                </Typography>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                    <Paper sx={{ p: 4, borderRadius: 2, mb: 3 }}>
                        <form onSubmit={handleSave}>
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <Typography variant="h6" gutterBottom>AI API Keys</Typography>
                                    <Divider sx={{ mb: 2 }} />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="OpenAI API Key"
                                        name="OPENAI_API_KEY"
                                        value={settings.OPENAI_API_KEY}
                                        onChange={handleChange}
                                        type="password"
                                        placeholder="sk-..."
                                        helperText="Leave as ******** to keep current value"
                                    />
                                </Grid>

                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Gemini API Key"
                                        name="GEMINI_API_KEY"
                                        value={settings.GEMINI_API_KEY}
                                        onChange={handleChange}
                                        type="password"
                                        placeholder="AIza..."
                                        helperText="Leave as ******** to keep current value"
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>System Settings</Typography>
                                    <Divider sx={{ mb: 2 }} />
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        label="Backend Port"
                                        name="PORT"
                                        value={settings.PORT}
                                        onChange={handleChange}
                                        type="number"
                                        helperText="Default: 5005. Changing this may require manual restart."
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    {message.text && (
                                        <Alert severity={message.type} sx={{ mt: 2 }}>
                                            {message.text}
                                        </Alert>
                                    )}
                                </Grid>

                                <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        type="submit"
                                        startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                        disabled={saving}
                                        sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                                    >
                                        Save Configuration
                                    </Button>
                                </Grid>
                            </Grid>
                        </form>
                    </Paper>
                </Grid>

                <Grid item xs={12} lg={4}>
                    <Paper sx={{ p: 4, borderRadius: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                            <StorageIcon sx={{ mr: 1 }} /> Registered Databases
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Database</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {connections.map((conn, idx) => {
                                        const isActive = user?.database === conn.database && user?.host === conn.host;
                                        return (
                                            <TableRow key={idx} sx={{ bgcolor: isActive ? 'action.selected' : 'inherit' }}>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                                        {conn.database}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {conn.host} ({conn.dbType})
                                                    </Typography>
                                                    {isActive && <Chip label="Active" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: '0.65rem' }} />}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {!isActive && (
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={() => switchConnection(conn).then(() => window.location.reload())}
                                                            title="Switch to this DB"
                                                        >
                                                            <SwapIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => removeConnection(conn)}
                                                        title="Remove from registry"
                                                        disabled={isActive && connections.length > 1}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {connections.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} align="center">
                                                <Typography variant="caption">No databases registered.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Settings;
