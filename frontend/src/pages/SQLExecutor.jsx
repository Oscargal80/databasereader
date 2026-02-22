import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Typography, TextField, Button, Paper, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow,
    Alert, CircularProgress, Divider, Dialog, DialogTitle,
    DialogContent, DialogActions
} from '@mui/material';
import { PlayArrow as PlayIcon, DeleteSweep as ClearIcon, FileDownload as ExportIcon, AutoAwesome as AiIcon, Bookmark as SaveIcon } from '@mui/icons-material';
import api from '../services/api';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SmartOptimizer from '../components/sql/SmartOptimizer';
import SQLCopilot from '../components/sql/SQLCopilot';

const SQLExecutor = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [sql, setSql] = useState(location.state?.sql || '');
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // AI Assistant State
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiProvider, setAiProvider] = useState('openai');
    const [aiLoading, setAiLoading] = useState(false);

    // Save Query State
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveData, setSaveData] = useState({ name: '', description: '' });
    const [saveLoading, setSaveLoading] = useState(false);

    const handleSaveQuery = async () => {
        if (!saveData.name || !sql.trim()) return;
        setSaveLoading(true);
        try {
            await api.post('/queries', {
                ...saveData,
                sql,
                dbType: user?.dbType || 'firebird'
            });
            setSaveDialogOpen(false);
            setSaveData({ name: '', description: '' });
            alert('Consulta guardada exitosamente');
        } catch (err) {
            setError('Error al guardar: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaveLoading(false);
        }
    };

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

    // Helper to get row value case-insensitively
    const getRowValue = (row, colName) => {
        if (!row) return '';
        if (row[colName] !== undefined && row[colName] !== null) return row[colName];
        const lowerCol = colName.toLowerCase();
        const actualKey = Object.keys(row).find(k => k.toLowerCase() === lowerCol);
        return actualKey ? row[actualKey] : '';
    };

    const renderResults = () => {
        if (!results) return null;
        if (!Array.isArray(results)) return <Alert severity="info" sx={{ mt: 2 }}>{t('sql.execSuccess')}</Alert>;
        if (results.length === 0) return <Alert severity="info" sx={{ mt: 2 }}>{t('sql.noRows')}</Alert>;

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
                                    <TableCell key={col}>{getRowValue(row, col)?.toString()}</TableCell>
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
            <Typography variant="h4" gutterBottom fontWeight="bold">{t('sql.title')}</Typography>

            {/* SQL Copilot AI Section */}
            <SQLCopilot
                onSqlGenerated={(newSql) => setSql(newSql)}
                currentSql={sql}
                results={results}
            />

            <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
                <TextField
                    multiline
                    rows={8}
                    fullWidth
                    variant="outlined"
                    placeholder={t('sql.placeholder')}
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
                        {t('sql.run')}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={() => { setSql(''); setResults(null); setError(''); }}
                    >
                        {t('sql.clear')}
                    </Button>
                    <Button
                        variant="outlined"
                        color="success"
                        startIcon={<ExportIcon />}
                        onClick={handleExport}
                        disabled={!results || !Array.isArray(results) || results.length === 0}
                    >
                        {t('sql.export')}
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={() => setSaveDialogOpen(true)}
                        disabled={!sql.trim()}
                        sx={{ ml: 'auto' }}
                    >
                        {t('sql.saveBtn')}
                    </Button>
                </Box>
            </Paper>

            <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
                <DialogTitle>{t('sql.saveTitle')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('sql.saveName')}
                        fullWidth
                        variant="outlined"
                        value={saveData.name}
                        onChange={(e) => setSaveData({ ...saveData, name: e.target.value })}
                        required
                        sx={{ mb: 2, mt: 1 }}
                    />
                    <TextField
                        margin="dense"
                        label={t('sql.saveDesc')}
                        fullWidth
                        multiline
                        rows={3}
                        variant="outlined"
                        value={saveData.description}
                        onChange={(e) => setSaveData({ ...saveData, description: e.target.value })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSaveDialogOpen(false)}>{t('users.cancelBtn')}</Button>
                    <Button
                        onClick={handleSaveQuery}
                        variant="contained"
                        disabled={saveLoading || !saveData.name}
                    >
                        {saveLoading ? <CircularProgress size={24} /> : t('sql.saveConfirm')}
                    </Button>
                </DialogActions>
            </Dialog>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {renderResults()}

            {(sql && results) && (
                <SmartOptimizer
                    sql={sql}
                    dbType={user?.dbType || 'firebird'}
                />
            )}
        </Box>
    );
};

export default SQLExecutor;
