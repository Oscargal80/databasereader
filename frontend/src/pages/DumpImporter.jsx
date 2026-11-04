import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Box, Typography, Button, Paper, Alert, AlertTitle, LinearProgress, Chip, Grid,
    Tabs, Tab, TextField, Table, TableBody, TableCell, TableContainer, TableRow,
    RadioGroup, FormControlLabel, Radio, Checkbox, Select, MenuItem, FormControl,
    InputLabel, Stepper, Step, StepLabel, CircularProgress
} from '@mui/material';
import {
    UploadFile as UploadIcon,
    Restore as RestoreIcon,
    Cancel as CancelIcon,
    DeleteOutline as DiscardIcon
} from '@mui/icons-material';
import api from '../services/api';

const STEPS = ['Archivo', 'Vista previa', 'Restauración'];
const DB_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const MAX_LIST_ROWS = 500;

const OBJECT_TABS = [
    { key: 'tables', label: 'Tablas' },
    { key: 'views', label: 'Vistas' },
    { key: 'functions', label: 'Funciones' },
    { key: 'triggers', label: 'Triggers' },
    { key: 'sequences', label: 'Secuencias' },
    { key: 'indexes', label: 'Índices' }
];

const JOB_ACTIVE = ['starting', 'running'];

const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const objectLabel = (item) => (typeof item === 'string' ? item : `${item.schema}.${item.name}`);

const suggestDbName = (fileName, dumpDatabase) => {
    const base = dumpDatabase || fileName.replace(/\.[^.]+$/, '');
    const cleaned = base.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1').slice(0, 55);
    return `${cleaned || 'dump'}_restore`;
};

const DumpImporter = () => {
    const [status, setStatus] = useState(null);
    const [activeStep, setActiveStep] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [dump, setDump] = useState(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [objectTab, setObjectTab] = useState('tables');
    const [filter, setFilter] = useState('');
    const [mode, setMode] = useState('new');
    const [targetDb, setTargetDb] = useState('');
    const [existingDbs, setExistingDbs] = useState([]);
    const [confirmExisting, setConfirmExisting] = useState(false);
    const [job, setJob] = useState(null);
    const fileInput = useRef(null);

    useEffect(() => {
        api.get('/dump/status')
            .then(res => setStatus(res.data))
            .catch(err => setMessage({ type: 'error', text: err.response?.data?.message || err.message }));
    }, []);

    useEffect(() => {
        if (!job || !JOB_ACTIVE.includes(job.status)) return undefined;
        const timer = setInterval(async () => {
            try {
                const res = await api.get(`/dump/jobs/${job.id}`);
                setJob(res.data.data);
            } catch (err) {
                setMessage({ type: 'error', text: err.response?.data?.message || err.message });
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [job]);

    const visibleObjects = useMemo(() => {
        if (!preview) return [];
        const needle = filter.trim().toLowerCase();
        const items = preview.objects[objectTab] || [];
        return needle ? items.filter(item => objectLabel(item).toLowerCase().includes(needle)) : items;
    }, [preview, objectTab, filter]);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setMessage({ type: '', text: '' });
        setUploading(true);
        setUploadPercent(0);

        try {
            const uploaded = await api.post(`/dump/upload?name=${encodeURIComponent(file.name)}`, file, {
                headers: { 'Content-Type': 'application/octet-stream' },
                onUploadProgress: (e) => setUploadPercent(e.total ? Math.round((e.loaded / e.total) * 100) : 0)
            });
            const uploadedDump = uploaded.data.data;
            setDump(uploadedDump);

            const previewRes = await api.get(`/dump/${uploadedDump.id}/preview`);
            setPreview(previewRes.data.data);
            setTargetDb(suggestDbName(file.name, previewRes.data.data.header.database));
            setActiveStep(1);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message });
        } finally {
            setUploading(false);
        }
    };

    const loadExistingDbs = async () => {
        try {
            const res = await api.get('/dump/databases');
            setExistingDbs(res.data.data);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message });
        }
    };

    const handleModeChange = (event) => {
        const next = event.target.value;
        setMode(next);
        setConfirmExisting(false);
        if (next === 'existing') {
            setTargetDb('');
            loadExistingDbs();
        } else {
            setTargetDb(suggestDbName(dump.name, preview.header.database));
        }
    };

    const startRestore = async () => {
        setMessage({ type: '', text: '' });
        try {
            const res = await api.post(`/dump/${dump.id}/restore`, {
                targetDb,
                mode,
                confirmExisting: mode === 'existing' ? confirmExisting : undefined
            });
            setJob(res.data.data);
            setActiveStep(2);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message });
        }
    };

    const cancelRestore = async () => {
        try {
            await api.post(`/dump/jobs/${job.id}/cancel`);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.message || err.message });
        }
    };

    const reset = async () => {
        if (dump) await api.delete(`/dump/${dump.id}`).catch(() => { });
        setDump(null);
        setPreview(null);
        setJob(null);
        setFilter('');
        setObjectTab('tables');
        setMode('new');
        setConfirmExisting(false);
        setMessage({ type: '', text: '' });
        setActiveStep(0);
    };

    const targetValid = mode === 'new'
        ? DB_NAME_PATTERN.test(targetDb)
        : Boolean(targetDb) && confirmExisting;

    if (!status) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>Importar dump de PostgreSQL</Typography>

            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            {!status.available && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    <AlertTitle>pg_restore no encontrado</AlertTitle>
                    Instalá las herramientas cliente de PostgreSQL (por ejemplo <code>brew install libpq</code>) o indicá la
                    ruta del binario en la variable <code>PG_RESTORE_PATH</code> y reiniciá el servidor.
                </Alert>
            )}

            {message.text && <Alert severity={message.type || 'info'} sx={{ mb: 2 }}>{message.text}</Alert>}

            {activeStep === 0 && (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <UploadIcon sx={{ fontSize: 56, opacity: 0.6 }} />
                    <Typography variant="body1" sx={{ mb: 1 }}>
                        Seleccioná un dump en formato custom (<code>pg_dump -Fc</code>), aunque termine en <code>.sql</code>.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Tamaño máximo: {formatBytes(status.maxDumpBytes)}. Primero se muestra el contenido; no se restaura nada hasta que lo confirmes.
                    </Typography>
                    <input ref={fileInput} type="file" hidden onChange={handleFile} />
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<UploadIcon />}
                        disabled={uploading || !status.available}
                        onClick={() => fileInput.current.click()}
                    >
                        Elegir archivo
                    </Button>
                    {uploading && (
                        <Box sx={{ mt: 3 }}>
                            <LinearProgress variant="determinate" value={uploadPercent} />
                            <Typography variant="caption">
                                {uploadPercent < 100 ? `Subiendo… ${uploadPercent}%` : 'Leyendo contenido del dump…'}
                            </Typography>
                        </Box>
                    )}
                </Paper>
            )}

            {activeStep === 1 && preview && (
                <>
                    <Paper sx={{ p: 3, mb: 2 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Typography variant="subtitle2" color="text.secondary">Archivo</Typography>
                                <Typography>{dump.name} · {formatBytes(dump.size)}</Typography>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Base de origen</Typography>
                                <Typography>{preview.header.database}</Typography>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Typography variant="subtitle2" color="text.secondary">Generado</Typography>
                                <Typography>
                                    {preview.header.archiveCreated} · servidor {preview.header.serverVersion} · pg_dump {preview.header.pgDumpVersion}
                                </Typography>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Formato</Typography>
                                <Typography>{preview.header.format} · {preview.header.compression} · {preview.header.tocEntries} entradas</Typography>
                            </Grid>
                        </Grid>
                        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {OBJECT_TABS.map(tab => (
                                <Chip key={tab.key} label={`${tab.label}: ${preview.objects[tab.key].length}`} />
                            ))}
                        </Box>
                    </Paper>

                    <Paper sx={{ mb: 2 }}>
                        <Tabs
                            value={objectTab}
                            onChange={(e, value) => setObjectTab(value)}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            {OBJECT_TABS.map(tab => <Tab key={tab.key} value={tab.key} label={tab.label} />)}
                        </Tabs>
                        <Box sx={{ p: 2 }}>
                            <TextField
                                size="small"
                                fullWidth
                                label="Filtrar"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {visibleObjects.length} resultado(s){visibleObjects.length > MAX_LIST_ROWS ? ` · mostrando los primeros ${MAX_LIST_ROWS}` : ''}.
                                El conteo de filas no está disponible hasta restaurar.
                            </Typography>
                        </Box>
                        <TableContainer sx={{ maxHeight: 360 }}>
                            <Table size="small" stickyHeader>
                                <TableBody>
                                    {visibleObjects.slice(0, MAX_LIST_ROWS).map((item, index) => (
                                        <TableRow key={`${objectLabel(item)}-${index}`} hover>
                                            <TableCell>{objectLabel(item)}</TableCell>
                                            <TableCell align="right">
                                                {objectTab === 'tables' && (
                                                    <Chip size="small" color={item.hasData ? 'success' : 'default'} label={item.hasData ? 'con datos' : 'sin datos'} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Restaurar</Typography>
                        <RadioGroup row value={mode} onChange={handleModeChange}>
                            <FormControlLabel value="new" control={<Radio />} label="Base nueva" />
                            <FormControlLabel value="existing" control={<Radio />} label="Base existente" />
                        </RadioGroup>

                        {mode === 'new' ? (
                            <TextField
                                sx={{ mt: 1 }}
                                fullWidth
                                label="Nombre de la nueva base"
                                value={targetDb}
                                onChange={(e) => setTargetDb(e.target.value)}
                                error={Boolean(targetDb) && !DB_NAME_PATTERN.test(targetDb)}
                                helperText="Letras, números y guion bajo; máximo 63. Se crea en el servidor conectado (requiere permiso CREATEDB)."
                            />
                        ) : (
                            <>
                                <FormControl fullWidth sx={{ mt: 1 }}>
                                    <InputLabel>Base destino</InputLabel>
                                    <Select label="Base destino" value={targetDb} onChange={(e) => setTargetDb(e.target.value)}>
                                        {existingDbs.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                    Los objetos del dump se crean dentro de la base elegida. Si ya existen tablas con los mismos nombres, esas sentencias fallan y se reportan como errores; no se borra nada.
                                </Alert>
                                <FormControlLabel
                                    control={<Checkbox checked={confirmExisting} onChange={(e) => setConfirmExisting(e.target.checked)} />}
                                    label="Entiendo que se escribirá sobre una base existente"
                                />
                            </>
                        )}

                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            Se restaura sin propietarios ni permisos (<code>--no-owner --no-acl</code>), así que no hace falta que existan los roles del dump.
                        </Typography>

                        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                            <Button variant="contained" startIcon={<RestoreIcon />} disabled={!targetValid} onClick={startRestore}>
                                Restaurar
                            </Button>
                            <Button startIcon={<DiscardIcon />} onClick={reset}>Descartar archivo</Button>
                        </Box>
                    </Paper>
                </>
            )}

            {activeStep === 2 && job && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {job.createdDb ? 'Restaurando en la nueva base' : 'Restaurando en'} <code>{job.targetDb}</code>
                    </Typography>

                    {JOB_ACTIVE.includes(job.status) && (
                        <>
                            <LinearProgress variant={job.total ? 'determinate' : 'indeterminate'} value={job.progress} sx={{ my: 2 }} />
                            <Typography variant="body2">
                                {job.progress}% · {job.processed}{job.total ? ` / ${job.total}` : ''} pasos
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">{job.current}</Typography>
                            <Button color="error" startIcon={<CancelIcon />} onClick={cancelRestore} sx={{ mt: 2 }}>Cancelar</Button>
                        </>
                    )}

                    {job.status === 'completed' && (
                        <Alert severity="success" sx={{ mt: 2 }}>
                            Restauración completa en <b>{job.targetDb}</b>. Para explorarla, cerrá sesión y conectate a esa base.
                        </Alert>
                    )}
                    {job.status === 'completed_with_errors' && (
                        <Alert severity="warning" sx={{ mt: 2 }}>
                            Terminó con {job.errorCount} error(es) ignorado(s). La base <b>{job.targetDb}</b> quedó cargada parcialmente; revisá el detalle.
                        </Alert>
                    )}
                    {job.status === 'failed' && (
                        <Alert severity="error" sx={{ mt: 2 }}>La restauración falló antes de procesar objetos.</Alert>
                    )}
                    {job.status === 'cancelled' && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Restauración cancelada.{job.createdDb ? ` La base "${job.targetDb}" quedó creada con lo que alcanzó a cargarse.` : ''}
                        </Alert>
                    )}

                    {job.errors.length > 0 && (
                        <Box component="pre" sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', overflow: 'auto', maxHeight: 200, fontSize: 12 }}>
                            {job.errors.join('\n')}
                        </Box>
                    )}

                    {!JOB_ACTIVE.includes(job.status) && (
                        <Button variant="outlined" onClick={reset} sx={{ mt: 2 }}>Importar otro dump</Button>
                    )}
                </Paper>
            )}
        </Box>
    );
};

export default DumpImporter;
