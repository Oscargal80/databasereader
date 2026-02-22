import React, { useState } from 'react';
import {
    Box, Paper, Typography, Button, CircularProgress,
    Divider, List, ListItem, ListItemIcon, ListItemText,
    Card, CardContent, Chip, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import {
    AutoAwesome as AiIcon,
    ExpandMore as ExpandMoreIcon,
    Speed as PlanIcon,
    Assignment as SuggestionIcon,
    ErrorOutline as WarningIcon,
    CheckCircleOutline as SuccessIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../../services/api';

const SmartOptimizer = ({ sql, dbType, onOptimized }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!sql) return;
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/ai/analyze-query', {
                sql,
                dbType,
                provider: 'openai' // Default for optimizer
            });
            if (response.data.success) {
                setResult(response.data);
            } else {
                setError(response.data.message || 'Error al analizar la consulta');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ mt: 3 }}>
            <Paper elevation={4} sx={{
                p: 3,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                    <AiIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold" color="primary">
                        Optimización Inteligente
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={handleAnalyze}
                        disabled={loading || !sql}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlanIcon />}
                        sx={{ ml: 'auto', borderRadius: 20 }}
                    >
                        {loading ? 'Analizando...' : 'Analizar Performance'}
                    </Button>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {error && (
                    <Card sx={{ bgcolor: '#fff5f5', border: '1px solid #feb2b2', mb: 2 }}>
                        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: '12px !important' }}>
                            <WarningIcon color="error" />
                            <Typography color="error.main" variant="body2">{error}</Typography>
                        </CardContent>
                    </Card>
                )}

                {!result && !loading && (
                    <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 3 }}>
                        Haz clic en "Analizar Performance" para que la IA estudie tu consulta y el plan de ejecución de la base de datos.
                    </Typography>
                )}

                {result && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SuggestionIcon fontSize="small" color="secondary" />
                            Recomendaciones de la IA:
                        </Typography>

                        <Box sx={{
                            p: 2,
                            borderRadius: 1,
                            bgcolor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            mb: 2,
                            '& p': { mb: 1 },
                            '& ul, & ol': { pl: 2, mb: 1 },
                            '& code': { bgcolor: '#edf2f7', p: '2px 4px', borderRadius: 1, fontFamily: 'monospace' }
                        }}>
                            <ReactMarkdown>{result.analysis}</ReactMarkdown>
                        </Box>

                        <Accordion elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PlanIcon fontSize="inherit" /> Ver Plan de Ejecución (EXPLAIN)
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ bgcolor: '#1a202c', color: '#cbd5e0', p: 1 }}>
                                <pre style={{
                                    margin: 0,
                                    fontSize: '11px',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                }}>
                                    {JSON.stringify(result.plan, null, 2)}
                                </pre>
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default SmartOptimizer;
