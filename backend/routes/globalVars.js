const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const GlobalVar = require('../models/GlobalVar');

// GET all global vars for user
router.get('/', protect, async (req, res) => {
    try {
        const vars = await GlobalVar.findAll({ where: { userId: req.user.id } });
        res.json(vars);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create or update
router.post('/', protect, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || !value) return res.status(400).json({ message: 'Key and Value are required' });

        const searchKey = key.toLowerCase();
        let gvar = await GlobalVar.findOne({ where: { userId: req.user.id, key: searchKey } });
        if (gvar) {
            gvar.value = value;
            await gvar.save();
        } else {
            gvar = await GlobalVar.create({ userId: req.user.id, key: searchKey, value });
        }
        res.json(gvar);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE
router.delete('/:id', protect, async (req, res) => {
    try {
        await GlobalVar.destroy({ where: { id: req.params.id, userId: req.user.id } });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
