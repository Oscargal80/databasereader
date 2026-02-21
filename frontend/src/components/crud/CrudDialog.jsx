import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Box, Button
} from '@mui/material';

const CrudDialog = ({ open, onClose, tableName, structure, formData, setFormData, handleSave }) => {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Add New Record to {tableName}</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 1 }}>
                    {structure.map((col) => (
                        <TextField
                            key={col.name}
                            margin="dense"
                            label={col.name + (col.nullable ? '' : ' *')}
                            fullWidth
                            variant="outlined"
                            value={formData[col.name] || ''}
                            onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                            required={!col.nullable}
                            type={col.type === 7 || col.type === 8 ? 'number' : 'text'}
                        />
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
    );
};

export default CrudDialog;
