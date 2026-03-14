// routes/groups.js
const express = require('express');
const protect = require('../middleware/auth');
const Contact = require('../models/Contact');
const router = express.Router();

router.get('/', protect, async (req, res) => {
  const client = req.app.get('getClientForUser')(req.user.id, req.user.role === 'superadmin');
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });
  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup).map(g => ({
      id: g.id._serialized,
      name: g.name,
      participantCount: g.groupMetadata?.participants?.length || g.participants?.length || 0,
      description: g.description || '',
    }));
    res.json(groups);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/:groupId/participants', protect, async (req, res) => {
  const client = req.app.get('getClientForUser')(req.user.id, req.user.role === 'superadmin');
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });
  try {
    const chat = await client.getChatById(req.params.groupId);
    const participants = chat.participants.map(p => ({
      phone: p.id.user,
      isAdmin: p.isAdmin,
      isSuperAdmin: p.isSuperAdmin,
    }));
    res.json(participants);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Save group participants as contacts
router.post('/:groupId/save', protect, async (req, res) => {
  const client = req.app.get('getClientForUser')(req.user.id, req.user.role === 'superadmin');
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });
  try {
    const chat = await client.getChatById(req.params.groupId);
    const docs = chat.participants.map(p => ({
      userId: req.user.id,
      phone: p.id.user,
      group: chat.name,
      source: 'group_grab',
    }));
    const result = await Contact.bulkCreate(docs, { ignoreDuplicates: true });
    res.json({ saved: result.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
