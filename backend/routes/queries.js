const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { QUERIES_FILE } = require('../config/paths');

// Initial check for file existence
if (!fs.existsSync(QUERIES_FILE)) {
    try {
        fs.writeFileSync(QUERIES_FILE, JSON.stringify([]));
    } catch (err) {
        console.error('Failed to initialize queries file:', err);
    }
}

// Helper to read queries
const readQueries = () => {
    try {
        const data = fs.readFileSync(QUERIES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading queries:', error);
        return [];
    }
};

// Helper to write queries
const writeQueries = (queries) => {
    try {
        fs.writeFileSync(QUERIES_FILE, JSON.stringify(queries, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing queries:', error);
        return false;
    }
};

// GET /api/queries - List all queries
router.get('/', (req, res) => {
    const queries = readQueries();
    res.json({ success: true, data: queries });
});

// POST /api/queries - Create or update a query
router.post('/', (req, res) => {
    const { id, name, description, sql, dbType } = req.body;

    if (!name || !sql || !dbType) {
        return res.status(400).json({ success: false, message: 'Name, SQL and DB Type are required' });
    }

    const queries = readQueries();

    if (id) {
        // Update
        const index = queries.findIndex(q => q.id === id);
        if (index !== -1) {
            queries[index] = { ...queries[index], name, description, sql, dbType, updatedAt: new Date() };
        } else {
            return res.status(404).json({ success: false, message: 'Query not found' });
        }
    } else {
        // Create
        const newQuery = {
            id: uuidv4(),
            name,
            description,
            sql,
            dbType,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        queries.push(newQuery);
    }

    if (writeQueries(queries)) {
        res.json({ success: true, message: 'Query saved successfully' });
    } else {
        res.status(500).json({ success: false, message: 'Failed to save query' });
    }
});

// DELETE /api/queries/:id - Delete a query
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const queries = readQueries();
    const filtered = queries.filter(q => q.id !== id);

    if (queries.length === filtered.length) {
        return res.status(404).json({ success: false, message: 'Query not found' });
    }

    if (writeQueries(filtered)) {
        res.json({ success: true, message: 'Query deleted successfully' });
    } else {
        res.status(500).json({ success: false, message: 'Failed to delete query' });
    }
});

module.exports = router;
