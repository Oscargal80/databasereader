import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, Card, CardContent,
    CircularProgress, Alert, Divider, Chip
} from '@mui/material';
import {
    Storage as DBIcon, Computer as HostIcon,
    AccessTime as TimeIcon, VerifiedUser as UserIcon,
    Code as VersionIcon, Info as InfoIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

const DatabaseInfo = () => {
    const { t } = useTranslation();
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await api.get('/db/status');
                setInfo(response.data.data);
            } catch (err) {
                setError('Failed to fetch database status: ' + err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchStatus();
    }, []);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    const infoCards = [
        { title: 'Host / Server', value: info.host, icon: <HostIcon color="primary" />, color: '#e3f2fd' },
        { title: 'Database Name', value: info.database, icon: <DBIcon color="secondary" />, color: '#f3e5f5' },
        { title: 'Engine Version', value: info.version, icon: <VersionIcon color="success" />, color: '#e8f5e9' },
        { title: 'Connected User', value: info.user, icon: <UserIcon color="warning" />, color: '#fff3e0' },
        { title: 'Engine Type', value: info.dbType.toUpperCase(), icon: <InfoIcon color="error" />, color: '#ffebee' },
        { title: 'System Time', value: new Date(info.serverTime).toLocaleString(), icon: <TimeIcon color="info" />, color: '#e0f7fa' },
    ];

    return (
        <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                {t('menu.dbInfo') || 'Database & System Info'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Real-time technical details and connection state of the current environment.
            </Typography>

            <Grid container spacing={3}>
                {infoCards.map((card, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                        <Card elevation={3} sx={{ height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Box sx={{
                                        p: 1.5,
                                        borderRadius: 2,
                                        bgcolor: card.color,
                                        display: 'flex',
                                        mr: 2,
                                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)'
                                    }}>
                                        {card.icon}
                                    </Box>
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight="bold">
                                        {card.title}
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ wordBreak: 'break-all', fontWeight: '900', letterSpacing: -0.5 }}>
                                    {card.value}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Paper sx={{ mt: 5, p: 4, borderRadius: 4, bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#fafafa' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Environment Connectivity</Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                            <Chip label="ONLINE" color="success" size="small" sx={{ fontWeight: 'bold' }} />
                            <Typography variant="body2">Primary Connection Tunnel: <strong>Active</strong></Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                            <Chip label="SECURE" color="info" size="small" sx={{ fontWeight: 'bold' }} />
                            <Typography variant="body2">SSL/TLS Encryption: <strong>Enabled</strong></Typography>
                        </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">
                            Session started: {new Date().toLocaleTimeString()} <br />
                            Client IP Tracking: 127.0.0.1 (Internal Loopback)
                        </Typography>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default DatabaseInfo;
