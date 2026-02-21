import React, { useState, useEffect } from 'react';
import {
    Grid, Paper, Typography, List, ListItem, ListItemButton,
    ListItemIcon, ListItemText, Divider, Box, CircularProgress,
    Tooltip, Chip, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
    TableChart, Settings, ViewList, FlashOn, AutoFixHigh,
    ExpandMore, Reorder
} from '@mui/icons-material';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import EntityChart from '../components/dashboard/EntityChart';

const DBExplorer = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({});
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();

    const dbNames = {
        'firebird': 'Firebird',
        'postgres': 'PostgreSQL',
        'mssql': 'SQL Server',
        'mysql': 'MySQL / MariaDB',
        'sqlite': 'SQLite'
    };

    const categoryMap = {
        'Tables': t('explorer.tables'),
        'System Tables': t('explorer.systemTables'),
        'Views': t('explorer.views'),
        'Materialized Views': t('explorer.matViews'),
        'Procedures': t('explorer.procedures'),
        'Triggers': t('explorer.triggers'),
        'Generators': t('explorer.generators'),
        'Reports': t('explorer.reports')
    };

    useEffect(() => {
        fetchExplorerData();
    }, []);

    const fetchExplorerData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            const url = forceRefresh ? '/db/explorer?refresh=true' : '/db/explorer';
            const response = await api.get(url);
            setData(response.data.data);

            // Fetch per-table row counts
            const countsUrl = forceRefresh ? '/db/tableCounts?refresh=true' : '/db/tableCounts';
            const countResp = await api.get(countsUrl);
            if (countResp.data && countResp.data.success) {
                setCounts(countResp.data.data);
            }
        } catch (error) {
            console.error('Error fetching explorer data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;

    const renderList = (items, type, icon, color) => {
        const isArray = Array.isArray(items);
        const count = isArray ? items.length : 0;

        return (
            <Paper elevation={2} sx={{ mb: 3 }}>
                <Box sx={{ p: 2, bgcolor: color, color: 'white', borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
                    <Typography variant="h6" display="flex" alignItems="center">
                        {icon} <Box component="span" sx={{ ml: 1 }}>{categoryMap[type] || type}</Box>
                        <Chip label={count} size="small" sx={{ ml: 'auto', bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                    </Typography>
                </Box>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {!isArray ? (
                        <ListItem><ListItemText secondary={t('explorer.noData')} /></ListItem>
                    ) : items.length === 0 ? (
                        <ListItem><ListItemText secondary={t('explorer.empty')} /></ListItem>
                    ) : (
                        items.map((item) => (
                            <ListItem key={item} disablePadding>
                                <ListItemButton onClick={() => navigate(`/crud/${item}?type=${type}`)}>
                                    <ListItemText primary={item} />
                                    {type === 'Tables' && (
                                        <Chip label={`${counts[item] ?? 0} ${t('explorer.rows')}`} size="small" sx={{ ml: 1, bgcolor: 'rgba(0,0,0,0.1)' }} />
                                    )}
                                </ListItemButton>
                            </ListItem>
                        ))
                    )}
                </List>
            </Paper>
        );
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
                {dbNames[user?.dbType] || 'Database'} Explorer
            </Typography>

            {/* Dashboard Analytics Section */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 8, lg: 6 }}>
                    {data && <EntityChart data={data} />}
                </Grid>
                {/* We can add more stat cards here later */}
            </Grid>

            {/* Entity Lists */}
            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.userTables, 'Tables', <TableChart />, '#1976d2')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.views, 'Views', <ViewList />, '#2e7d32')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.materializedViews, 'Materialized Views', <ViewList />, '#004d40')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.reports, 'Reports', <Reorder />, '#bf360c')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.procedures, 'Procedures', <Settings />, '#ed6c02')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.triggers, 'Triggers', <FlashOn />, '#9c27b0')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.generators, 'Generators', <AutoFixHigh />, '#d32f2f')}
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    {renderList(data.systemTables, 'System Tables', <Settings />, '#757575')}
                </Grid>
            </Grid>
        </Box>
    );
};

export default DBExplorer;
