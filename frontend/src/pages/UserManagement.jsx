import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Button, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Alert, CircularProgress
} from '@mui/material';
import {
    PersonAdd as AddIcon, Delete as DeleteIcon,
    Refresh as RefreshIcon, Edit as EditIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

const UserManagement = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '' });
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('/users/users');
            setUsers(response.data.data);
        } catch (err) {
            setError(t('users.fetchError') + ': ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async () => {
        try {
            if (editMode) {
                await api.put(`/users/users/${newUser.username}`, { password: newUser.password });
            } else {
                await api.post('/users/users', newUser);
            }
            setOpenDialog(false);
            setNewUser({ username: '', password: '' });
            fetchUsers();
        } catch (err) {
            setError((editMode ? t('users.editError') : t('users.createError')) + ': ' + err.message);
        }
    };

    const handleEditUser = (user) => {
        setNewUser({ username: user.username, password: '' });
        setEditMode(true);
        setOpenDialog(true);
    };

    const handleDeleteUser = async (username) => {
        if (window.confirm(t('users.deleteConfirm', { username }))) {
            try {
                await api.delete(`/users/users/${username}`);
                fetchUsers();
            } catch (err) {
                setError(t('users.deleteError') + ': ' + err.message);
            }
        }
    };

    if (loading && users.length === 0) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <Typography variant="h4" fontWeight="bold">{t('users.title')}</Typography>
                <Box sx={{ ml: 'auto' }}>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchUsers} sx={{ mr: 1 }}>{t('users.refresh')}</Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditMode(false); setNewUser({ username: '', password: '' }); setOpenDialog(true); }}>{t('users.createBtn')}</Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer component={Paper} elevation={3}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: theme => theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>{t('users.colUsername')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: theme => theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>{t('users.colFirstName')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: theme => theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>{t('users.colLastName')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: theme => theme.palette.mode === 'dark' ? '#333' : '#f5f5f5' }}>{t('users.actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.username} hover>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.firstName || '-'}</TableCell>
                                <TableCell>{user.lastName || '-'}</TableCell>
                                <TableCell>
                                    <IconButton color="primary" onClick={() => handleEditUser(user)} sx={{ mr: 1 }}>
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton color="error" onClick={() => handleDeleteUser(user.username)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
                <DialogTitle>{editMode ? t('users.editTitle') || 'Edit User' : t('users.dialogTitle')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label={t('users.fieldUsername')}
                            fullWidth
                            disabled={editMode}
                            value={newUser.username}
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        />
                        <TextField
                            label={t('users.fieldPassword')}
                            type="password"
                            fullWidth
                            placeholder={editMode ? 'Leave blank to keep current' : ''}
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>{t('users.cancelBtn')}</Button>
                    <Button onClick={handleSaveUser} variant="contained">{t('users.confirmBtn')}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserManagement;
