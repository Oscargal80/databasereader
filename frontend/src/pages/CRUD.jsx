import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    Paper, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TablePagination, Button, Box, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, Alert, Tooltip, Tabs, Tab, Chip, Divider
} from '@mui/material';
import {
    Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
    Refresh as RefreshIcon, ArrowBack as BackIcon,
    Storage as DataIcon, ListAlt as StructureIcon,
    Key as IndexIcon, Link as FkIcon, Hub as DepIcon,
    Code as SqlIcon, FileDownload as ExportIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const CRUD = () => {
    const { tableName } = useParams();
    const navigate = useNavigate();
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

    const fetchMetadata = async () => {
        setMetadataLoading(true);
        try {
            const response = await api.get(`/db/metadata/${tableName}`);
            setMetadata(response.data.data);
        } catch (error) {
            console.error('Error fetching metadata:', error);
        } finally {
            setMetadataLoading(false);
        }
    };

    const generateSQL = () => {
        if (isReadOnly) return `-- Source DDL not available for ${entityType} via this viewer.`;
        let sql = `CREATE TABLE ${tableName} (\n`;
        const colDefinitions = structure.map(col => {
            let def = `    ${col.name.padEnd(20)} ${col.type}`;
            if (col.length && !['INTEGER', 'BIGINT', 'SMALLINT', 'TIMESTAMP', 'DATE', 'TIME', 'BLOB', 'DOUBLE PRECISION'].includes(col.type)) {
                def += `(${col.length})`;
            }
            if (!col.nullable) def += ' NOT NULL';
            return def;
        });

        sql += colDefinitions.join(',\n');

        const pks = structure.filter(c => c.isPk).map(c => c.name);
        if (pks.length > 0) {
            sql += `,\n    CONSTRAINT PK_${tableName} PRIMARY KEY (${pks.join(', ')})`;
        }

        sql += '\n);';
        return sql;
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

    const handleDelete = async (row) => {
        if (isReadOnly) return;
        const pkField = structure.find(f => f.isPk)?.name || structure[0]?.name;
        if (!pkField) return;

        if (window.confirm(`Are you sure you want to delete this record (${pkField}: ${row[pkField]})?`)) {
            try {
                await api.delete(`/crud/${tableName}?pkField=${pkField}&pkValue=${row[pkField]}`);
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
                    <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport} sx={{ mr: 1 }} disabled={data.length === 0}>Export Excel</Button>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { fetchData(); fetchStructure(); if (!isReadOnly) fetchMetadata(); }} sx={{ mr: 1 }}>Refresh</Button>
                    {!isReadOnly && currentTab === 0 && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>Add Record</Button>}
                </Box>
            </Box>

            <Tabs
                value={currentTab}
                onChange={(e, v) => setCurrentTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab icon={<DataIcon />} label="Data" iconPosition="start" />
                <Tab icon={<StructureIcon />} label="Structure" iconPosition="start" />
                <Tab icon={<IndexIcon />} label="Indexes" iconPosition="start" />
                <Tab icon={<FkIcon />} label="Foreign Keys" iconPosition="start" disabled={!['Tables', 'System Tables'].includes(entityType)} />
                <Tab icon={<DepIcon />} label="Dependencies" iconPosition="start" />
                <Tab icon={<SqlIcon />} label="SQL DDL" iconPosition="start" />
                {hasSource && <Tab icon={<SqlIcon />} label="Source Code" iconPosition="start" />}
            </Tabs>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {currentTab === 0 && (
                <TableContainer component={Paper} elevation={3}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {structure.map((col) => (
                                    <TableCell key={col.name} sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                                        {col.name} {col.isPk && ' (PK)'}
                                    </TableCell>
                                ))}
                                {!isReadOnly && <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>Actions</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((row, index) => (
                                <TableRow key={index} hover>
                                    {structure.map((col) => (
                                        <TableCell key={col.name}>{row[col.name]?.toString()}</TableCell>
                                    ))}
                                    {!isReadOnly && (
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        rowsPerPageOptions={[10, 25, 50]}
                        component="div"
                        count={total}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </TableContainer>
            )}

            {currentTab === 1 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell fontWeight="bold">Field Name</TableCell>
                                <TableCell fontWeight="bold">Type</TableCell>
                                <TableCell fontWeight="bold">Length</TableCell>
                                <TableCell fontWeight="bold">Nullable</TableCell>
                                <TableCell fontWeight="bold">Constraints</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {structure.map((col) => (
                                <TableRow key={col.name} hover>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{col.name}</TableCell>
                                    <TableCell>{col.type}</TableCell>
                                    <TableCell>{col.length}</TableCell>
                                    <TableCell>{col.nullable ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>
                                        {col.isPk && <Chip label="PK" color="primary" size="small" sx={{ mr: 0.5 }} />}
                                        {col.isFk && <Chip label="FK" color="secondary" size="small" />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 2 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell fontWeight="bold">Index Name</TableCell>
                                <TableCell fontWeight="bold">Column</TableCell>
                                <TableCell fontWeight="bold">Unique</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {metadata.indexes?.map((idx, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>{idx.INDEX_NAME}</TableCell>
                                    <TableCell>{idx.FIELD_NAME}</TableCell>
                                    <TableCell>{idx.IS_UNIQUE === 1 ? 'Yes' : 'No'}</TableCell>
                                </TableRow>
                            ))}
                            {(!metadata.indexes || metadata.indexes.length === 0) && (
                                <TableRow><TableCell colSpan={3} align="center">No indexes found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 3 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell fontWeight="bold">Constraint Name</TableCell>
                                <TableCell fontWeight="bold">Column</TableCell>
                                <TableCell fontWeight="bold">Ref Table</TableCell>
                                <TableCell fontWeight="bold">Ref Column</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {metadata.foreignKeys?.map((fk, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>{fk.CONSTRAINT_NAME}</TableCell>
                                    <TableCell>{fk.FIELD_NAME}</TableCell>
                                    <TableCell>{fk.REF_TABLE}</TableCell>
                                    <TableCell>{fk.REF_FIELD}</TableCell>
                                </TableRow>
                            ))}
                            {(!metadata.foreignKeys || metadata.foreignKeys.length === 0) && (
                                <TableRow><TableCell colSpan={4} align="center">No foreign keys found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 4 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell fontWeight="bold">Depends On Name</TableCell>
                                <TableCell fontWeight="bold">Type</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {metadata.dependencies?.map((dep, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>{dep.DEP_NAME}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={dep.DEP_TYPE === 0 ? 'Table' : dep.DEP_TYPE === 5 ? 'Procedure' : `Type ${dep.DEP_TYPE}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!metadata.dependencies || metadata.dependencies.length === 0) && (
                                <TableRow><TableCell colSpan={2} align="center">No dependencies found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 5 && (
                <Paper elevation={3} sx={{ p: 3, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>
                    <Typography variant="h6" color="primary" gutterBottom sx={{ fontFamily: 'monospace' }}>
                        -- Generated SQL (Approximate)
                    </Typography>
                    <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                        {generateSQL()}
                    </Box>
                </Paper>
            )}

            {currentTab === 6 && hasSource && (
                <Paper elevation={3} sx={{ p: 3, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>
                    <Typography variant="h6" color="primary" gutterBottom sx={{ fontFamily: 'monospace' }}>
                        -- {entityType} Source Code
                    </Typography>
                    <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                        {/* We need an endpoint to fetch source code for procedures/triggers/views */}
                        {data[0]?.SOURCE || data[0]?.source || data[0]?.DEFINITION || data[0]?.definition || '-- Source code loading soon...'}
                    </Box>
                </Paper>
            )}

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add New Record to {tableName}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        {structure.map((col) => (
                            <TextField
                                key={col.name}
                                margin="dense"
                                label={col.name + (col.nullable ? '' : ' *')}
                                fullWidth
                                variant="outlined"
                                value={formData[col.name] || ''}
                                onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                                required={!col.nullable}
                                type={col.type === 7 || col.type === 8 ? 'number' : 'text'}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained">Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CRUD;
