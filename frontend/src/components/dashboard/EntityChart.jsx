import React from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';

const EntityChart = ({ data }) => {
    const theme = useTheme();
    const { t } = useTranslation();

    if (!data) return null;

    // Formatting data for the PieChart
    const chartData = [
        { name: t('explorer.tables', 'Tables'), value: data.userTables?.length || 0, color: '#1976d2' },
        { name: t('explorer.views', 'Views'), value: data.views?.length || 0, color: '#2e7d32' },
        { name: t('explorer.matViews', 'Materialized Views'), value: data.materializedViews?.length || 0, color: '#004d40' },
        { name: t('explorer.procedures', 'Procedures'), value: data.procedures?.length || 0, color: '#ed6c02' },
        { name: t('explorer.triggers', 'Triggers'), value: data.triggers?.length || 0, color: '#9c27b0' },
        { name: t('explorer.reports', 'Reports'), value: data.reports?.length || 0, color: '#bf360c' }
    ].filter(item => item.value > 0); // Only show categories that have items

    // If database is completely empty
    if (chartData.length === 0) return null;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <Box sx={{ bgcolor: theme.palette.background.paper, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ color: payload[0].payload.color, fontWeight: 'bold' }}>
                        {payload[0].name}: {payload[0].value}
                    </Typography>
                </Box>
            );
        }
        return null;
    };

    return (
        <Paper elevation={3} sx={{ p: 2, height: 320, display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.paper }}>
            <Typography variant="h6" align="center" gutterBottom color="text.secondary">
                {t('dashboard.schemaOverview', 'Database Schema Overview')}
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </Box>
        </Paper>
    );
};

export default EntityChart;
