const express = require('express');
const cron = require('node-cron');
const protect = require('../middleware/auth');
const Schedule = require('../models/Schedule');
const router = express.Router();

router.get('/', protect, async (req, res) => {
  res.json(await Schedule.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']]
  }));
});

router.post('/', protect, async (req, res) => {
  const { name, message, contacts, targetGroups, mediaUrl, cronExpr, isRecurring, scheduledAt } = req.body;

  if (isRecurring && cronExpr && !cron.validate(cronExpr))
    return res.status(400).json({ message: 'Invalid cron expression' });

  const schedule = await Schedule.create({
    userId: req.user.id,
    isSuper: req.user.role === 'superadmin',
    name, message, contacts, targetGroups, mediaUrl, cronExpr, isRecurring, scheduledAt
  });
  const startScheduleCron = req.app.get('startScheduleCron');
  if (startScheduleCron) startScheduleCron(schedule, req.app.get('whatsappClient'));
  res.status(201).json(schedule);
});

router.put('/:id', protect, async (req, res) => {
  await Schedule.update(req.body, { where: { id: req.params.id, userId: req.user.id } });
  const schedule = await Schedule.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!schedule) return res.status(404).json({ message: 'Not found' });
  const startScheduleCron = req.app.get('startScheduleCron');
  if (startScheduleCron) startScheduleCron(schedule, req.app.get('whatsappClient'));
  res.json(schedule);
});

router.patch('/:id/toggle', protect, async (req, res) => {
  const schedule = await Schedule.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!schedule) return res.status(404).json({ message: 'Not found' });
  // Toggling only pauses/resumes FUTURE scheduled triggers.
  // Any messages currently being sent will complete regardless.
  schedule.active = !schedule.active;
  await schedule.save();
  const startScheduleCron = req.app.get('startScheduleCron');
  if (startScheduleCron) startScheduleCron(schedule, req.app.get('whatsappClient'));
  res.json(schedule);
});

router.delete('/:id', protect, async (req, res) => {
  // Deleting stops FUTURE cron triggers only.
  // If messages are currently being sent in this run, they will complete.
  const activeCrons = req.app.get('activeCrons');
  if (activeCrons?.[req.params.id]) {
    if (typeof activeCrons[req.params.id].stop === 'function') activeCrons[req.params.id].stop();
    else clearTimeout(activeCrons[req.params.id]);
    delete activeCrons[req.params.id];
  }
  await Schedule.destroy({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ message: 'Deleted. Any in-progress message batch will finish sending.' });
});

module.exports = router;
