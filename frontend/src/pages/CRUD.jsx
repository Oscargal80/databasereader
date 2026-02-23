import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    Paper, Typography, Button, Box, IconButton,
    CircularProgress, Alert, Tabs, Tab, Chip, Snackbar,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel
} from '@mui/material';
import {
    Add as AddIcon, Refresh as RefreshIcon, ArrowBack as BackIcon,
    Storage as DataIcon, ListAlt as StructureIcon,
    Key as IndexIcon, Link as FkIcon, Hub as DepIcon,
    Code as SqlIcon, FileDownload as ExportIcon,
    FindReplace as ReplaceIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

import CrudTable from '../components/crud/CrudTable';
import CrudMetadata from '../components/crud/CrudMetadata';
import CrudDialog from '../components/crud/CrudDialog';
import CrudContextMenu from '../components/crud/CrudContextMenu';

const CRUD = () => {
    const { tableName } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const queryParams = new URLSearchParams(window.location.search);
    const entityType = queryParams.get('type') || 'Tables';
    const isReadOnly = ['Views', 'Materialized Views', 'Reports', 'Procedures', 'Triggers', 'Generators', 'System Tables'].includes(entityType);
    const hasSource = ['Procedures', 'Triggers', 'Views'].includes(entityType);

    const [data, setData] = useState([]);
    const [structure, setStructure] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [total, setTotal] = useState(0);
    const [openDialog, setOpenDialog] = useState(false);
    const [formData, setFormData] = useState({});
    const [exportLoading, setExportLoading] = useState(false);
    const [currentTab, setCurrentTab] = useState(0);
    const [metadata, setMetadata] = useState({ indexes: [], foreignKeys: [], dependencies: [] });
    const [metadataLoading, setMetadataLoading] = useState(false);
    const [error, setError] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedRow, setSelectedRow] = useState(null);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
    const [replaceData, setReplaceData] = useState({ column: '', find: '', replace: '' });
    const [replaceLoading, setReplaceLoading] = useState(false);

    useEffect(() => {
        fetchData();
        fetchStructure();
        if (entityType === 'Tables') {
            fetchMetadata();
        }
    }, [tableName, page, rowsPerPage]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const limit = showAll ? -1 : rowsPerPage;
            const response = await api.get(`/crud/${tableName}?page=${page + 1}&limit=${limit}`);
            setData(response.data.data);
            setTotal(response.data.pagination.total);
        } catch (error) {
            setError(`Error fetching ${entityType}: ` + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStructure = async () => {
        try {
            const response = await api.get(`/db/structure/${tableName}?type=${entityType}`);
            setStructure(response.data.data);
        } catch (error) {
            console.error('Error fetching structure:', error);
        }
    };

    const fetchMetadata = async (forceRefresh = false) => {
        setMetadataLoading(true);
        try {
            const url = forceRefresh ? `/db/metadata/${tableName}?refresh=true` : `/db/metadata/${tableName}`;
            const response = await api.get(url);
            setMetadata(response.data.data);
        } catch (error) {
            console.error('Error fetching metadata:', error);
        } finally {
            setMetadataLoading(false);
        }
    };

    const handleExport = () => {
        setExportLoading(true);
        try {
            const exportUrl = `${api.defaults.baseURL}/crud/${tableName}/export`;
            const a = document.createElement('a');
            // We use the full API URL. In environments using session cookies, 
            // navigating top-level will attach the cookies.
            a.href = exportUrl;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setSnackbarMessage(t('crud.exportStarted', 'Export started successfully.'));
        } catch (error) {
            console.error('Export failed:', error);
            setError('Export request failed.');
        } finally {
            setExportLoading(false);
        }
    };

    const handleChangePage = (event, newPage) => setPage(newPage);
    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const getRowValue = (row, colName) => {
        if (!row) return '';
        if (row[colName] !== undefined && row[colName] !== null) return row[colName];

        const lowerCol = colName.toLowerCase();
        const actualKey = Object.keys(row).find(k => k.toLowerCase() === lowerCol);
        return actualKey ? row[actualKey] : '';
    };

    const handleDelete = async (row) => {
        if (isReadOnly) return;
        const pkField = structure.find(f => f.isPk)?.name || structure[0]?.name;
        if (!pkField) return;

        const pkValue = getRowValue(row, pkField);

        if (window.confirm(`Are you sure you want to delete this record (${pkField}: ${pkValue})?`)) {
            try {
                await api.delete(`/crud/${tableName}?pkField=${pkField}&pkValue=${pkValue}`);
                fetchData();
            } catch (error) {
                alert('Delete failed: ' + error.message);
            }
        }
    };

    const handleSave = async () => {
        try {
            const pkField = structure.find(f => f.isPk)?.name || structure[0]?.name;
            const isEdit = !!formData[pkField] && data.some(row => getRowValue(row, pkField) === formData[pkField]);

            if (isEdit) {
                // UPDATE logic
                const pkValue = formData[pkField];
                await api.put(`/crud/${tableName}`, {
                    ...formData,
                    pkField,
                    pkValue
                });
                setSnackbarMessage('Record updated successfully');
            } else {
                // INSERT logic
                await api.post(`/crud/${tableName}`, formData);
                setSnackbarMessage('Record added successfully');
            }

            setOpenDialog(false);
            setFormData({});
            fetchData();
        } catch (error) {
            setError('Operation failed: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleBulkReplace = async () => {
        if (!replaceData.column || replaceData.find === '') return;
        setReplaceLoading(true);
        try {
            await api.post(`/crud/${tableName}/bulk-replace`, replaceData);
            setReplaceDialogOpen(false);
            setSnackbarMessage('Bulk replacement completed successfully');
            fetchData();
        } catch (error) {
            setError('Bulk replacement failed: ' + (error.response?.data?.message || error.message));
        } finally {
            setReplaceLoading(false);
        }
    };

    const handleMenuOpen = (event, row, action) => {
        if (action === 'edit') {
            setFormData(row);
            setOpenDialog(true);
            return;
        }
        setAnchorEl(event.currentTarget);
        setSelectedRow(row);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedRow(null);
    };

    const copyToClipboard = async (text, successMsg) => {
        try {
            await navigator.clipboard.writeText(text);
            setSnackbarMessage(successMsg);
        } catch (err) {
            setError('Failed to copy to clipboard');
        }
        handleMenuClose();
    };

    const formatSqlValue = (val) => {
        if (val === null || val === undefined || val === '') return 'NULL';
        if (typeof val === 'number') return val;
        return `'${String(val).replace(/'/g, "''")}'`;
    };

    const handleCopyAsInsert = () => {
        if (!selectedRow) return;
        const keys = Object.keys(selectedRow);
        const values = keys.map(k => formatSqlValue(selectedRow[k]));
        const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});`;
        copyToClipboard(sql, 'INSERT statement copied to clipboard!');
    };

    const handleCopyAsUpdate = () => {
        if (!selectedRow) return;
        const keys = Object.keys(selectedRow);
        const pkCol = structure.find(c => c.isPk)?.name || keys[0];
        const pkVal = formatSqlValue(selectedRow[pkCol]);
        const setClauses = keys
            .filter(k => k !== pkCol)
            .map(k => `${k} = ${formatSqlValue(selectedRow[k])}`);

        const sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${pkCol} = ${pkVal};`;
        copyToClipboard(sql, 'UPDATE statement copied to clipboard!');
    };

    const handleCopyWithHeaders = () => {
        if (!selectedRow) return;
        const keys = Object.keys(selectedRow);
        const values = keys.map(k => {
            let val = selectedRow[k];
            if (val === null || val === undefined) return '';
            return String(val).replace(/\t|\n|\r/g, ' ');
        });

        const tsv = `${keys.join('\t')}\n${values.join('\t')}`;
        copyToClipboard(tsv, 'Data copied with headers (TSV)!');
    };

    if (loading && data.length === 0) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}><BackIcon /></IconButton>
                <Typography variant="h4" fontWeight="bold">
                    {entityType.replace('s', '')}: {tableName}
                    {isReadOnly && <Chip label="Read-Only" size="small" color="warning" sx={{ ml: 2, verticalAlign: 'middle' }} />}
                </Typography>
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {currentTab === 0 && (
                        <FormControlLabel
                            control={<Switch checked={showAll} onChange={(e) => setShowAll(e.target.checked)} color="primary" />}
                            label="Fetch All"
                            sx={{ mr: 1 }}
                        />
                    )}
                    {currentTab === 0 && !isReadOnly && (
                        <Button variant="outlined" startIcon={<ReplaceIcon />} onClick={() => setReplaceDialogOpen(true)} color="secondary">
                            Find & Replace
                        </Button>
                    )}
                    <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} disabled={data.length === 0}>{t('crud.exportExcel')}</Button>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { fetchData(); fetchStructure(); if (!isReadOnly) fetchMetadata(true); }}>{t('crud.refresh')}</Button>
                    {!isReadOnly && currentTab === 0 && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>{t('crud.addRecord')}</Button>}
                </Box>
            </Box>

            <Tabs
                value={currentTab}
                onChange={(e, v) => setCurrentTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab icon={<DataIcon />} label={t('crud.tabData')} iconPosition="start" />
                <Tab icon={<StructureIcon />} label={t('crud.tabStructure')} iconPosition="start" />
                <Tab icon={<IndexIcon />} label={t('crud.tabIndexes')} iconPosition="start" />
                <Tab icon={<FkIcon />} label={t('crud.tabFk')} iconPosition="start" disabled={!['Tables', 'System Tables'].includes(entityType)} />
                <Tab icon={<DepIcon />} label={t('crud.tabDep')} iconPosition="start" />
                <Tab icon={<SqlIcon />} label={t('crud.tabSql')} iconPosition="start" />
                {hasSource && <Tab icon={<SqlIcon />} label={t('crud.tabSource')} iconPosition="start" />}
            </Tabs>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {currentTab === 0 && (
                <CrudTable
                    data={data}
                    structure={structure}
                    isReadOnly={isReadOnly}
                    total={total}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    handleChangePage={handleChangePage}
                    handleChangeRowsPerPage={handleChangeRowsPerPage}
                    getRowValue={getRowValue}
                    handleMenuOpen={handleMenuOpen}
                    handleDelete={handleDelete}
                    t={t}
                />
            )}

            <CrudMetadata
                currentTab={currentTab}
                structure={structure}
                metadata={metadata}
                hasSource={hasSource}
                entityType={entityType}
                isReadOnly={isReadOnly}
                tableName={tableName}
                data={data}
            />

            <CrudDialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                tableName={tableName}
                structure={structure}
                formData={formData}
                setFormData={setFormData}
                handleSave={handleSave}
            />

            <CrudContextMenu
                anchorEl={anchorEl}
                onClose={handleMenuClose}
                onCopyAsInsert={handleCopyAsInsert}
                onCopyAsUpdate={handleCopyAsUpdate}
                onCopyWithHeaders={handleCopyWithHeaders}
            />

            <Snackbar
                open={!!snackbarMessage}
                autoHideDuration={3000}
                onClose={() => setSnackbarMessage('')}
                message={snackbarMessage}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />

            {/* Bulk Find & Replace Dialog */}
            <Dialog open={replaceDialogOpen} onClose={() => setReplaceDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>Find & Replace in {tableName}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Massively update values in a specific column across the whole table.
                        </Typography>
                        <FormControl fullWidth>
                            <InputLabel>Column</InputLabel>
                            <Select
                                value={replaceData.column}
                                label="Column"
                                onChange={(e) => setReplaceData({ ...replaceData, column: e.target.value })}
                            >
                                {structure.map(col => (
                                    <MenuItem key={col.name} value={col.name}>{col.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
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
                        {replaceLoading ? <CircularProgress size={24} /> : 'Apply Massively'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CRUD;
