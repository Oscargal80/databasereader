import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Button, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Alert, CircularProgress
} from '@mui/material';
import {
    PersonAdd as AddIcon, Delete as DeleteIcon,
    Refresh as RefreshIcon
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

    const handleCreateUser = async () => {
        try {
            await api.post('/users/users', newUser);
            setOpenDialog(false);
            setNewUser({ username: '', password: '' });
            fetchUsers();
        } catch (err) {
            setError(t('users.createError') + ': ' + err.message);
        }
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
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>{t('users.createBtn')}</Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TableContainer component={Paper} elevation={3}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>{t('users.colUsername')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>{t('users.colFirstName')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>{t('users.colLastName')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>{t('users.actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.username} hover>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.firstName || '-'}</TableCell>
                                <TableCell>{user.lastName || '-'}</TableCell>
                                <TableCell>
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
                <DialogTitle>{t('users.dialogTitle')}</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label={t('users.fieldUsername')}
                            fullWidth
                            value={newUser.username}
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        />
                        <TextField
                            label={t('users.fieldPassword')}
                            type="password"
                            fullWidth
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>{t('users.cancelBtn')}</Button>
                    <Button onClick={handleCreateUser} variant="contained">{t('users.confirmBtn')}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserManagement;
