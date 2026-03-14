const express = require('express');
const protect = require('../middleware/auth');
const AutoReply = require('../models/AutoReply');
const router = express.Router();

router.get('/', protect, async (req, res) => {
  res.json(await AutoReply.findAll({
    where: { userId: req.user.id },
    order: [['order', 'ASC']]
  }));
});

router.post('/', protect, async (req, res) => {
  const { trigger, triggerType, response, mediaUrl, order, delayHours } = req.body;
  const rule = await AutoReply.create({ userId: req.user.id, trigger, triggerType, response, mediaUrl, order, delayHours });
  res.status(201).json(rule);
});

router.put('/:id', protect, async (req, res) => {
  await AutoReply.update(req.body, { where: { id: req.params.id, userId: req.user.id } });
  const rule = await AutoReply.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!rule) return res.status(404).json({ message: 'Not found' });
  res.json(rule);
});

router.patch('/:id/toggle', protect, async (req, res) => {
  const rule = await AutoReply.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!rule) return res.status(404).json({ message: 'Not found' });
  rule.active = !rule.active;
  await rule.save();
  res.json(rule);
});

router.delete('/:id', protect, async (req, res) => {
  await AutoReply.destroy({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ message: 'Deleted' });
});

module.exports = router;
