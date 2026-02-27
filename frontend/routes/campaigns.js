const express  = require('express');
const protect  = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const { MessageMedia } = require('whatsapp-web.js');
const router   = express.Router();

const sleep = ms => new Promise(r => setTimeout(r, ms));

router.get('/', protect, async (req, res) => {
  const campaigns = await Campaign.find({ userId: req.user._id }).sort('-createdAt');
  res.json(campaigns);
});

router.post('/', protect, async (req, res) => {
  const { name, message, contacts, delay, mediaUrl } = req.body;
  const campaign = await Campaign.create({
    userId: req.user._id,
    name, message, contacts,
    delay: delay || 3,
    mediaUrl: mediaUrl || '',
    total: contacts.length,
  });
  res.status(201).json(campaign);
});

router.post('/:id/start', protect, async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
  if (!campaign) return res.status(404).json({ message: 'Not found' });

  const client = req.app.get('whatsappClient')();
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });
  if (campaign.status === 'running') return res.status(400).json({ message: 'Already running' });

  campaign.status = 'running';
  campaign.startedAt = new Date();
  campaign.sent = 0;
  campaign.failed = 0;
  await campaign.save();
  res.json({ message: 'Campaign started' });

  // Background execution
  (async () => {
    for (const phone of campaign.contacts) {
      try {
        const chatId = `${phone}@c.us`;
        if (campaign.mediaUrl) {
          const media = await MessageMedia.fromUrl(campaign.mediaUrl);
          await client.sendMessage(chatId, media, { caption: campaign.message });
        } else {
          await client.sendMessage(chatId, campaign.message);
        }
        campaign.sent += 1;
      } catch {
        campaign.failed += 1;
      }
      await campaign.save();
      await sleep(campaign.delay * 1000);
    }
    campaign.status = 'completed';
    campaign.finishedAt = new Date();
    await campaign.save();
  })();
});

router.post('/:id/stop', protect, async (req, res) => {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { status: 'failed', finishedAt: new Date() },
    { new: true }
  );
  res.json(campaign);
});

router.delete('/:id', protect, async (req, res) => {
  await Campaign.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  res.json({ message: 'Deleted' });
});

module.exports = router;
