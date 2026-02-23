import React from 'react';
import {
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    Paper, Typography, Box, Chip
} from '@mui/material';

const CrudMetadata = ({ currentTab, structure, metadata, hasSource, entityType, isReadOnly, tableName, data }) => {

    const generateSQL = () => {
        if (isReadOnly) return `-- Source DDL not available for ${entityType} via this viewer.`;
        let sql = `CREATE TABLE ${tableName} (\n`;
        const colDefinitions = structure.map(col => {
            let def = `    ${col.name.padEnd(20)} ${col.type}`;
            if (col.length && !['INTEGER', 'BIGINT', 'SMALLINT', 'TIMESTAMP', 'DATE', 'TIME', 'BLOB', 'DOUBLE PRECISION'].includes(col.type)) {
                def += `(${col.length})`;
            }
            if (!col.nullable) def += ' NOT NULL';
            return def;
        });

        sql += colDefinitions.join(',\n');

        const pks = structure.filter(c => c.isPk).map(c => c.name);
        if (pks.length > 0) {
            sql += `,\n    CONSTRAINT PK_${tableName} PRIMARY KEY (${pks.join(', ')})`;
        }

        sql += '\n);';
        return sql;
    };

    return (
        <>
            {currentTab === 1 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Field Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Length</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Nullable</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Constraints</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {structure.map((col) => (
                                <TableRow key={col.name} hover>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{col.name}</TableCell>
                                    <TableCell>{col.type}</TableCell>
                                    <TableCell>{col.length}</TableCell>
                                    <TableCell>{col.nullable ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>
                                        {col.isPk && <Chip label="PK" color="primary" size="small" sx={{ mr: 0.5 }} />}
                                        {col.isFk && <Chip label="FK" color="secondary" size="small" />}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 2 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Index Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Column</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Unique</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {metadata.indexes?.map((idx, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>{idx.INDEX_NAME}</TableCell>
                                    <TableCell>{idx.FIELD_NAME}</TableCell>
                                    <TableCell>{idx.IS_UNIQUE === 1 ? 'Yes' : 'No'}</TableCell>
                                </TableRow>
                            ))}
                            {(!metadata.indexes || metadata.indexes.length === 0) && (
                                <TableRow><TableCell colSpan={3} align="center">No indexes found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 3 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Constraint Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Column</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Ref Table</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Ref Column</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {metadata.foreignKeys?.map((fk, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>{fk.CONSTRAINT_NAME}</TableCell>
                                    <TableCell>{fk.FIELD_NAME}</TableCell>
                                    <TableCell>{fk.REF_TABLE}</TableCell>
                                    <TableCell>{fk.REF_FIELD}</TableCell>
                                </TableRow>
                            ))}
                            {(!metadata.foreignKeys || metadata.foreignKeys.length === 0) && (
                                <TableRow><TableCell colSpan={4} align="center">No foreign keys found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 4 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#eee' }}>
                                <TableCell sx={{ fontWeight: 'bold' }}>Depends On Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {metadata.dependencies?.map((dep, i) => (
                                <TableRow key={i} hover>
                                    <TableCell>{dep.DEP_NAME}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={dep.DEP_TYPE === 0 ? 'Table' : dep.DEP_TYPE === 5 ? 'Procedure' : `Type ${dep.DEP_TYPE}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!metadata.dependencies || metadata.dependencies.length === 0) && (
                                <TableRow><TableCell colSpan={2} align="center">No dependencies found</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 5 && (
                <Paper elevation={3} sx={{ p: 3, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>
                    <Typography variant="h6" color="primary" gutterBottom sx={{ fontFamily: 'monospace' }}>
                        -- Generated SQL (Approximate)
                    </Typography>
                    <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                        {generateSQL()}
                    </Box>
                </Paper>
            )}

            {currentTab === 6 && hasSource && (
                <Paper elevation={3} sx={{ p: 3, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace' }}>
                    <Typography variant="h6" color="primary" gutterBottom sx={{ fontFamily: 'monospace' }}>
                        -- {entityType} Source Code
                    </Typography>
                    <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                        {data[0]?.SOURCE || data[0]?.source || data[0]?.DEFINITION || data[0]?.definition || '-- Source code loading soon...'}
                    </Box>
                </Paper>
            )}
        </>
    );
};

export default CrudMetadata;
