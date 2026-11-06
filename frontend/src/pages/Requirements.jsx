import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Alert, Chip, Grid, CircularProgress,
    Card, CardContent, CardActions, Divider
} from '@mui/material';
import {
    Refresh as RefreshIcon, OpenInNew as OpenIcon, CheckCircle as OkIcon,
    ArrowBack as BackIcon
} from '@mui/icons-material';
import api from '../services/api';

const MIN_DUMP_MAJOR = 17;

const EngineStatus = ({ engine }) => {
    if (engine.listening === true) {
        return <Chip size="small" color="success" icon={<OkIcon />} label={`Detectado en el puerto ${engine.port}`} />;
    }
    if (engine.listening === false) {
        return <Chip size="small" variant="outlined" label="No detectado en este equipo" />;
    }
    return <Chip size="small" variant="outlined" label="Sin comprobar" />;
};

const DownloadButtons = ({ downloads, platform }) => {
    // In the desktop app only the links for this system; in the browser all of them
    const visible = downloads.filter(link => !platform || link.platforms.includes(platform));
    return (
        <>
            {visible.map(link => (
                <Button
                    key={link.url}
                    size="small"
                    component="a"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenIcon fontSize="small" />}
                >
                    {link.label}
                </Button>
            ))}
        </>
    );
};

const Requirements = ({ standalone = false }) => {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/requirements');
            setInfo(response.data);
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const pgRestore = info?.tools.find(tool => tool.id === 'pg_restore');

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: standalone ? { xs: 2, md: 4 } : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {standalone && (
                    <Button component="a" href="#/login" startIcon={<BackIcon />}>Volver a conectar</Button>
                )}
                <Typography variant="h5" fontWeight="bold" sx={{ flexGrow: 1 }}>Requisitos y motores</Typography>
                <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={load} disabled={loading}>
                    Volver a revisar
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
                Los controladores para conectarse a Firebird, PostgreSQL, MySQL y SQL Server ya vienen incluidos en la app.
                Lo que sí hace falta es un servidor al que conectarse: aquí ves cuáles hay en este equipo y de dónde descargar los que falten.
            </Alert>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {info && !info.desktop && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Estás usando la versión web: desde el navegador no se puede revisar qué hay instalado en tu equipo.
                    Se muestran los datos habituales y las descargas.
                </Alert>
            )}

            {loading && !info && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}

            {info && (
                <>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Servidores de base de datos</Typography>
                    <Grid container spacing={2}>
                        {info.engines.map(engine => (
                            <Grid key={engine.id} size={{ xs: 12, md: 6 }}>
                                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                            <Typography variant="subtitle1" fontWeight="bold">{engine.label}</Typography>
                                            <EngineStatus engine={engine} />
                                        </Box>
                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                            Puerto habitual <b>{engine.port}</b> · usuario habitual <b>{engine.defaultUser}</b>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">{engine.userHint}</Typography>
                                    </CardContent>
                                    <CardActions sx={{ flexWrap: 'wrap' }}>
                                        <DownloadButtons downloads={engine.downloads} platform={info.desktop ? info.platform : null} />
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>Herramientas</Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle1" fontWeight="bold">{pgRestore.label}</Typography>
                            {pgRestore.found && pgRestore.bundled && (
                                <Chip size="small" color="success" icon={<OkIcon />} label={`Incluido en la app (PostgreSQL ${pgRestore.major})`} />
                            )}
                            {pgRestore.found && !pgRestore.bundled && (
                                <Chip size="small" color="success" icon={<OkIcon />} label={`Instalado (PostgreSQL ${pgRestore.major})`} />
                            )}
                            {!pgRestore.found && <Chip size="small" color="warning" label="No encontrado" />}
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="body2" color="text.secondary">
                            Solo se usa en "Importar dump". Debe ser de la misma versión que el programa que creó el dump, o más nueva
                            (el dump de ejemplo se creó con PostgreSQL {MIN_DUMP_MAJOR}).
                            {pgRestore.path && <> Ruta detectada: <code>{pgRestore.path}</code></>}
                        </Typography>
                        {pgRestore.found && pgRestore.major < MIN_DUMP_MAJOR && (
                            <Alert severity="warning" sx={{ mt: 1.5 }}>
                                Esta versión es anterior a la {MIN_DUMP_MAJOR}: no podrá leer dumps hechos con PostgreSQL {MIN_DUMP_MAJOR} o más nuevo.
                            </Alert>
                        )}
                        {!pgRestore.found && (
                            <Alert severity="warning" sx={{ mt: 1.5 }}>
                                Instala las herramientas de cliente de PostgreSQL para poder importar dumps.
                            </Alert>
                        )}
                    </Paper>
                </>
            )}
        </Box>
    );
};

export default Requirements;
