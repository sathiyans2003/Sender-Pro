const express = require('express');
const protect = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const { MessageMedia } = require('whatsapp-web.js');
const router = express.Router();

const sleep = ms => new Promise(r => setTimeout(r, ms));

router.get('/', protect, async (req, res) => {
  const campaigns = await Campaign.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']]
  });
  res.json(campaigns);
});

router.post('/', protect, async (req, res) => {
  const { name, message, contacts, delay, mediaUrl } = req.body;
  const campaign = await Campaign.create({
    userId: req.user.id,
    name, message, contacts,
    delay: delay || 3,
    mediaUrl: mediaUrl || '',
    total: contacts.length,
  });
  res.status(201).json(campaign);
});

router.post('/:id/start', protect, async (req, res) => {
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } });
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
    const Contact = require('../models/Contact');
    const GlobalVar = require('../models/GlobalVar');

    // Fetch Global Variables once for the campaign
    const globalVars = await GlobalVar.findAll({ where: { userId: campaign.userId } });

    // Parse contacts correctly (sometimes MySQL returns JSON as string)
    const phoneList = Array.isArray(campaign.contacts)
      ? campaign.contacts
      : (typeof campaign.contacts === 'string' ? JSON.parse(campaign.contacts || '[]') : []);

    for (const phone of phoneList) {
      try {
        const chatId = `${phone}@c.us`;
        console.log(`Sending message to: ${chatId}`);

        // Find contact to replace variables
        const contact = await Contact.findOne({ where: { userId: campaign.userId, phone } });
        let personalizedMsg = campaign.message;

        // 1. Replace Global Variables First
        for (const gv of globalVars) {
          const regex = new RegExp(`\\{\\{${gv.key}\\}\\}`, 'gi');
          personalizedMsg = personalizedMsg.replace(regex, gv.value);
        }

        // 2. Replace Contact Specific Variables
        if (contact) {
          // Replace {{name}}
          personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, contact.name || 'Friend');

          // Replace other variables if any
          if (contact.variables) {
            for (const [key, value] of Object.entries(contact.variables)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
              personalizedMsg = personalizedMsg.replace(regex, value || '');
            }
          }
        } else {
          personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, 'Friend');
        }

        if (campaign.mediaUrl) {
          const media = await MessageMedia.fromUrl(campaign.mediaUrl);
          await client.sendMessage(chatId, media, { caption: personalizedMsg });
        } else {
          await client.sendMessage(chatId, personalizedMsg);
        }
        campaign.sent += 1;
      } catch (err) {
        console.error('Send error full:', err);
        campaign.failed += 1;
      }
      await campaign.save();
      await sleep(campaign.delay * 1000);
    }
    campaign.status = campaign.failed === campaign.total ? 'failed' : 'completed';
    campaign.finishedAt = new Date();
    await campaign.save();
  })();
});

router.post('/:id/stop', protect, async (req, res) => {
  await Campaign.update(
    { status: 'failed', finishedAt: new Date() },
    { where: { id: req.params.id, userId: req.user.id } }
  );
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } });
  res.json(campaign);
});

router.delete('/:id', protect, async (req, res) => {
  await Campaign.destroy({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ message: 'Deleted' });
});

// ── Resend: only allowed if failed or completed ──────────────────────────────
router.post('/:id/resend', protect, async (req, res) => {
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  if (campaign.status === 'running') return res.status(400).json({ message: 'Campaign already running' });
  if (campaign.status === 'draft') return res.status(400).json({ message: 'Use Start for draft campaigns' });

  const client = req.app.get('whatsappClient')();
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });

  // Reset counters and restart
  campaign.status = 'running';
  campaign.startedAt = new Date();
  campaign.finishedAt = null;
  campaign.sent = 0;
  campaign.failed = 0;
  await campaign.save();
  res.json({ message: 'Campaign resending' });

  // Background execution (same as start)
  (async () => {
    const Contact = require('../models/Contact');
    const GlobalVar = require('../models/GlobalVar');
    const globalVars = await GlobalVar.findAll({ where: { userId: campaign.userId } });

    // Parse contacts correctly (sometimes MySQL returns JSON as string)
    const phoneList = Array.isArray(campaign.contacts)
      ? campaign.contacts
      : (typeof campaign.contacts === 'string' ? JSON.parse(campaign.contacts || '[]') : []);

    for (const phone of phoneList) {
      try {
        const chatId = `${phone}@c.us`;
        const contact = await Contact.findOne({ where: { userId: campaign.userId, phone } });
        let personalizedMsg = campaign.message;

        for (const gv of globalVars) {
          const regex = new RegExp(`\\{\\{${gv.key}\\}\\}`, 'gi');
          personalizedMsg = personalizedMsg.replace(regex, gv.value);
        }

        if (contact) {
          personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, contact.name || 'Friend');
          if (contact.variables) {
            for (const [key, value] of Object.entries(contact.variables)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
              personalizedMsg = personalizedMsg.replace(regex, value || '');
            }
          }
        } else {
          personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, 'Friend');
        }

        if (campaign.mediaUrl) {
          const media = await MessageMedia.fromUrl(campaign.mediaUrl);
          await client.sendMessage(chatId, media, { caption: personalizedMsg });
        } else {
          await client.sendMessage(chatId, personalizedMsg);
        }
        campaign.sent += 1;
      } catch (err) {
        console.error('Resend error:', err.message);
        campaign.failed += 1;
      }
      await campaign.save();
      await sleep(campaign.delay * 1000);
    }
    campaign.status = campaign.failed === campaign.total ? 'failed' : 'completed';
    campaign.finishedAt = new Date();
    await campaign.save();
  })();
});

module.exports = router;
