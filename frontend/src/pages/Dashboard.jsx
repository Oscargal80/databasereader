import React, { useState, useEffect } from 'react';
import {
    Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
    IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Container, Collapse, Select, MenuItem
} from '@mui/material';
import {
    Menu as MenuIcon, Dashboard as DashIcon, Storage as DBIcon,
    Terminal as SQLIcon, Group as UserIcon, FileOpen as ExcelIcon,
    Logout as LogoutIcon, ChevronLeft as ChevronLeftIcon,
    Category as CategoryIcon, ExpandLess, ExpandMore,
    TableChart, Settings, ViewList, FlashOn, AutoFixHigh, Hub,
    Bookmark as BookmarkIcon, DarkMode as DarkModeIcon, LightMode as LightModeIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAppStore from '../store/useAppStore';

// Placeholder Pages (we will implement these next)
import DBExplorer from './DBExplorer';
import CRUD from './CRUD';
import SQLExecutor from './SQLExecutor';
import UserManagement from './UserManagement';
import ExcelImporter from './ExcelImporter';
import SavedQueries from './SavedQueries';
import VisualExplorer from './VisualExplorer';
import SettingsPage from './Settings';
import DatabaseInfo from './DatabaseInfo';

const drawerWidth = 260;

const Dashboard = () => {
    const { user, connections, switchConnection, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Global State
    const { sidebarOpen, toggleSidebar, themeMode, toggleTheme } = useAppStore();

    const { t, i18n } = useTranslation();

    const handleLanguageChange = (event) => {
        i18n.changeLanguage(event.target.value);
    };

    const menuItems = [
        { text: t('menu.dbExplorer'), icon: <DBIcon />, path: '/', subItems: true },
        { text: t('menu.sqlConsole'), icon: <SQLIcon />, path: '/sql' },
        { text: t('menu.savedQueries'), icon: <BookmarkIcon />, path: '/queries' },
        { text: t('menu.excelImport'), icon: <ExcelIcon />, path: '/import' },
        { text: t('menu.visuals'), icon: <Hub />, path: '/visuals' },
        { text: t('menu.dbInfo') || 'System Info', icon: <InfoIcon />, path: '/info' },
        { text: t('menu.userRoles'), icon: <UserIcon />, path: '/users' },
        { text: t('menu.settings') || 'Settings', icon: <Settings />, path: '/settings' },
    ];

    const dbNames = {
        'firebird': 'Firebird',
        'postgres': 'PostgreSQL',
        'mysql': 'MySQL / MariaDB'
    };

    const getDbDisplayName = () => dbNames[user?.dbType] || 'Database';

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDate = (date) => {
        return date.toLocaleDateString(i18n.language === 'es' ? 'es-ES' : 'en-US', {
            weekday: 'short',
            day: '2-digit',
            month: 'short'
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: themeMode === 'dark' ? '#1e1e1e' : 'primary.main', backgroundImage: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                <Toolbar>
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: '900', letterSpacing: -0.5, display: 'flex', alignItems: 'center' }}>
                            SQL <Box component="span" sx={{ color: themeMode === 'dark' ? 'primary.main' : 'rgba(255,255,255,0.7)', mx: 0.5 }}>COPILOT</Box> ADMIN
                        </Typography>
                        <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.2)', height: 24, alignSelf: 'center' }} />

                        {/* Connection Switcher */}
                        <Select
                            value={connections.findIndex(c => c.database === user?.database && c.host === user?.host)}
                            onChange={(e) => {
                                const conn = connections[e.target.value];
                                if (conn) switchConnection(conn).then(() => {
                                    // Refresh current view by navigating to same path or force refresh
                                    navigate(location.pathname, { replace: true });
                                    window.location.reload(); // Hard refresh to clear all caches/states
                                });
                            }}
                            size="small"
                            sx={{
                                color: 'white',
                                '.MuiOutlinedInput-notchedOutline': { border: 0 },
                                '& .MuiSvgIcon-root': { color: 'white' },
                                fontWeight: 'bold',
                                maxWidth: 300,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                borderRadius: 1,
                                px: 1
                            }}
                        >
                            {connections.map((conn, idx) => (
                                <MenuItem key={idx} value={idx}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <DBIcon sx={{ mr: 1, fontSize: 18, opacity: 0.7 }} />
                                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                            {conn.database} <Typography component="span" variant="caption" sx={{ opacity: 0.7 }}>({conn.host})</Typography>
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                            <MenuItem value={-1} onClick={() => navigate('/login')}>
                                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                                    + {t('menu.addConnection') || 'Add Connection'}
                                </Typography>
                            </MenuItem>
                        </Select>
                    </Box>

                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', mr: 3, px: 2, py: 0.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mr: 1.5, letterSpacing: 0.5 }}>
                            {formatDate(currentTime)}
                        </Typography>
                        <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)', height: 16, alignSelf: 'center', mr: 1.5 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: '900', fontFamily: 'monospace', fontSize: '1rem', color: themeMode === 'dark' ? 'primary.main' : 'inherit' }}>
                            {formatTime(currentTime)}
                        </Typography>
                    </Box>

                    <Select
                        value={i18n.resolvedLanguage || 'en'}
                        onChange={handleLanguageChange}
                        size="small"
                        sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { border: 0 }, mr: 2, '& .MuiSvgIcon-root': { color: 'white' }, fontWeight: 'bold' }}
                    >
                        <MenuItem value="en">EN</MenuItem>
                        <MenuItem value="es">ES</MenuItem>
                        <MenuItem value="pt">PT</MenuItem>
                    </Select>

                    <IconButton color="inherit" onClick={toggleTheme} title="Toggle Dark Mode" sx={{ mr: 1 }}>
                        {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                    </IconButton>

                    <IconButton color="inherit" onClick={() => navigate('/settings')} title={t('menu.settings') || 'Settings'} sx={{ mr: 1 }}>
                        <Settings />
                    </IconButton>

                    <IconButton color="inherit" onClick={logout} title={t('menu.logOut')}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Drawer
                variant="permanent"
                sx={{
                    width: sidebarOpen ? drawerWidth : 60,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: {
                        width: sidebarOpen ? drawerWidth : 60,
                        boxSizing: 'border-box',
                        transition: 'width 0.2s',
                        overflowX: 'hidden'
                    },
                }}
            >
                <Toolbar />
                <Box sx={{ overflow: 'auto' }}>
                    <List>
                        {menuItems.map((item) => (
                            <React.Fragment key={item.text}>
                                <ListItem disablePadding>
                                    <ListItemButton
                                        selected={location.pathname === item.path}
                                        onClick={() => navigate(item.path)}
                                    >
                                        <ListItemIcon>{item.icon}</ListItemIcon>
                                        {sidebarOpen && <ListItemText primary={item.text} />}
                                    </ListItemButton>
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                </Box>
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, p: 3, pt: 10 }}>
                <Container maxWidth="xl">
                    <Routes>
                        <Route path="/" element={<DBExplorer />} />
                        <Route path="/crud/:tableName" element={<CRUD />} />
                        <Route path="/sql" element={<SQLExecutor />} />
                        <Route path="/queries" element={<SavedQueries />} />
                        <Route path="/import" element={<ExcelImporter />} />
                        <Route path="/visuals" element={<VisualExplorer />} />
                        <Route path="/info" element={<DatabaseInfo />} />
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </Container>
            </Box>
        </Box>
    );
};

export default Dashboard;
