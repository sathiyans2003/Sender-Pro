const express = require('express');
const protect = require('../middleware/auth');
const Contact = require('../models/Contact');
const { Op, Sequelize } = require('sequelize');
const router = express.Router();

// GET all
router.get('/', protect, async (req, res) => {
  const { group, search } = req.query;
  const where = { userId: req.user.id };
  if (group) where.group = group;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }
  const contacts = await Contact.findAll({
    where,
    order: [['createdAt', 'DESC']]
  });
  res.json(contacts);
});

// GET groups list
router.get('/groups', protect, async (req, res) => {
  const groups = await Contact.findAll({
    attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('group')), 'group']],
    where: { userId: req.user.id }
  });
  res.json(groups.map(g => g.group));
});

// POST add one
router.post('/', protect, async (req, res) => {
  try {
    const { name, phone, group, tags } = req.body;
    const contact = await Contact.create({ userId: req.user.id, name, phone, group, tags });
    res.status(201).json(contact);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ message: 'Contact already exists' });
    res.status(500).json({ message: e.message });
  }
});

// POST bulk import
router.post('/bulk', protect, async (req, res) => {
  const { contacts, group } = req.body;
  const docs = contacts.map(c => ({
    ...c,
    group: c.group || group || 'Import',
    userId: req.user.id,
    source: 'import',
  }));
  try {
    const result = await Contact.bulkCreate(docs, { ignoreDuplicates: true });
    res.status(201).json({ imported: result.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT update
router.put('/:id', protect, async (req, res) => {
  await Contact.update(req.body, { where: { id: req.params.id, userId: req.user.id } });
  const contact = await Contact.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!contact) return res.status(404).json({ message: 'Not found' });
  res.json(contact);
});

// DELETE one
router.delete('/:id', protect, async (req, res) => {
  await Contact.destroy({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ message: 'Deleted' });
});

// DELETE many
router.delete('/', protect, async (req, res) => {
  const { ids } = req.body;
  await Contact.destroy({ where: { id: ids, userId: req.user.id } });
  res.json({ message: `Deleted ${ids.length}` });
});

// POST validate whatsapp status
router.post('/validate', protect, async (req, res) => {
  const { ids } = req.body;
  const client = req.app.get('whatsappClient')();
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });

  const contacts = await Contact.findAll({ where: { id: ids, userId: req.user.id } });
  const results = { valid: 0, invalid: 0 };

  for (const contact of contacts) {
    try {
      const isRegistered = await client.isRegisteredUser(`${contact.phone}@c.us`);
      contact.isWhatsApp = isRegistered;
      contact.lastValidated = new Date();
      await contact.save();
      if (isRegistered) results.valid++;
      else results.invalid++;
    } catch (e) {
      console.error(`Error validating ${contact.phone}:`, e.message);
    }
  }

  res.json({ message: 'Validation complete', ...results });
});

module.exports = router;
