import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Typography, TextField, Button, Paper, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow,
    Alert, CircularProgress, Divider
} from '@mui/material';
import { PlayArrow as PlayIcon, DeleteSweep as ClearIcon, FileDownload as ExportIcon, AutoAwesome as AiIcon } from '@mui/icons-material';
import api from '../services/api';

const SQLExecutor = () => {
    const [sql, setSql] = useState('');
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // AI Assistant State
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiProvider, setAiProvider] = useState('openai');
    const [aiLoading, setAiLoading] = useState(false);

    const handleGenerateSql = async () => {
        if (!aiPrompt.trim()) return;
        setAiLoading(true);
        setError('');
        try {
            const response = await api.post('/ai/generate-sql', {
                prompt: aiPrompt,
                provider: aiProvider
            });
            if (response.data.success) {
                setSql(response.data.sql);
                setAiPrompt('');
            }
        } catch (err) {
            setError('AI Generation failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setAiLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!sql.trim()) return;
        setLoading(true);
        setError('');
        setResults(null);

        try {
            const response = await api.post('/sql/execute', { sql });
            if (response.data.success) {
                setResults(response.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!results || !Array.isArray(results) || results.length === 0) return;
        setExportLoading(true);
        try {
            const worksheet = XLSX.utils.json_to_sheet(results);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "QueryResults");
            XLSX.writeFile(workbook, `sql_export_${new Date().getTime()}.xlsx`);
        } catch (error) {
            console.error('Export failed:', error);
            setError('Export failed: ' + error.message);
        } finally {
            setExportLoading(false);
        }
    };

    const renderResults = () => {
        if (!results) return null;
        if (!Array.isArray(results)) return <Alert severity="info" sx={{ mt: 2 }}>Command executed successfully.</Alert>;
        if (results.length === 0) return <Alert severity="info" sx={{ mt: 2 }}>Query successful, but no rows returned.</Alert>;

        const columns = Object.keys(results[0]);

        return (
            <TableContainer component={Paper} elevation={3} sx={{ mt: 3, maxHeight: 500 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {columns.map(col => (
                                <TableCell key={col} sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>{col}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {results.map((row, i) => (
                            <TableRow key={i} hover>
                                {columns.map(col => (
                                    <TableCell key={col}>{row[col]?.toString()}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold">SQL Console</Typography>

            {/* AI Assistant Section */}
            <Paper elevation={3} sx={{ p: 2, mb: 3, bgcolor: '#f0f7ff' }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AiIcon fontSize="small" /> AI SQL Assistant
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        size="small"
                        fullWidth
                        variant="outlined"
                        placeholder="Escribe tu consulta en lenguaje natural (ej: 'Listar actividades de hoy')"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleGenerateSql()}
                    />
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleGenerateSql}
                        disabled={aiLoading || !aiPrompt.trim()}
                        startIcon={aiLoading ? <CircularProgress size={20} color="inherit" /> : <AiIcon />}
                        sx={{ minWidth: 150 }}
                    >
                        {aiLoading ? 'Generando...' : 'IA Generate'}
                    </Button>
                </Box>
                <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                    <Typography variant="caption" color="textSecondary">Procesado por:</Typography>
                    <Typography
                        variant="caption"
                        sx={{ cursor: 'pointer', fontWeight: aiProvider === 'openai' ? 'bold' : 'normal', color: aiProvider === 'openai' ? 'primary.main' : 'text.secondary' }}
                        onClick={() => setAiProvider('openai')}
                    >
                        OpenAI (GPT-4)
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ cursor: 'pointer', fontWeight: aiProvider === 'gemini' ? 'bold' : 'normal', color: aiProvider === 'gemini' ? 'primary.main' : 'text.secondary' }}
                        onClick={() => setAiProvider('gemini')}
                    >
                        Google Gemini
                    </Typography>
                </Box>
            </Paper>

            <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <TextField
                    multiline
                    rows={8}
                    fullWidth
                    variant="outlined"
                    placeholder="SELECT * FROM TABLENAME ..."
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    sx={{
                        fontFamily: 'monospace',
                        '& .MuiInputBase-input': { fontFamily: 'monospace' }
                    }}
                />
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                        onClick={handleExecute}
                        disabled={loading || !sql.trim()}
                    >
                        Execute
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={() => { setSql(''); setResults(null); setError(''); }}
                    >
                        Clear
                    </Button>
                    <Button
                        variant="outlined"
                        color="success"
                        startIcon={<ExportIcon />}
                        onClick={handleExport}
                        disabled={!results || !Array.isArray(results) || results.length === 0}
                    >
                        Export Excel
                    </Button>
                </Box>
            </Paper>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {renderResults()}
        </Box>
    );
};

export default SQLExecutor;
