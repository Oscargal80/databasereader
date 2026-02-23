import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, Card, CardContent, CardActions,
    Button, IconButton, TextField, InputAdornment, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Alert, Tooltip
} from '@mui/material';
import {
    Search as SearchIcon, ContentCopy as CopyIcon,
    PlayArrow as PlayIcon, Delete as DeleteIcon,
    History as HistoryIcon, Bookmark as BookmarkIcon,
    Storage as DbIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const SavedQueries = () => {
    const { t, i18n } = useTranslation();
    const [queries, setQueries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchQueries();
    }, []);

    const fetchQueries = async () => {
        setLoading(true);
        try {
            const response = await api.get('/queries');
            setQueries(response.data.data);
        } catch (err) {
            setError(t('sql.saveDesc') + ': ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('library.deleteConfirm'))) return;
        try {
            await api.delete(`/queries/${id}`);
            setQueries(queries.filter(q => q.id !== id));
        } catch (err) {
            alert('Error al eliminar: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleCopy = (sql) => {
        navigator.clipboard.writeText(sql);
        // You could add a toast here
    };

    const handleExecute = (sql) => {
        navigate('/sql', { state: { sql } });
    };

    const filteredQueries = queries.filter(q =>
        q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.sql.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold" display="flex" alignItems="center" gap={2}>
                <BookmarkIcon fontSize="large" color="primary" /> {t('library.title')}
            </Typography>

            <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder={t('library.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ bgcolor: 'white' }}
                />
                <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={() => navigate('/sql')}
                    sx={{ minWidth: 200, height: 56 }}
                >
                    {t('library.newQuery')}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {filteredQueries.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', bgcolor: '#fafafa' }}>
                    <HistoryIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
                    <Typography variant="h6" color="textSecondary">{t('library.noQueries')}</Typography>
                    <Typography variant="body2" color="textSecondary">
                        {t('library.noQueriesDesc')}
                    </Typography>
                </Paper>
            ) : (
                <Grid container spacing={3}>
                    {filteredQueries.map((query) => (
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} key={query.id}>
                            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Chip
                                            icon={<DbIcon sx={{ fontSize: '1rem !important' }} />}
                                            label={query.dbType.toUpperCase()}
                                            size="small"
                                            color={query.dbType === 'postgres' ? 'secondary' : 'primary'}
                                            variant="outlined"
                                        />
                                        <Typography variant="caption" color="textSecondary">
                                            {new Date(query.updatedAt).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                    <Typography variant="h6" gutterBottom noWrap title={query.name}>
                                        {query.name}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary" sx={{
                                        mb: 2,
                                        height: 40,
                                        overflow: 'hidden',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical'
                                    }}>
                                        {query.description || (i18n.language === 'es' ? 'Sin descripción' : (i18n.language === 'pt' ? 'Sem descrição' : 'No description'))}
                                    </Typography>
                                    <Box sx={{
                                        p: 1.5,
                                        bgcolor: '#f5f5f5',
                                        borderRadius: 1,
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        height: 80,
                                        overflow: 'hidden',
                                        border: '1px border #eee'
                                    }}>
                                        {query.sql}
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ borderTop: '1px solid #eee', px: 2, py: 1, justifyContent: 'space-between' }}>
                                    <Box>
                                        <Tooltip title={i18n.language === 'es' ? 'Copiar SQL' : (i18n.language === 'pt' ? 'Copiar SQL' : 'Copy SQL')}>
                                            <IconButton size="small" onClick={() => handleCopy(query.sql)} color="primary"><CopyIcon /></IconButton>
                                        </Tooltip>
                                        <Tooltip title={i18n.language === 'es' ? 'Eliminar' : (i18n.language === 'pt' ? 'Excluir' : 'Delete')}>
                                            <IconButton size="small" onClick={() => handleDelete(query.id)} color="error"><DeleteIcon /></IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<PlayIcon />}
                                        onClick={() => handleExecute(query.sql)}
                                    >
                                        {t('library.executeBtn')}
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

export default SavedQueries;
