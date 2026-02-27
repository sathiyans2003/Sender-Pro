const express = require('express');
const protect = require('../middleware/auth');
const Contact = require('../models/Contact');
const router  = express.Router();

// GET all
router.get('/', protect, async (req, res) => {
  const { group, search } = req.query;
  const filter = { userId: req.user._id };
  if (group) filter.group = group;
  if (search) filter.$or = [
    { name:  { $regex: search, $options: 'i' } },
    { phone: { $regex: search, $options: 'i' } },
  ];
  const contacts = await Contact.find(filter).sort('-createdAt');
  res.json(contacts);
});

// GET groups list
router.get('/groups', protect, async (req, res) => {
  const groups = await Contact.distinct('group', { userId: req.user._id });
  res.json(groups);
});

// POST add one
router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, group, tags } = req.body;
    const contact = await Contact.create({ userId: req.user._id, name, phone, group, tags });
    res.status(201).json(contact);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Contact already exists' });
    res.status(500).json({ message: e.message });
  }
});

// POST bulk import
router.post('/bulk', protect, async (req, res) => {
  const { contacts, group } = req.body;
  const docs = contacts.map(c => ({
    ...c,
    group: c.group || group || 'Import',
    userId: req.user._id,
    source: 'import',
  }));
  const result = await Contact.insertMany(docs, { ordered: false }).catch(e => {
    return e.insertedDocs || [];
  });
  res.status(201).json({ imported: Array.isArray(result) ? result.length : result.insertedCount || 0 });
});

// PUT update
router.put('/:id', protect, async (req, res) => {
  const contact = await Contact.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    req.body,
    { new: true }
  );
  if (!contact) return res.status(404).json({ message: 'Not found' });
  res.json(contact);
});

// DELETE one
router.delete('/:id', protect, async (req, res) => {
  await Contact.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.json({ message: 'Deleted' });
});

// DELETE many
router.delete('/', protect, async (req, res) => {
  const { ids } = req.body;
  await Contact.deleteMany({ _id: { $in: ids }, userId: req.user._id });
  res.json({ message: `Deleted ${ids.length}` });
});

module.exports = router;
