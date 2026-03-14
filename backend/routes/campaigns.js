const express = require('express');
const protect = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const { MessageMedia } = require('whatsapp-web.js');
const router = express.Router();

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── In-memory set of actively running campaign IDs ──────────────
// Once a campaign is in here, it CANNOT be stopped by delete/stop
const runningCampaigns = new Set();

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
    isSuper: req.user.role === 'superadmin',
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

  const client = req.app.get('getClientForUser')(req.user.id, campaign.isSuper);
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });
  if (campaign.status === 'running') return res.status(400).json({ message: 'Already running' });

  campaign.status = 'running';
  campaign.startedAt = new Date();
  campaign.sent = 0;
  campaign.failed = 0;
  await campaign.save();

  // Mark as protected — cannot be stopped externally while sending
  runningCampaigns.add(campaign.id);
  res.json({ message: 'Campaign started' });

  // Background execution — runs until ALL messages sent, regardless of delete/stop
  (async () => {
    const Contact = require('../models/Contact');
    const GlobalVar = require('../models/GlobalVar');

    const globalVars = await GlobalVar.findAll({ where: { userId: campaign.userId } });
    const phoneList = Array.isArray(campaign.contacts)
      ? campaign.contacts
      : (typeof campaign.contacts === 'string' ? JSON.parse(campaign.contacts || '[]') : []);

    const results = [];

    for (const phone of phoneList) {
      let contact = null;
      try {
        const chatId = `${phone}@c.us`;
        console.log(`Sending message to: ${chatId}`);

        contact = await Contact.findOne({ where: { userId: campaign.userId, phone } });
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
        results.push({ phone, name: contact ? contact.name : 'Unknown', status: 'sent', time: new Date() });
      } catch (err) {
        console.error('Send error:', err.message);
        campaign.failed += 1;
        results.push({ phone, name: contact ? contact.name : 'Unknown', status: 'failed', error: err.message, time: new Date() });
      }
      campaign.set('results', results);
      await campaign.save();
      await sleep(campaign.delay * 1000);
    }

    // Done — remove from protected set and finalize
    runningCampaigns.delete(campaign.id);
    campaign.status = campaign.failed === campaign.total ? 'failed' : 'completed';
    campaign.finishedAt = new Date();
    await campaign.save();
  })();
});

// Stop — blocked if campaign is actively sending
router.post('/:id/stop', protect, async (req, res) => {
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!campaign) return res.status(404).json({ message: 'Not found' });

  if (runningCampaigns.has(campaign.id)) {
    return res.status(400).json({ message: '⚠️ Campaign is actively sending. It will complete all messages before stopping.' });
  }

  await Campaign.update(
    { status: 'failed', finishedAt: new Date() },
    { where: { id: req.params.id, userId: req.user.id } }
  );
  res.json(await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } }));
});

// Delete — blocked if campaign is actively sending
router.delete('/:id', protect, async (req, res) => {
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!campaign) return res.status(404).json({ message: 'Not found' });

  if (runningCampaigns.has(campaign.id)) {
    return res.status(400).json({ message: '⚠️ Campaign is actively sending. It cannot be deleted until all messages are delivered.' });
  }

  await Campaign.destroy({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ message: 'Deleted' });
});

// Resend
router.post('/:id/resend', protect, async (req, res) => {
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!campaign) return res.status(404).json({ message: 'Not found' });
  if (campaign.status === 'running') return res.status(400).json({ message: 'Campaign already running' });
  if (campaign.status === 'draft') return res.status(400).json({ message: 'Use Start for draft campaigns' });

  const client = req.app.get('getClientForUser')(req.user.id, req.user.role === 'superadmin');
  if (!client) return res.status(400).json({ message: 'WhatsApp not connected' });

  campaign.status = 'running';
  campaign.startedAt = new Date();
  campaign.finishedAt = null;
  campaign.sent = 0;
  campaign.failed = 0;
  await campaign.save();

  runningCampaigns.add(campaign.id);
  res.json({ message: 'Campaign resending' });

  (async () => {
    const Contact = require('../models/Contact');
    const GlobalVar = require('../models/GlobalVar');
    const globalVars = await GlobalVar.findAll({ where: { userId: campaign.userId } });
    const phoneList = Array.isArray(campaign.contacts)
      ? campaign.contacts
      : (typeof campaign.contacts === 'string' ? JSON.parse(campaign.contacts || '[]') : []);

    const results = [];

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
          personalizedMsg = personalizedMsg.replace(/\{\{phone\}\}/gi, contact.phone || phone);

          if (contact.variables) {
            for (const [key, value] of Object.entries(contact.variables)) {
              const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
              personalizedMsg = personalizedMsg.replace(regex, value || '');
            }
          }
        } else {
          personalizedMsg = personalizedMsg.replace(/\{\{name\}\}/gi, 'Friend');
          personalizedMsg = personalizedMsg.replace(/\{\{phone\}\}/gi, phone);
        }

        if (campaign.mediaUrl) {
          const media = await MessageMedia.fromUrl(campaign.mediaUrl);
          await client.sendMessage(chatId, media, { caption: personalizedMsg });
        } else {
          await client.sendMessage(chatId, personalizedMsg);
        }
        campaign.sent += 1;
        results.push({ phone, name: contact ? contact.name : 'Unknown', status: 'sent', time: new Date() });
      } catch (err) {
        console.error('Resend error:', err.message);
        campaign.failed += 1;
        results.push({ phone, name: contact ? contact.name : 'Unknown', status: 'failed', error: err.message, time: new Date() });
      }
      campaign.set('results', results);
      await campaign.save();
      await sleep(campaign.delay * 1000);
    }

    runningCampaigns.delete(campaign.id);
    campaign.status = campaign.failed === campaign.total ? 'failed' : 'completed';
    campaign.finishedAt = new Date();
    await campaign.save();
  })();
});

module.exports = router;
