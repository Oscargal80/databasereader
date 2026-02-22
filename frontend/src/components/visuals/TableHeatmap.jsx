import React from 'react';
import { Box, Paper, Typography, Grid, Tooltip } from '@mui/material';

const TableHeatmap = ({ tables, usage }) => {
    // Find max usage to normalize colors
    const maxUsage = Math.max(...Object.values(usage), 1);

    const getHeatColor = (count) => {
        if (!count) return 'rgba(0, 0, 0, 0.05)';
        const intensity = Math.min(count / maxUsage, 1);
        // From pale blue to deep red/orange
        const r = Math.floor(255 * intensity);
        const g = Math.floor(100 * (1 - intensity));
        const b = Math.floor(200 * (1 - intensity));
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    };

    return (
        <Paper elevation={0} sx={{ p: 4, height: '100%', overflow: 'auto', bgcolor: 'transparent' }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 4 }}>
                Table Activity Heatmap
            </Typography>
            <Grid container spacing={2}>
                {tables.map(table => (
                    <Grid item key={table.name} xs={12} sm={6} md={3} lg={2}>
                        <Tooltip title={`Usage Count: ${usage[table.name] || 0}`} arrow>
                            <Box
                                sx={{
                                    height: 100,
                                    bgcolor: getHeatColor(usage[table.name] || 0),
                                    borderRadius: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    p: 1,
                                    color: (usage[table.name] || 0) / maxUsage > 0.5 ? 'white' : 'text.primary',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                        transform: 'scale(1.05)',
                                        cursor: 'help',
                                        boxShadow: 4
                                    },
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    backdropFilter: 'blur(5px)',
                                }}
                            >
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', textAlign: 'center', wordBreak: 'break-all' }}>
                                    {table.name}
                                </Typography>
                                <Typography variant="h6">
                                    {usage[table.name] || 0}
                                </Typography>
                            </Box>
                        </Tooltip>
                    </Grid>
                ))}
            </Grid>
        </Paper>
    );
};

export default TableHeatmap;
