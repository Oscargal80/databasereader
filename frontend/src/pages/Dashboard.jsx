import React, { useState } from 'react';
import {
    Box, Drawer, AppBar, Toolbar, List, Typography, Divider,
    IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Container, Collapse
} from '@mui/material';
import {
    Menu as MenuIcon, Dashboard as DashIcon, Storage as DBIcon,
    Terminal as SQLIcon, Group as UserIcon, FileOpen as ExcelIcon,
    Logout as LogoutIcon, ChevronLeft as ChevronLeftIcon,
    Category as CategoryIcon, ExpandLess, ExpandMore,
    TableChart, Settings, ViewList, FlashOn, AutoFixHigh
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Placeholder Pages (we will implement these next)
import DBExplorer from './DBExplorer';
import CRUD from './CRUD';
import SQLExecutor from './SQLExecutor';
import UserManagement from './UserManagement';
import ExcelImporter from './ExcelImporter';

const drawerWidth = 260;

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(true);
    const [explorerOpen, setExplorerOpen] = useState(true);

    const toggleDrawer = () => setOpen(!open);

    const menuItems = [
        { text: 'Explorer', icon: <DBIcon />, path: '/', subItems: true },
        { text: 'SQL Console', icon: <SQLIcon />, path: '/sql' },
        { text: 'Excel Import', icon: <ExcelIcon />, path: '/import' },
        { text: 'Users & Roles', icon: <UserIcon />, path: '/users' },
    ];

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton color="inherit" onClick={toggleDrawer} edge="start" sx={{ mr: 2 }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        Firebird Admin - {user?.host} [{user?.database}]
                    </Typography>
                    <IconButton color="inherit" onClick={logout}>
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
                        <Route path="/import" element={<ExcelImporter />} />
                        <Route path="/users" element={<UserManagement />} />
                    </Routes>
                </Container>
            </Box>
        </Box>
    );
};

export default Dashboard;
