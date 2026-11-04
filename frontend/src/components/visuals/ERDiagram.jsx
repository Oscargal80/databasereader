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
                minWidth: 200,
                borderRadius: 2,
                overflow: 'visible',
                border: '1px solid rgba(0,0,0,0.1)',
                background: theme => theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff',
                position: 'relative',
                transition: '0.3s',
                '&:hover': { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }
            }}
        >
            <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 1, textAlign: 'center', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', fontSize: 13 }}>
                    {data.label}
                </Typography>
            </Box>
            <Box sx={{ p: 1 }}>
                {data.columns.map((col, idx) => (
                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, position: 'relative', px: 1 }}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={`target-${col.name.trim()}`}
                            style={{ left: -16, background: '#3f51b5', width: 10, height: 10, border: '2px solid white' }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {col.isPk && <Key sx={{ fontSize: 12, mr: 0.5, color: '#ffd700' }} />}
                            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: col.isPk ? 'bold' : 'normal' }}>
                                {col.name}
                            </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, ml: 1 }}>
                            {col.type}
                        </Typography>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`source-${col.name.trim()}`}
                            style={{ right: -16, background: '#f50057', width: 10, height: 10, border: '2px solid white' }}
                        />
                    </Box>
                ))}
                {data.columns.length === 0 && (
                    <Box sx={{ p: 2, textAlign: 'center', opacity: 0.7, position: 'relative' }}>
                        <Handle
                            type="target"
                            position={Position.Left}
                            id="target-main"
                            style={{ left: -16, background: '#3f51b5', width: 10, height: 10, border: '2px solid white' }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{data.label}</Typography>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="source-main"
                            style={{ right: -16, background: '#f50057', width: 10, height: 10, border: '2px solid white' }}
                        />
                    </Box>
                )}
            </Box>
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

        console.log(`[ER-DIAGRAM] Rendering view: ${viewType} with ${schema.tables.length} tables and ${schema.relationships.length} relationships.`);

        // Dynamic Grid Layout
        const cols = Math.ceil(Math.sqrt(schema.tables.length));
        const newNodes = schema.tables.map((table, idx) => ({
            id: table.name,
            type: 'table',
            data: {
                label: table.name,
                columns: viewType === 'relationships' ? [] : table.columns
            },
            position: {
                x: (idx % cols) * 450,
                y: Math.floor(idx / cols) * (viewType === 'relationships' ? 150 : (table.columns?.length * 28 + 120))
            },
        }));

        const newEdges = schema.relationships.map((rel, idx) => {
            const isMain = viewType === 'relationships';
            return {
                id: `e-${idx}`,
                source: rel.fromTable,
                sourceHandle: isMain ? 'source-main' : `source-${rel.fromField.trim()}`,
                target: rel.toTable,
                targetHandle: isMain ? 'target-main' : `target-${rel.toField.trim()}`,
                label: viewType === 'fks' ? rel.name : '',
                animated: true,
                style: { stroke: '#3f51b5', strokeWidth: 3 },
                type: 'smoothstep',
                markerEnd: {
                    type: 'arrowclosed',
                    color: '#3f51b5',
                    width: 20,
                    height: 20
                },
            };
        });

        setNodes(newNodes);
        setEdges(newEdges);
    }, [schema, viewType]);

    return (
        <Box sx={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                defaultEdgeOptions={{
                    style: { strokeWidth: 3, stroke: '#3f51b5' },
                    type: 'smoothstep'
                }}
            >
                <Background variant="dots" gap={12} size={1} />
                <Controls />
                <MiniMap zoomable pannable />
            </ReactFlow>
        </Box>
    );
};

export default ERDiagram;
