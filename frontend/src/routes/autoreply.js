const express   = require('express');
const protect   = require('../middleware/auth');
const AutoReply = require('../models/AutoReply');
const router    = express.Router();

router.get('/', protect, async (req, res) => {
  res.json(await AutoReply.find({ userId: req.user.id }).sort('order'));
});

router.post('/', protect, async (req, res) => {
  const { trigger, triggerType, response, order } = req.body;
  const rule = await AutoReply.create({ userId: req.user.id, trigger, triggerType, response, order });
  res.status(201).json(rule);
});

router.put('/:id', protect, async (req, res) => {
  const rule = await AutoReply.findOneAndUpdate(
    { id: req.params.id, userId: req.user.id },
    req.body,
    { new: true }
  );
  if (!rule) return res.status(404).json({ message: 'Not found' });
  res.json(rule);
});

router.patch('/:id/toggle', protect, async (req, res) => {
  const rule = await AutoReply.findOne({ id: req.params.id, userId: req.user.id });
  if (!rule) return res.status(404).json({ message: 'Not found' });
  rule.active = !rule.active;
  await rule.save();
  res.json(rule);
});

router.delete('/:id', protect, async (req, res) => {
  await AutoReply.findOneAndDelete({ id: req.params.id, userId: req.user.id });
  res.json({ message: 'Deleted' });
});

module.exports = router;
