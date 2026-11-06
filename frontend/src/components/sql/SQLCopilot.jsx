import React, { useState, useEffect } from 'react';
import {
    Box, Paper, TextField, Button, Typography, CircularProgress,
    Divider, IconButton, Tooltip, Collapse, Alert, Select, MenuItem, FormControl, InputLabel, Chip
} from '@mui/material';
import {
    AutoAwesome as CopilotIcon,
    PlayArrow as ExecuteIcon,
    AutoGraph as ExplainIcon,
    Code as SqlIcon,
    Chat as ChatIcon,
    ExpandMore,
    ExpandLess,
    Replay as ResetIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import api from '../../services/api';
import { loadAiSelection, saveAiSelection } from '../../utils/aiSettings';
import { analyzeSql } from '../../utils/sqlRisk';

const SQLCopilot = ({ onSqlGenerated, currentSql, results }) => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [explanation, setExplanation] = useState('');
    const [explainLoading, setExplainLoading] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [providers, setProviders] = useState([]);
    const [provider, setProvider] = useState(loadAiSelection().provider);
    const [model, setModel] = useState(loadAiSelection().model);
    const [history, setHistory] = useState([]);
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        api.get('/ai/providers')
            .then(response => {
                const data = response.data;
                setProviders(data.providers);
                setProvider(current => (data.providers.some(p => p.id === current && p.configured) ? current : (data.defaultProvider || '')));
                setModel(current => current || data.defaultAnthropicModel || '');
            })
            .catch(() => setProviders([]));
    }, []);

    useEffect(() => {
        saveAiSelection({ provider, model });
    }, [provider, model]);

    const selectedProvider = providers.find(p => p.id === provider);

    const handleProviderChange = (event) => {
        const next = providers.find(p => p.id === event.target.value);
        setProvider(next.id);
        setModel(next.models[0].id);
    };

    const startNewConversation = () => {
        setHistory([]);
        setLastResult(null);
    };
    const [error, setError] = useState(null);

    const handleChatToSql = async () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setExplanation('');
        try {
            setError(null);
            const response = await api.post('/ai/chat-to-sql', {
                prompt,
                provider,
                model: model || undefined,
                currentSql: currentSql || undefined,
                history
            });
            if (response.data.success) {
                const { sql, explanation, warnings } = response.data;
                onSqlGenerated(sql);
                setLastResult({ sql, explanation, warnings, provider: response.data.provider, model: response.data.model });
                setHistory(previous => [...previous, { role: 'user', content: prompt }, { role: 'assistant', content: sql }].slice(-12));
                setPrompt('');
            } else {
                setError(response.data.message || 'Error desconocido al generar SQL');
            }
        } catch (err) {
            console.error('Copilot SQL generation failed:', err);
            setError(err.response?.data?.message || 'Error de conexión con el servicio de IA');
        } finally {
            setLoading(false);
        }
    };

    const handleExplainResult = async () => {
        if (!currentSql || !Array.isArray(results) || results.length === 0) return;
        setExplainLoading(true);
        try {
            setError(null);
            const response = await api.post('/ai/explain-result', {
                query: currentSql,
                results: results.slice(0, 10),
                totalRows: results.length,
                provider,
                model: model || undefined
            });
            if (response.data.success) {
                setExplanation(response.data.explanation);
                setExpanded(true);
            }
        } catch (err) {
            console.error('Explanation failed:', err);
            setError(err.response?.data?.message || 'No se pudo obtener la explicación');
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
                        El esquema (nombres de tablas y columnas) se envía al proveedor de IA elegido; con «Explicar con IA» también se envían hasta 10 filas del resultado.
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

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
                            disabled={loading || !prompt.trim() || !provider}
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SqlIcon />}
                            sx={{ minWidth: 140 }}
                        >
                            Generar SQL
                        </Button>
                    </Box>

                    {providers.length > 0 && !providers.some(p => p.configured) && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            No hay ninguna API Key de IA cargada. Agrégala en Configuración (Anthropic, OpenAI o Gemini).
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 190 }}>
                            <InputLabel>Proveedor de IA</InputLabel>
                            <Select label="Proveedor de IA" value={selectedProvider ? provider : ''} onChange={handleProviderChange}>
                                {providers.map(p => (
                                    <MenuItem key={p.id} value={p.id} disabled={!p.configured}>
                                        {p.label}{!p.configured ? ' (sin clave)' : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedProvider && selectedProvider.models.length > 1 && (
                            <FormControl size="small" sx={{ minWidth: 260 }}>
                                <InputLabel>Modelo</InputLabel>
                                <Select label="Modelo" value={model} onChange={(e) => setModel(e.target.value)}>
                                    {selectedProvider.models.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        )}

                        {history.length > 0 && (
                            <Button size="small" startIcon={<ResetIcon />} onClick={startNewConversation}>
                                Nueva conversación
                            </Button>
                        )}
                    </Box>

                    {history.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            Conversación activa: tus próximos pedidos refinan el SQL del editor.
                        </Typography>
                    )}

                    {lastResult && (() => {
                        const risk = analyzeSql(lastResult.sql);
                        return (
                            <Box sx={{ mb: 2 }}>
                                {lastResult.explanation && (
                                    <Typography variant="body2" sx={{ mb: 1 }}>{lastResult.explanation}</Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {risk.level === 'read' && <Chip size="small" color="success" label="Solo lectura" />}
                                    {risk.level === 'write' && <Chip size="small" color="warning" label="Modifica datos" />}
                                    {risk.level === 'destructive' && <Chip size="small" color="error" label="Puede borrar datos" />}
                                    <Typography variant="caption" color="text.secondary">
                                        {lastResult.model || lastResult.provider}
                                    </Typography>
                                </Box>
                                {risk.reasons.map(reason => (
                                    <Alert key={reason} severity="error" sx={{ mt: 1 }}>{reason}</Alert>
                                ))}
                                {lastResult.warnings.map(warning => (
                                    <Alert key={warning} severity="warning" sx={{ mt: 1 }}>{warning}</Alert>
                                ))}
                            </Box>
                        );
                    })()}

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
