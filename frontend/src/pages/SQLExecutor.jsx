import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
    Box, Typography, TextField, Button, Paper, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow,
    Alert, CircularProgress, Divider, Dialog, DialogTitle,
    DialogContent, DialogActions, IconButton, TablePagination,
    FormControlLabel, Checkbox
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    DeleteSweep as ClearIcon,
    FileDownload as ExportIcon,
    AutoAwesome as AiIcon,
    Bookmark as SaveIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    FindReplace as ReplaceIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SmartOptimizer from '../components/sql/SmartOptimizer';
import SQLCopilot from '../components/sql/SQLCopilot';
import { analyzeSql } from '../utils/sqlRisk';
import { loadAiSelection } from '../utils/aiSettings';

const SQLExecutor = () => {
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useTranslation();
    const [sql, setSql] = useState(location.state?.sql || '');
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
    const [replaceData, setReplaceData] = useState({ column: '', find: '', replace: '' });
    const [replaceLoading, setReplaceLoading] = useState(false);
    const [fetchAll, setFetchAll] = useState(false);
    const [truncated, setTruncated] = useState(false);
    const [totalRows, setTotalRows] = useState(0);
    const [execInfo, setExecInfo] = useState(null);
    const [fixing, setFixing] = useState(false);
    const [fixMessage, setFixMessage] = useState({ type: '', text: '' });
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);

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
            const response = await api.post('/ai/chat-to-sql', { // Corrected endpoint from previous fix
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

    const handleFixWithAi = async () => {
        setFixing(true);
        setFixMessage({ type: '', text: '' });
        try {
            const { provider, model } = loadAiSelection();
            const response = await api.post('/ai/fix-sql', {
                sql,
                error,
                provider: provider || undefined,
                model: model || undefined
            });
            if (response.data.success) {
                setSql(response.data.sql);
                setError('');
                setFixMessage({ type: 'success', text: response.data.explanation || 'SQL corregido. Revísalo y ejecútalo.' });
            }
        } catch (err) {
            setFixMessage({ type: 'error', text: 'No se pudo corregir con IA: ' + (err.response?.data?.message || err.message) });
        } finally {
            setFixing(false);
        }
    };

    const handleExecute = async () => {
        if (!sql.trim()) return;

        const risk = analyzeSql(sql);
        if (risk.level === 'destructive' &&
            !window.confirm(`Esta consulta puede borrar o alterar datos de forma irreversible:\n- ${risk.reasons.join('\n- ')}\n\n¿Ejecutar de todos modos?`)) {
            return;
        }
        setFixMessage({ type: '', text: '' });
        setLoading(true);
        setError('');
        setResults(null);
        setTruncated(false);
        setExecInfo(null);
        setPage(0);

        try {
            const response = await api.post('/sql/execute', { sql, fetchAll });
            if (response.data.success) {
                setResults(response.data.data);
                setTruncated(response.data.truncated);
                setTotalRows(response.data.totalRows);
                setExecInfo({ command: response.data.command, rowCount: response.data.rowCount });
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

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editRowData, setEditRowData] = useState({});
    const [detectedTable, setDetectedTable] = useState('');

    const detectTable = () => {
        const match = sql.match(/FROM\s+["`\[]?([\w\.]+)/i);
        return match ? match[1].replace(/["`\[\]]/g, '') : '';
    };

    const handleEditRow = (row) => {
        const table = detectTable();
        if (!table) {
            const manualTable = window.prompt('Could not detect table name automatically. Please enter table name:');
            if (!manualTable) return;
            setDetectedTable(manualTable);
        } else {
            setDetectedTable(table);
        }
        setEditRowData(row);
        setEditDialogOpen(true);
    };

    const handleDeleteRow = async (row) => {
        const table = detectTable() || window.prompt('Enter table name for deletion:');
        if (!table) return;

        const pkField = window.prompt('Enter Primary Key column name:', Object.keys(row)[0]);
        if (!pkField) return;

        const pkValue = getRowValue(row, pkField);

        if (window.confirm(`Delete record from ${table} where ${pkField} = ${pkValue}?`)) {
            try {
                await api.delete(`/crud/${encodeURIComponent(table)}?pkField=${encodeURIComponent(pkField)}&pkValue=${encodeURIComponent(pkValue)}`);
                alert('Record deleted');
                handleExecute(); // Refresh results
            } catch (err) {
                alert('Delete failed: ' + (err.response?.data?.message || err.message));
            }
        }
    };

    const handleSaveEdit = async () => {
        const pkField = window.prompt('Confirm Primary Key column name:', Object.keys(editRowData)[0]);
        if (!pkField) return;

        try {
            await api.put(`/crud/${encodeURIComponent(detectedTable)}`, {
                ...editRowData,
                pkField,
                pkValue: editRowData[pkField]
            });
            setEditDialogOpen(false);
            alert('Record updated successfully');
            handleExecute();
        } catch (err) {
            alert('Update failed: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleBulkReplace = async () => {
        const table = detectTable();
        if (!table) {
            alert('Could not detect table name for bulk update.');
            return;
        }
        if (!replaceData.column || replaceData.find === '') return;

        setReplaceLoading(true);
        try {
            const url = `/crud/${encodeURIComponent(table)}/bulk-replace`;
            const preview = await api.post(url, { ...replaceData, dryRun: true });
            const affected = preview.data.affected;

            if (affected === 0) {
                setReplaceDialogOpen(false);
                alert('No row contains that text.');
                return;
            }
            if (!window.confirm(`${affected} row(s) of "${table}" will be modified in column "${replaceData.column}". Continue?`)) {
                return;
            }

            await api.post(url, replaceData);
            setReplaceDialogOpen(false);
            alert('Bulk update completed successfully');
            handleExecute();
        } catch (err) {
            alert('Bulk update failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setReplaceLoading(false);
        }
    };

    const renderResults = () => {
        if (!results) return null;
        if (!Array.isArray(results)) return <Alert severity="info" sx={{ mt: 2 }}>{t('sql.execSuccess')}</Alert>;
        if (results.length === 0) {
            if (execInfo?.command && execInfo.command !== 'SELECT') {
                const affected = execInfo.rowCount != null ? ` · ${execInfo.rowCount} fila(s) afectada(s)` : '';
                return <Alert severity="success" sx={{ mt: 2 }}>{`${execInfo.command}${affected}`}</Alert>;
            }
            return <Alert severity="info" sx={{ mt: 2 }}>{t('sql.noRows')}</Alert>;
        }

        const columns = Object.keys(results[0]);
        const displayedRows = results.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

        return (
            <Box sx={{ mt: 3 }}>
                {truncated && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Resultados limitados a {results.length} registros para mejorar el rendimiento. {totalRows > results.length ? `(Total en DB: ~${totalRows})` : ''}
                        Habilita "Traer todo" para descargar el set completo.
                    </Alert>
                )}

                <TableContainer component={Paper} elevation={3} sx={{ maxHeight: 600 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {columns.map(col => (
                                    <TableCell key={col} sx={{ fontWeight: 'bold', bgcolor: 'background.default', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>{col}</TableCell>
                                ))}
                                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.default', borderBottom: '2px solid rgba(0,0,0,0.1)' }}>{t('crud.actions', 'Actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayedRows.map((row, i) => (
                                <TableRow key={i} hover>
                                    {columns.map(col => (
                                        <TableCell key={col} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                                            {getRowValue(row, col)?.toString()}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <IconButton size="small" color="primary" onClick={() => handleEditRow(row)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteRow(row)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    component="div"
                    count={results.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(e, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                    }}
                    labelRowsPerPage="Filas por página"
                />
            </Box>
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
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, '& .MuiButton-root': { whiteSpace: 'nowrap', flexShrink: 0 } }}>
                    <Button
                        variant="contained"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                        onClick={handleExecute}
                        disabled={loading || !sql.trim()}
                    >
                        {t('sql.run')}
                    </Button>

                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, px: 2, borderRadius: 1, border: '1px solid rgba(0,0,0,0.1)', bgcolor: 'background.default' }}>
                        <FormControlLabel
                            control={<Checkbox size="small" checked={fetchAll} onChange={(e) => setFetchAll(e.target.checked)} />}
                            label={<Typography variant="caption" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Traer todo (Lento si es grande)</Typography>}
                            sx={{ m: 0 }}
                        />
                    </Box>

                    <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={() => { setSql(''); setResults(null); setError(''); setTruncated(false); }}
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
                        color="secondary"
                        startIcon={<ReplaceIcon />}
                        onClick={() => {
                            const table = detectTable();
                            if (table) {
                                setReplaceDialogOpen(true);
                                setReplaceData(prev => ({ ...prev, column: Object.keys(results[0] || {})[0] || '' }));
                            } else {
                                alert('Please select a table in your query first.');
                            }
                        }}
                        disabled={!results || !Array.isArray(results) || results.length === 0}
                    >
                        Find & Replace
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

            {error && (
                <Alert
                    severity="error"
                    sx={{ mt: 2 }}
                    action={sql.trim() && (
                        <Button
                            color="inherit"
                            size="small"
                            onClick={handleFixWithAi}
                            disabled={fixing}
                            startIcon={fixing ? <CircularProgress size={14} color="inherit" /> : <AiIcon fontSize="small" />}
                        >
                            Corregir con IA
                        </Button>
                    )}
                >
                    {error}
                </Alert>
            )}
            {fixMessage.text && <Alert severity={fixMessage.type} sx={{ mt: 2 }} onClose={() => setFixMessage({ type: '', text: '' })}>{fixMessage.text}</Alert>}
            {renderResults()}

            {(sql && results) && (
                <SmartOptimizer
                    sql={sql}
                    dbType={user?.dbType || 'firebird'}
                />
            )}

            {/* Inline Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Edit Record in {detectedTable}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        {editRowData && Object.keys(editRowData).map((col) => (
                            <TextField
                                key={col}
                                margin="dense"
                                label={col}
                                fullWidth
                                variant="outlined"
                                value={editRowData[col] || ''}
                                onChange={(e) => setEditRowData({ ...editRowData, [col]: e.target.value })}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveEdit} variant="contained">Save Changes</Button>
                </DialogActions>
            </Dialog>

            {/* Bulk Find & Replace Dialog */}
            <Dialog open={replaceDialogOpen} onClose={() => setReplaceDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Find & Replace in Results</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            select
                            label="Column"
                            fullWidth
                            variant="outlined"
                            value={replaceData.column}
                            onChange={(e) => setReplaceData({ ...replaceData, column: e.target.value })}
                            SelectProps={{ native: true }}
                        >
                            {results && Array.isArray(results) && results.length > 0 && Object.keys(results[0]).map(col => (
                                <option key={col} value={col}>{col}</option>
                            ))}
                        </TextField>
                        <TextField
                            label="Find Text"
                            fullWidth
                            value={replaceData.find}
                            onChange={(e) => setReplaceData({ ...replaceData, find: e.target.value })}
                        />
                        <TextField
                            label="Replace With"
                            fullWidth
                            value={replaceData.replace}
                            onChange={(e) => setReplaceData({ ...replaceData, replace: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReplaceDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleBulkReplace}
                        variant="contained"
                        color="secondary"
                        disabled={replaceLoading || !replaceData.column}
                    >
                        {replaceLoading ? <CircularProgress size={24} /> : 'Apply to Table'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SQLExecutor;
