import React, { useState, useEffect } from 'react';
import { Box, Paper, Tabs, Tab, Typography, CircularProgress, Container } from '@mui/material';
import { AccountTree, Hub, AutoGraph, LocalFireDepartment } from '@mui/icons-material';
import axios from 'axios';
import ERDiagram from '../components/visuals/ERDiagram';
import TableHeatmap from '../components/visuals/TableHeatmap';
import { useTranslation } from 'react-i18next';

const VisualExplorer = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [schema, setSchema] = useState({ tables: [], relationships: [] });
    const [usage, setUsage] = useState({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const baseURL = import.meta.env.VITE_API_URL || (window.location.protocol === 'file:' ? 'http://127.0.0.1:5005/api' : '/api');

            const [schemaRes, usageRes] = await Promise.all([
                axios.get(`${baseURL}/db/visual-metadata`, { withCredentials: true }),
                axios.get(`${baseURL}/db/usage-stats`, { withCredentials: true })
            ]);

            if (schemaRes.data.success) setSchema(schemaRes.data.data);
            if (usageRes.data.success) setUsage(usageRes.data.data);

        } catch (err) {
            console.error('Error fetching visual data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexWrap: 'column', height: '80vh', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
                <CircularProgress size={60} />
                <Typography variant="h6">Analyzing Database Schema...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', height: 'calc(100vh - 120px)' }}>
            <Paper
                elevation={4}
                sx={{
                    mb: 2,
                    borderRadius: 3,
                    overflow: 'hidden',
                    background: theme => theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={handleChange}
                    variant="fullWidth"
                    textColor="primary"
                    indicatorColor="primary"
                >
                    <Tab icon={<AccountTree />} label="ER Diagram" />
                    <Tab icon={<Hub />} label="Relationship Map" />
                    <Tab icon={<LocalFireDepartment />} label="Usage Heatmap" />
                    <Tab icon={<AutoGraph />} label="FK Visualizer" />
                </Tabs>
            </Paper>

            <Box sx={{ height: '100%', position: 'relative' }}>
                {activeTab === 0 && <ERDiagram schema={schema} />}
                {activeTab === 1 && <ERDiagram schema={schema} viewType="relationships" />}
                {activeTab === 2 && <TableHeatmap tables={schema.tables} usage={usage} />}
                {activeTab === 3 && <ERDiagram schema={schema} viewType="fks" />}
            </Box>
        </Box>
    );
};

export default VisualExplorer;
