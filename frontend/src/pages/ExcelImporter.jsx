import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Select, MenuItem, FormControl,
    InputLabel, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Alert, CircularProgress, Grid, Divider,
    Stepper, Step, StepLabel, Card, CardContent, Chip, Fade
} from '@mui/material';
import {
    UploadFile as UploadIcon,
    CheckCircle as CommitIcon,
    Cancel as RollbackIcon,
    Visibility as PreviewIcon,
    Storage as DbIcon,
    Cached as ReorderIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

const ExcelImporter = () => {
    const { t } = useTranslation();
    const [activeStep, setActiveStep] = useState(0);
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState('');
    const [excelData, setExcelData] = useState([]);
    const [mapping, setMapping] = useState({});
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [structure, setStructure] = useState([]);
    const [stagedData, setStagedData] = useState(null);
    const [importMode, setImportMode] = useState('insert');
    const [pkColumn, setPkColumn] = useState('');

    const steps = [
        'Configuración & Mapeo',
        'Auditoría de Datos',
        'Finalización'
    ];

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            const response = await api.get('/db/explorer');
            const userTables = response.data?.data?.userTables;
            setTables(Array.isArray(userTables) ? userTables : []);
        } catch (error) {
            console.error('Error fetching tables:', error);
            setTables([]);
        }
    };

    const handleTableChange = async (e) => {
        const tableName = e.target.value;
        setSelectedTable(tableName);
        try {
            const response = await api.get(`/db/structure/${tableName}`);
            setStructure(response.data.data);
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
            setStatus({ type: 'info', message: `Se cargaron ${data.length} filas del archivo excel.` });
        };
        reader.readAsBinaryString(file);
    };

    const handleMappingChange = (excelCol, tableCol) => {
        setMapping({ ...mapping, [excelCol]: tableCol });
    };

    const handleStageData = async () => {
        if (!selectedTable || excelData.length === 0) return;
        setLoading(true);
        setStatus({ type: 'info', message: 'Preparando datos para auditoría...' });

        try {
            const res = await api.post(`/import/stage/${selectedTable}`, {
                data: excelData,
                mapping,
                importMode,
                pkColumn
            });
            if (res.data.success) {
                setStagedData({
                    rowCount: excelData.length,
                    tableName: selectedTable,
                    mapping
                });
                setActiveStep(1);
                setStatus({ type: 'success', message: 'Datos preparados. Por favor realice la auditoría antes de migrar.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Error al preparar datos: ' + (err.response?.data?.message || err.message) });
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        setLoading(true);
        setStatus({ type: 'info', message: 'Migrando datos a la base de datos...' });
        try {
            const res = await api.post(`/import/commit/${selectedTable}`);
            if (res.data.success) {
                setStatus({ type: 'success', message: `¡Importación exitosa! ${res.data.rowCount} filas migradas.` });
                setActiveStep(2);
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Fallo en la migración: ' + (err.response?.data?.message || err.message) });
        } finally {
            setLoading(false);
        }
    };

    const handleRollback = async () => {
        setLoading(true);
        try {
            await api.post(`/import/rollback/${selectedTable}`);
            setActiveStep(0);
            setStagedData(null);
            setStatus({ type: 'warning', message: 'Importación descartada. Los datos temporales fueron eliminados.' });
        } catch (err) {
            console.error('Rollback failed', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 1, md: 3 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h4" fontWeight="900" letterSpacing={-1} color="primary">
                    DATA <Box component="span" sx={{ color: 'text.primary' }}>IMPORTER</Box>
                </Typography>
                <Chip label="v2.2 Optimized" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
            </Box>

            <Stepper activeStep={activeStep} sx={{ mb: 4, py: 3, px: 4, bgcolor: 'background.paper', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {status.message && (
                <Fade in={true}>
                    <Alert
                        severity={status.type}
                        variant="filled"
                        sx={{ mb: 4, borderRadius: 2, '& .MuiAlert-icon': { fontSize: 24 } }}
                        onClose={() => setStatus({ ...status, message: '' })}
                    >
                        {status.message}
                    </Alert>
                </Fade>
            )}

            {activeStep === 0 && (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={5}>
                        <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4, bgcolor: 'background.paper' }}>
                            <Typography variant="h6" gutterBottom fontWeight="800" display="flex" alignItems="center">
                                <DbIcon sx={{ mr: 1.5, color: 'primary.main' }} /> {t('importer.config')}
                            </Typography>
                            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel>Modo de Importación</InputLabel>
                                    <Select
                                        value={importMode}
                                        onChange={(e) => {
                                            setImportMode(e.target.value);
                                            if (e.target.value === 'insert') setPkColumn('');
                                        }}
                                        label="Modo de Importación"
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <MenuItem value="insert">Solo Insertar (Rápido)</MenuItem>
                                        <MenuItem value="upsert">Insertar o Actualizar (Upsert)</MenuItem>
                                    </Select>
                                </FormControl>

                                {importMode === 'upsert' && (
                                    <FormControl fullWidth variant="outlined" error={!pkColumn}>
                                        <InputLabel>Columna Clave (PK) para Matching</InputLabel>
                                        <Select
                                            value={pkColumn}
                                            onChange={(e) => setPkColumn(e.target.value)}
                                            label="Columna Clave (PK) para Matching"
                                            sx={{ borderRadius: 2 }}
                                        >
                                            {structure.map(s => (
                                                <MenuItem key={s.name || s.field_name} value={s.name || s.field_name}>
                                                    {s.name || s.field_name} {s.is_pk ? '(PK Sugerida)' : ''}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        {!pkColumn && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1 }}>Requerido para Upsert</Typography>}
                                    </FormControl>
                                )}

                                <FormControl fullWidth variant="outlined">
                                    <InputLabel>Tabla de Destino</InputLabel>
                                    <Select
                                        value={selectedTable}
                                        onChange={handleTableChange}
                                        label="Tabla de Destino"
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {tables.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                <Button
                                    variant="outlined"
                                    component="label"
                                    fullWidth
                                    startIcon={<UploadIcon />}
                                    sx={{ py: 2.5, borderStyle: 'dashed', borderWidth: 2, borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
                                >
                                    {excelData.length > 0 ? 'Cambiar Archivo Excel' : 'Seleccionar Excel (.xlsx)'}
                                    <input type="file" hidden accept=".xlsx, .xls" onChange={handleFileUpload} />
                                </Button>

                                {excelData.length > 0 && selectedTable && (
                                    <Button
                                        variant="contained"
                                        fullWidth
                                        size="large"
                                        startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <PreviewIcon />}
                                        onClick={handleStageData}
                                        disabled={loading || Object.values(mapping).filter(v => v).length === 0}
                                        sx={{ py: 2, borderRadius: 2, fontWeight: '900', boxShadow: '0 8px 16px rgba(25, 118, 210, 0.2)' }}
                                    >
                                        PREPARAR MIGRACIÓN
                                    </Button>
                                )}
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={7}>
                        {excelData.length > 0 && selectedTable && (
                            <Paper elevation={0} sx={{ p: 0, border: '1px solid', borderColor: 'divider', borderRadius: 4, overflow: 'hidden' }}>
                                <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
                                    <Typography variant="h6" fontWeight="800">Mapeo de Columnas</Typography>
                                    <Typography variant="caption" color="textSecondary">Asigna las columnas del Excel a los campos de la tabla de base de datos.</Typography>
                                </Box>
                                <Box sx={{ p: 3, maxHeight: 400, overflowY: 'auto' }}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2.5 }}>
                                        {Object.keys(excelData[0]).map(excelCol => (
                                            <Card key={excelCol} variant="outlined" sx={{ borderRadius: 3, transition: '0.2s', borderColor: mapping[excelCol] ? 'primary.main' : 'divider', bgcolor: mapping[excelCol] ? 'primary.soft' : 'background.paper' }}>
                                                <CardContent sx={{ p: '16px !important' }}>
                                                    <Typography variant="caption" color="primary" fontWeight="900" sx={{ opacity: 0.7 }}>Excel: {excelCol}</Typography>
                                                    <Select
                                                        size="small"
                                                        fullWidth
                                                        value={mapping[excelCol] || ''}
                                                        onChange={(e) => handleMappingChange(excelCol, e.target.value)}
                                                        sx={{ mt: 1, borderRadius: 1.5, bgcolor: 'background.paper' }}
                                                    >
                                                        <MenuItem value=""><em>Ignorar Columna</em></MenuItem>
                                                        {structure.map(s => <MenuItem key={s.name || s.field_name} value={s.name || s.field_name}>{s.name || s.field_name}</MenuItem>)}
                                                    </Select>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </Box>
                                </Box>
                                <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.01)', borderTop: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom display="flex" alignItems="center">
                                        <PreviewIcon sx={{ fontSize: 18, mr: 1 }} /> Vista Previa (Top 3)
                                    </Typography>
                                    <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                        <Table size="small">
                                            <TableHead><TableRow sx={{ bgcolor: 'grey.100' }}>{Object.keys(excelData[0]).map(h => <TableCell key={h} sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>{h}</TableCell>)}</TableRow></TableHead>
                                            <TableBody>
                                                {excelData.slice(0, 3).map((row, i) => (
                                                    <TableRow key={i}>{Object.values(row).map((v, j) => <TableCell key={j} sx={{ fontSize: '0.7rem' }}>{v?.toString()}</TableCell>)}</TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            </Paper>
                        )}
                    </Grid>
                </Grid>
            )
            }

            {
                activeStep === 1 && stagedData && (
                    <Fade in={true}>
                        <Paper elevation={4} sx={{ p: 5, borderRadius: 6, maxWidth: 900, mx: 'auto', border: '1px solid', borderColor: 'divider' }}>
                            <Box textAlign="center" mb={6}>
                                <Typography variant="h4" fontWeight="900" color="primary" gutterBottom>Auditoría de Inserción</Typography>
                                <Typography color="textSecondary" variant="h6">
                                    Revisa los datos preparados para la tabla <Chip label={stagedData.tableName} color="primary" size="small" sx={{ fontWeight: 'bold' }} />
                                </Typography>
                            </Box>

                            <Grid container spacing={4} sx={{ mb: 6 }} justifyContent="center">
                                <Grid item xs={12} md={5}>
                                    <Box sx={{ p: 4, bgcolor: 'rgba(25, 118, 210, 0.05)', border: '2px solid', borderColor: 'primary.main', borderRadius: 5, textAlign: 'center' }}>
                                        <Typography variant="h2" fontWeight="900" color="primary">{stagedData.rowCount}</Typography>
                                        <Typography variant="h6" fontWeight="bold" color="textSecondary">Registros a Insertar</Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={7}>
                                    <Typography variant="subtitle1" fontWeight="800" gutterBottom>Esquema de Destino</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                                        {Object.entries(stagedData.mapping).filter(([_, v]) => v).map(([k, v]) => (
                                            <Chip
                                                key={k}
                                                label={`${k} ➔ ${v}`}
                                                variant="filled"
                                                sx={{ borderRadius: 1.5, fontWeight: 'bold', px: 1, bgcolor: 'grey.100' }}
                                            />
                                        ))}
                                    </Box>
                                </Grid>
                            </Grid>

                            <Alert severity="warning" variant="outlined" sx={{ mb: 6, borderRadius: 3, borderLeftWidth: 8 }}>
                                <Typography variant="subtitle2" fontWeight="bold">Confirmación Requerida:</Typography>
                                Esta acción utilizará inserción masiva (Bulk Insert) optimizada. Si el proceso falla, se realizará un Rollback automático.
                                Sin embargo, una vez confirmado el Commit, los registros serán permanentes.
                            </Alert>

                            <Box display="flex" justifyContent="center" gap={4}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    fullWidth
                                    startIcon={<RollbackIcon />}
                                    onClick={handleRollback}
                                    disabled={loading}
                                    sx={{ py: 2.5, borderRadius: 3, fontWeight: 'bold', border: '2px solid' }}
                                >
                                    DESCARTAR & REINICIAR
                                </Button>
                                <Button
                                    variant="contained"
                                    color="success"
                                    fullWidth
                                    startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <CommitIcon />}
                                    onClick={handleCommit}
                                    disabled={loading}
                                    sx={{ py: 2.5, borderRadius: 3, fontWeight: 'bold', boxShadow: '0 8px 24px rgba(46, 125, 50, 0.2)' }}
                                >
                                    ACEPTAR COMMIT
                                </Button>
                            </Box>
                        </Paper>
                    </Fade>
                )
            }

            {
                activeStep === 2 && (
                    <Fade in={true}>
                        <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: 6, border: '2px solid', borderColor: 'success.main', bgcolor: 'rgba(76, 175, 80, 0.02)' }}>
                            <Box sx={{ width: 100, height: 100, borderRadius: '50%', bgcolor: 'success.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 4, boxShadow: '0 8px 20px rgba(76, 175, 80, 0.3)' }}>
                                <CommitIcon sx={{ fontSize: 60 }} />
                            </Box>
                            <Typography variant="h3" fontWeight="900" gutterBottom>¡Sincronización Exitosa!</Typography>
                            <Typography variant="h6" color="textSecondary" mb={5}>
                                Se han migrado <strong>{selectedTable}</strong> registros correctamente. Los datos ya están disponibles para consulta.
                            </Typography>
                            <Button
                                variant="contained"
                                size="large"
                                onClick={() => { setActiveStep(0); setStagedData(null); setExcelData([]); setMapping({}); }}
                                sx={{ px: 6, py: 2, borderRadius: 3, fontWeight: 'bold' }}
                            >
                                Importar Nuevo Archivo
                            </Button>
                        </Paper>
                    </Fade>
                )
            }
        </Box >
    );
};

export default ExcelImporter;
