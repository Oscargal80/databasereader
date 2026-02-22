import React, { useMemo, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Paper, Typography, Divider } from '@mui/material';
import { Key } from '@mui/icons-material';

// Custom Node for Database Tables
const TableNode = ({ data }) => {
    return (
        <Paper
            elevation={6}
            sx={{
                minWidth: 180,
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.1)',
                background: theme => theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff'
            }}
        >
            <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1, textAlign: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {data.label}
                </Typography>
            </Box>
            <Box sx={{ p: 1 }}>
                {data.columns.map((col, idx) => (
                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {col.isPk && <Key sx={{ fontSize: 12, mr: 0.5, color: '#ffd700' }} />}
                            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: col.isPk ? 'bold' : 'normal' }}>
                                {col.name}
                            </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                            {col.type}
                        </Typography>
                    </Box>
                ))}
            </Box>
            <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
        </Paper>
    );
};

const nodeTypes = {
    table: TableNode,
};

const ERDiagram = ({ schema, viewType = 'er' }) => {
    const [nodes, setNodes] = React.useState([]);
    const [edges, setEdges] = React.useState([]);

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    useEffect(() => {
        if (!schema.tables) return;

        // Auto-layout logic (simplified for now, using a grid)
        const newNodes = schema.tables.map((table, idx) => ({
            id: table.name,
            type: 'table',
            data: {
                label: table.name,
                columns: viewType === 'relationships' ? [] : table.columns
            },
            position: { x: (idx % 4) * 250, y: Math.floor(idx / 4) * 350 },
        }));

        const newEdges = schema.relationships.map((rel, idx) => ({
            id: `e-${idx}`,
            source: rel.fromTable,
            target: rel.toTable,
            label: viewType === 'fks' ? rel.name : '',
            animated: true,
            style: { stroke: '#3f51b5', strokeWidth: 2 },
        }));

        setNodes(newNodes);
        setEdges(newEdges);
    }, [schema, viewType]);

    return (
        <Box sx={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background color="#aaa" gap={20} />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </Box>
    );
};

export default ERDiagram;
