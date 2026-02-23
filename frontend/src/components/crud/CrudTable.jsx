import React from 'react';
import {
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    IconButton, Paper, TablePagination, Box
} from '@mui/material';
import { MoreVert as MoreVertIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

const CrudTable = ({
    data, structure, isReadOnly, total, rowsPerPage, page,
    handleChangePage, handleChangeRowsPerPage, getRowValue,
    handleMenuOpen, handleDelete, t
}) => {
    return (
        <TableContainer component={Paper} elevation={3}>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        {structure.map((col) => (
                            <TableCell key={col.name} sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                                {col.name} {col.isPk && ' (PK)'}
                            </TableCell>
                        ))}
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', width: 100 }}>{t('crud.actions')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((row, index) => (
                        <TableRow key={index} hover>
                            {structure.map((col) => (
                                <TableCell key={col.name}>{getRowValue(row, col.name)?.toString() || ''}</TableCell>
                            ))}
                            <TableCell>
                                <IconButton size="small" onClick={(e) => handleMenuOpen(e, row)} title={t('crud.moreOptions', 'More Options')}>
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                                {!isReadOnly && (
                                    <>
                                        <IconButton
                                            size="small"
                                            color="primary"
                                            onClick={() => handleMenuOpen({ currentTarget: null }, row, 'edit')}
                                            title={t('crud.edit', 'Edit')}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleDelete(row)}
                                            title={t('crud.delete', 'Delete')}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={structure.length + 1} align="center" sx={{ py: 3 }}>
                                No data available in this {isReadOnly ? 'view' : 'table'}.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={total}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </TableContainer>
    );
};

export default CrudTable;
