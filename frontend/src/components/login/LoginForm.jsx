import React from 'react';
import {
    Box, Typography, TextField, Button, Paper,
    Alert, CircularProgress, InputAdornment, IconButton,
    FormControl, InputLabel, Select, MenuItem, Link,
    Fade, Grid, useTheme
} from '@mui/material';

import {
    Dns as DnsIcon, SettingsInputComponent as PortIcon, Storage as StorageIcon,
    Person as PersonIcon, Lock as LockIcon, Visibility, VisibilityOff
} from '@mui/icons-material';

const LoginForm = ({
    credentials, showPassword, error, success, loading, testHostLoading, testDbLoading,
    handleChange, handleTestHost, handleTestDb, handleSubmit, setShowPassword, isMobile, t
}) => {
    const theme = useTheme();

    return (
        <Grid
            item
            xs={12} md={7} lg={6}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3
            }}
        >
            <Fade in={true} timeout={800}>
                <Paper
                    elevation={24}
                    sx={{
                        p: { xs: 3, sm: 4 },
                        width: '100%',
                        maxWidth: 500,
                        borderRadius: 4,
                        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.18)',
                        backgroundColor: theme.palette.background.paper
                    }}
                >
                    <Box mb={2} textAlign={isMobile ? 'center' : 'left'}>
                        {isMobile && (
                            <Box display="flex" justifyContent="center" mb={1}>
                                <StorageIcon sx={{ fontSize: 32, color: '#1976d2' }} />
                            </Box>
                        )}
                        <Typography variant="h5" fontWeight="700" color="text.primary" gutterBottom>
                            {t('login.formTitle')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('login.formSubtitle')}
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 2, py: 0, borderRadius: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2, py: 0, borderRadius: 2 }}>{success}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={1.5}>
                            {/* Database Type */}
                            <Grid size={{ xs: 12 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>{t('login.dbEngine')}</InputLabel>
                                    <Select
                                        name="dbType"
                                        value={credentials.dbType}
                                        label={t('login.dbEngine')}
                                        onChange={handleChange}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        <MenuItem value="firebird"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#e53935' }} /> Firebird SQL</Box></MenuItem>
                                        <MenuItem value="postgres"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#1976d2' }} /> PostgreSQL</Box></MenuItem>
                                        <MenuItem value="mssql"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#0083c2' }} /> SQL Server</Box></MenuItem>
                                        <MenuItem value="mysql"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#f57c00' }} /> MySQL / MariaDB</Box></MenuItem>
                                        <MenuItem value="sqlite"><Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1, color: '#757575' }} /> SQLite (Local)</Box></MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Host & Port (Hidden for SQLite) */}
                            {credentials.dbType !== 'sqlite' && (
                                <>
                                    <Grid item xs={12} sm={8}>
                                        <TextField
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('login.host')}
                                            name="host"
                                            value={credentials.host}
                                            onChange={handleChange}
                                            placeholder={t('login.hostPlaceholder')}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><DnsIcon fontSize="small" color="action" /></InputAdornment>,
                                                sx: { borderRadius: 2 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <TextField
                                            required
                                            fullWidth
                                            size="small"
                                            label={t('login.port')}
                                            name="port"
                                            value={credentials.port}
                                            onChange={handleChange}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><PortIcon fontSize="small" color="action" /></InputAdornment>,
                                                sx: { borderRadius: 2 }
                                            }}
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* Database Path/Name */}
                            <Grid item xs={12}>
                                <TextField
                                    required
                                    fullWidth
                                    size="small"
                                    label={credentials.dbType === 'sqlite' ? "Absolute SQLite File Path" : t('login.dbPath')}
                                    name="database"
                                    value={credentials.database}
                                    onChange={handleChange}
                                    placeholder={credentials.dbType === 'sqlite' ? "/var/data/db.sqlite" : t('login.dbPathPlaceholder')}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><StorageIcon fontSize="small" color="action" /></InputAdornment>,
                                        sx: { borderRadius: 2 }
                                    }}
                                />
                            </Grid>

                            {/* User & Password (Hidden for SQLite) */}
                            {credentials.dbType !== 'sqlite' && (
                                <>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            required
                                            fullWidth
                                            size="small"
                                            label="Username"
                                            name="user"
                                            value={credentials.user}
                                            onChange={handleChange}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" color="action" /></InputAdornment>,
                                                sx: { borderRadius: 2 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            required
                                            fullWidth
                                            size="small"
                                            label="Password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={credentials.password}
                                            onChange={handleChange}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" color="action" /></InputAdornment>,
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                                sx: { borderRadius: 2 }
                                            }}
                                        />
                                    </Grid>
                                </>
                            )}

                            {/* Role (Conditional for engines that support it) */}
                            {['firebird', 'postgres', 'mssql'].includes(credentials.dbType) && (
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Role (Optional)"
                                        name="role"
                                        value={credentials.role}
                                        onChange={handleChange}
                                        placeholder={credentials.dbType === 'firebird' ? "e.g. RDB$ADMIN" : "N/A"}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><PortIcon fontSize="small" color="action" /></InputAdornment>,
                                            sx: { borderRadius: 2 }
                                        }}
                                        helperText={credentials.dbType === 'firebird' ? "Required for administrative tasks if not SYSDBA" : ""}
                                    />
                                </Grid>
                            )}

                            {/* Action Buttons */}
                            <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
                                <Button
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    color="primary"
                                    disabled={loading}
                                    sx={{
                                        py: 1,
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        boxShadow: '0 8px 16px 0 rgba(25, 118, 210, 0.24)',
                                        '&:hover': {
                                            boxShadow: '0 12px 20px 0 rgba(25, 118, 210, 0.4)'
                                        }
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : t('login.btnConnect')}
                                </Button>
                            </Grid>

                            {/* Testing Area (Hidden for SQLite) */}
                            {credentials.dbType !== 'sqlite' && (
                                <Grid item xs={12}>
                                    <Box display="flex" justifyContent="center" gap={1}>
                                        <Button
                                            variant="outlined"
                                            color="secondary"
                                            size="small"
                                            onClick={handleTestHost}
                                            disabled={testHostLoading || !credentials.host}
                                            sx={{ borderRadius: 2, textTransform: 'none', px: 2 }}
                                        >
                                            {testHostLoading ? <CircularProgress size={16} /> : t('login.btnTestHost')}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="info"
                                            size="small"
                                            onClick={handleTestDb}
                                            disabled={testDbLoading || !credentials.database}
                                            sx={{ borderRadius: 2, textTransform: 'none', px: 2 }}
                                        >
                                            {testDbLoading ? <CircularProgress size={16} /> : t('login.btnTestDb')}
                                        </Button>
                                    </Box>
                                </Grid>
                            )}
                        </Grid>
                    </form>

                    <Box mt={2} textAlign="center">
                        <Typography variant="caption" color="text.secondary">
                            Need help? <Link href="/api/docs/readme" target="_blank" underline="hover">Documentation</Link>
                        </Typography>
                    </Box>
                </Paper>
            </Fade>
        </Grid>
    );
};

export default LoginForm;
