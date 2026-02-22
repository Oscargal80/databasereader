import React, { useState } from 'react';
import {
    Box, Paper, TextField, Button, Typography, CircularProgress,
    Divider, IconButton, Tooltip, Collapse, Alert
} from '@mui/material';
import {
    AutoAwesome as CopilotIcon,
    PlayArrow as ExecuteIcon,
    AutoGraph as ExplainIcon,
    Code as SqlIcon,
    Chat as ChatIcon,
    ExpandMore,
    ExpandLess
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../../services/api';

const SQLCopilot = ({ onSqlGenerated, currentSql, results }) => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [explainLoading, setExplainLoading] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [provider, setProvider] = useState('gemini');

    const handleChatToSql = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setExplanation('');
        try {
            const response = await api.post('/ai/chat-to-sql', {
                prompt,
                provider
            });
            if (response.data.success) {
                onSqlGenerated(response.data.sql);
                setPrompt('');
            }
        } catch (err) {
            console.error('Copilot SQL generation failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExplainResult = async () => {
        if (!currentSql || !results || results.length === 0) return;
        setExplainLoading(true);
        try {
            const response = await api.post('/ai/explain-result', {
                query: currentSql,
                results: results,
                provider
            });
            if (response.data.success) {
                setExplanation(response.data.explanation);
                setExpanded(true);
            }
        } catch (err) {
            console.error('Explanation failed:', err);
        } finally {
            setExplainLoading(false);
        }
    };

    return (
        <Paper
            elevation={4}
            sx={{
                mb: 3,
                overflow: 'hidden',
                borderRadius: 2,
                borderLeft: '4px solid',
                borderColor: 'primary.main',
                background: theme => theme.palette.mode === 'dark' ? 'rgba(30, 30, 45, 0.8)' : '#f8faff'
            }}
        >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CopilotIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold" color="primary">
                        SQL Copilot AI
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={expanded ? "Minimizar" : "Expandir"}>
                        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Collapse in={expanded}>
                <Divider />
                <Box sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Escribe lo que necesitas en lenguaje natural y la IA generará el SQL por ti basado en el esquema de tu base de datos.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Ej: Mostrame los 10 clientes con más ventas este mes..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleChatToSql()}
                            disabled={loading}
                            sx={{ bgcolor: 'background.paper' }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleChatToSql}
                            disabled={loading || !prompt.trim()}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SqlIcon />}
                            sx={{ minWidth: 140 }}
                        >
                            Generar SQL
                        </Button>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Typography
                            variant="caption"
                            sx={{ cursor: 'pointer', color: provider === 'openai' ? 'primary.main' : 'text.disabled', fontWeight: provider === 'openai' ? 'bold' : 'normal' }}
                            onClick={() => setProvider('openai')}
                        >
                            OpenAI GPT-4
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ cursor: 'pointer', color: provider === 'gemini' ? 'primary.main' : 'text.disabled', fontWeight: provider === 'gemini' ? 'bold' : 'normal' }}
                            onClick={() => setProvider('gemini')}
                        >
                            Google Gemini
                        </Typography>
                    </Box>

                    {results && results.length > 0 && (
                        <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="subtitle2" display="flex" alignItems="center" gap={1}>
                                    <ExplainIcon fontSize="small" color="secondary" /> Explicación de resultados
                                </Typography>
                                <Button
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                    onClick={handleExplainResult}
                                    disabled={explainLoading}
                                    startIcon={explainLoading ? <CircularProgress size={16} /> : <ChatIcon />}
                                >
                                    Explicar con IA
                                </Button>
                            </Box>

                            {explanation && (
                                <Box sx={{
                                    mt: 1,
                                    '& p': { fontSize: '0.9rem', mb: 1 },
                                    '& ul, & ol': { fontSize: '0.9rem', pl: 2, mb: 1 }
                                }}>
                                    <ReactMarkdown>{explanation}</ReactMarkdown>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Paper>
    );
};

export default SQLCopilot;
