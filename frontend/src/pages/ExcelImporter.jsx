import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Select, MenuItem, FormControl,
    InputLabel, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Alert, CircularProgress, Grid, Divider
} from '@mui/material';
import { UploadFile as UploadIcon, FlashOn as ExecuteIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api from '../services/api';

const ExcelImporter = () => {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [mapping, setMapping] = useState({});
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [structure, setStructure] = useState([]);

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            const response = await api.get('/db/explorer');
            setTables(response.data.data.userTables);
        } catch (error) {
            console.error('Error fetching tables:', error);
        }
    };

    const handleTableChange = async (e) => {
        const tableName = e.target.value;
        setSelectedTable(tableName);
        try {
            const response = await api.get(`/db/structure/${tableName}`);
            setStructure(response.data.data);
            // Reset mapping
            setMapping({});
        } catch (error) {
            console.error('Error fetching structure:', error);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            setExcelData(data);
            setStatus({ type: 'info', message: `${data.length} rows loaded from Excel.` });
        };
        reader.readAsBinaryString(file);
    };

    const handleMappingChange = (excelCol, tableCol) => {
        setMapping({ ...mapping, [excelCol]: tableCol });
    };

    const handleImport = async () => {
        if (!selectedTable || excelData.length === 0) return;
        setLoading(true);
        setStatus({ type: 'info', message: 'Importing records...' });

        let successCount = 0;
        let errorCount = 0;

        for (const row of excelData) {
            const mappedRow = {};
            Object.keys(mapping).forEach(excelCol => {
                if (mapping[excelCol]) {
                    mappedRow[mapping[excelCol]] = row[excelCol];
                }
            });

            try {
                await api.post(`/crud/${selectedTable}`, mappedRow);
                successCount++;
            } catch (err) {
                errorCount++;
                console.error('Row import failed:', err);
            }
        }

        setLoading(false);
        setStatus({
            type: successCount > 0 ? 'success' : 'error',
            message: `Import finished. Success: ${successCount}, Failed: ${errorCount}`
        });
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom fontWeight="bold">Excel Importer</Typography>

            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth>
                            <InputLabel>Select Target Table</InputLabel>
                            <Select value={selectedTable} label="Select Target Table" onChange={handleTableChange}>
                                {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Button variant="outlined" component="label" fullWidth startIcon={<UploadIcon />} sx={{ py: 1.5 }}>
                            Upload .xlsx File
                            <input type="file" hidden accept=".xlsx, .xls" onChange={handleFileUpload} />
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Button
                            variant="contained"
                            fullWidth
                            color="success"
                            startIcon={<ExecuteIcon />}
                            sx={{ py: 1.5 }}
                            disabled={!selectedTable || excelData.length === 0 || loading}
                            onClick={handleImport}
                        >
                            Execute Import
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {status.message && <Alert severity={status.type} sx={{ mb: 3 }}>{status.message}</Alert>}

            {excelData.length > 0 && selectedTable && (
                <Paper elevation={3} sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Field Mapping</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Map Excel columns to Firebird table fields.
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                        {Object.keys(excelData[0]).map(excelCol => (
                            <Box key={excelCol} sx={{ minWidth: 200 }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Excel: {excelCol}</Typography>
                                <Select
                                    size="small"
                                    fullWidth
                                    value={mapping[excelCol] || ''}
                                    onChange={(e) => handleMappingChange(excelCol, e.target.value)}
                                    displayEmpty
                                >
                                    <MenuItem value=""><em>Ignore</em></MenuItem>
                                    {structure.map(s => <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>)}
                                </Select>
                            </Box>
                        ))}
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="h6" gutterBottom>Preview (First 5 Rows)</Typography>
                    <TableContainer sx={{ maxHeight: 300 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    {Object.keys(excelData[0]).map(h => <TableCell key={h} sx={{ fontWeight: 'bold' }}>{h}</TableCell>)}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {excelData.slice(0, 5).map((row, i) => (
                                    <TableRow key={i}>
                                        {Object.values(row).map((v, j) => <TableCell key={j}>{v?.toString()}</TableCell>)}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Box>
    );
};

export default ExcelImporter;
