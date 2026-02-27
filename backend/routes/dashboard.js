const express = require('express');
const protect = require('../middleware/auth');
const Contact = require('../models/Contact');
const Campaign = require('../models/Campaign');
const AutoReply = require('../models/AutoReply');
const Schedule = require('../models/Schedule');
const router = express.Router();

router.get('/stats', protect, async (req, res) => {
  const uid = req.user.id;
  const [contacts, campaigns, autoreplies, schedules] = await Promise.all([
    Contact.count({ where: { userId: uid } }),
    Campaign.findAll({ where: { userId: uid } }),
    AutoReply.count({ where: { userId: uid, active: true } }),
    Schedule.count({ where: { userId: uid, active: true } }),
  ]);
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const totalFailed = campaigns.reduce((s, c) => s + c.failed, 0);
  const running = campaigns.filter(c => c.status === 'running').length;
  const completed = campaigns.filter(c => c.status === 'completed').length;

  res.json({
    contacts,
    campaigns: campaigns.length,
    totalSent,
    totalFailed,
    running,
    completed,
    autoreplies,
    schedules,
  });
});

module.exports = router;
