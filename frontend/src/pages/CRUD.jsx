import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    Paper, Typography, Button, Box, IconButton,
    CircularProgress, Alert, Tabs, Tab, Chip, Snackbar
} from '@mui/material';
import {
    Add as AddIcon, Refresh as RefreshIcon, ArrowBack as BackIcon,
    Storage as DataIcon, ListAlt as StructureIcon,
    Key as IndexIcon, Link as FkIcon, Hub as DepIcon,
    Code as SqlIcon, FileDownload as ExportIcon
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
            const response = await api.get(`/crud/${tableName}?page=${page + 1}&limit=${rowsPerPage}`);
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
        if (data.length === 0) return;
        setExportLoading(true);
        try {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            XLSX.writeFile(workbook, `${tableName}_export.xlsx`);
        } catch (error) {
            console.error('Export failed:', error);
            setError('Export failed: ' + error.message);
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
            await api.post(`/crud/${tableName}`, formData);
            setOpenDialog(false);
            setFormData({});
            fetchData();
        } catch (error) {
            setError('Save failed: ' + error.message);
        }
    };

    const handleMenuOpen = (event, row) => {
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
                <Box sx={{ ml: 'auto' }}>
                    <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} sx={{ mr: 1 }} disabled={data.length === 0}>{t('crud.exportExcel')}</Button>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { fetchData(); fetchStructure(); if (!isReadOnly) fetchMetadata(true); }} sx={{ mr: 1 }}>{t('crud.refresh')}</Button>
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
        </Box>
    );
};

export default CRUD;
