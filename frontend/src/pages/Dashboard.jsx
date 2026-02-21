import React, { useState } from 'react';
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
    TableChart, Settings, ViewList, FlashOn, AutoFixHigh,
    Bookmark as BookmarkIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Placeholder Pages (we will implement these next)
import DBExplorer from './DBExplorer';
import CRUD from './CRUD';
import SQLExecutor from './SQLExecutor';
import UserManagement from './UserManagement';
import ExcelImporter from './ExcelImporter';
import SavedQueries from './SavedQueries';

const drawerWidth = 260;

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(true);
    const [explorerOpen, setExplorerOpen] = useState(true);

    const { t, i18n } = useTranslation();

    const toggleDrawer = () => setOpen(!open);

    const handleLanguageChange = (event) => {
        i18n.changeLanguage(event.target.value);
    };

    const menuItems = [
        { text: t('menu.dbExplorer'), icon: <DBIcon />, path: '/', subItems: true },
        { text: t('menu.sqlConsole'), icon: <SQLIcon />, path: '/sql' },
        { text: t('menu.savedQueries'), icon: <BookmarkIcon />, path: '/queries' },
        { text: t('menu.excelImport'), icon: <ExcelIcon />, path: '/import' },
        { text: t('menu.userRoles'), icon: <UserIcon />, path: '/users' },
    ];

    const dbNames = {
        'firebird': 'Firebird',
        'postgres': 'PostgreSQL',
        'mssql': 'SQL Server',
        'mysql': 'MySQL / MariaDB',
        'sqlite': 'SQLite'
    };

    const getDbDisplayName = () => dbNames[user?.dbType] || 'Database';

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton color="inherit" onClick={toggleDrawer} edge="start" sx={{ mr: 2 }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {getDbDisplayName()} Admin - {user?.host} [{user?.database}]
                    </Typography>

                    <Select
                        value={i18n.resolvedLanguage || 'en'}
                        onChange={handleLanguageChange}
                        size="small"
                        sx={{ color: 'white', '.MuiOutlinedInput-notchedOutline': { border: 0 }, mr: 2, '& .MuiSvgIcon-root': { color: 'white' } }}
                    >
                        <MenuItem value="en">EN</MenuItem>
                        <MenuItem value="es">ES</MenuItem>
                        <MenuItem value="pt">PT</MenuItem>
                    </Select>

                    <IconButton color="inherit" onClick={logout} title={t('menu.logOut')}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Drawer
                variant="permanent"
                sx={{
                    width: open ? drawerWidth : 60,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: {
                        width: open ? drawerWidth : 60,
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
                                        {open && <ListItemText primary={item.text} />}
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
                        <Route path="/users" element={<UserManagement />} />
                    </Routes>
                </Container>
            </Box>
        </Box>
    );
};

export default Dashboard;
