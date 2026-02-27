const express = require('express');
const http = require('http');
const cors = require('cors');
const { sequelize } = require('./models');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'https://smonlineservice.shop', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'https://smonlineservice.shop' }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// ── Database Sync ──────────────────────────────────────────────
sequelize.sync({ alter: true })
  .then(() => console.log(`✅ ${sequelize.options.dialect.toUpperCase()} Database synced`))
  .catch(e => {
    console.error(`❌ ${sequelize.options.dialect.toUpperCase()} Database connection error:`, e.name, e.message);
    if (e.original) console.error(e.original);
  });

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/autoreply', require('./routes/autoreply'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/global-vars', require('./routes/globalVars'));
app.use('/api/automations', require('./routes/automations'));

// ── Serve Frontend ───────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/build')));

// ── WhatsApp State ───────────────────────────────────────────
let waClient = null;
let waStatus = 'disconnected';

function getClient() { return waClient; }
app.set('whatsappClient', getClient);

function broadcastStatus(data) {
  io.emit('whatsapp:status', data);
}

function initWhatsApp(userId = 'default') {
  if (waClient) {
    try { waClient.destroy(); } catch { }
    waClient = null;
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: `user_${userId}` }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
  });

  waStatus = 'connecting';
  broadcastStatus({ status: 'connecting' });

  waClient.on('qr', async (qr) => {
    const qrImg = await qrcode.toDataURL(qr);
    waStatus = 'qr';
    io.emit('whatsapp:qr', { qr: qrImg });
    broadcastStatus({ status: 'qr' });
  });

  waClient.on('ready', () => {
    waStatus = 'connected';
    const info = waClient.info;
    broadcastStatus({
      status: 'connected',
      phone: info.wid.user,
      name: info.pushname,
    });
    console.log('✅ WhatsApp ready:', info.wid.user);
  });

  waClient.on('disconnected', (reason) => {
    waStatus = 'disconnected';
    waClient = null;
    broadcastStatus({ status: 'disconnected', reason });
    console.log('❌ WhatsApp disconnected:', reason);
  });

  waClient.on('auth_failure', () => {
    waStatus = 'disconnected';
    waClient = null;
    broadcastStatus({ status: 'auth_failure' });
  });

  waClient.on('message', async (msg) => {
    io.emit('whatsapp:message', {
      from: msg.from,
      body: msg.body,
      time: msg.timestamp,
    });
    // Auto reply
    try {
      const AutoReply = require('./models/AutoReply');
      const rules = await AutoReply.findAll({ where: { active: true }, order: [['order', 'ASC']] });
      for (const rule of rules) {
        const body = (msg.body || '').toLowerCase();
        const matches =
          rule.triggerType === 'any' ? true :
            rule.triggerType === 'exact' ? body === rule.trigger.toLowerCase() :
              body.includes(rule.trigger.toLowerCase());

        if (matches) {
          if (rule.mediaUrl) {
            try {
              const media = await MessageMedia.fromUrl(rule.mediaUrl);
              await waClient.sendMessage(msg.from, media, { caption: rule.response });
            } catch (err) {
              console.error('Error sending auto-reply media:', err.message);
              await msg.reply(rule.response);
            }
          } else {
            await msg.reply(rule.response);
          }
          break; // Stop after first match
        }
      }
    } catch (err) { console.error('Auto reply error:', err.message) }
  });

  waClient.initialize();
}

// ── Socket.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('whatsapp:status', { status: waStatus });

  socket.on('whatsapp:connect', ({ userId }) => initWhatsApp(userId));

  socket.on('whatsapp:disconnect', async () => {
    if (waClient) {
      try { await waClient.logout(); } catch { }
      waClient = null;
    }
    waStatus = 'disconnected';
    broadcastStatus({ status: 'disconnected' });
  });
});

// ── Cron: load active schedules on startup ───────────────────
async function loadSchedules() {
  try {
    const Schedule = require('./models/Schedule');
    const Automation = require('./models/Automation');

    // Load existing old schedules
    const schedules = await Schedule.findAll({ where: { active: true } });
    schedules.forEach(s => startScheduleCron(s));

    console.log(`📅 Loaded ${schedules.length} old schedules`);

    // Automation Engine Scheduler (runs every minute to check for due automations)
    cron.schedule('* * * * *', async () => {
      try {
        const getClient = app.get('whatsappClient');
        const { Op } = require('sequelize');
        const automations = await Automation.findAll({
          where: {
            status: 'active',
            triggerType: 'schedule',
            scheduledAt: { [Op.lte]: new Date() } // Past or current time
          }
        });

        for (const auto of automations) {
          console.log(`⏰ Scheduler triggered automation: ${auto.name}`);
          const { runAutomation } = require('./utils/automationEngine');
          runAutomation(auto.id, getClient).catch(e => console.error(e));

          // mark as completed to avoid rerunning
          auto.status = 'completed';
          await auto.save();
        }
      } catch (err) {
        console.error('Automation Scheduler Error:', err.message);
      }
    });
  } catch { }
}

const activeCrons = {};

async function runScheduledJob(schedule) {
  const client = getClient();
  if (!client) return console.log('Sheduler: Client not ready');
  console.log(`🚀 Running schedule: ${schedule.name}`);

  // Prepare media if any
  let media = null;
  if (schedule.mediaUrl) {
    try { media = await MessageMedia.fromUrl(schedule.mediaUrl); }
    catch (e) { console.error('Error loading media:', e.message); }
  }

  // 1. Send to contacts
  for (const phone of (schedule.contacts || [])) {
    try {
      if (media) {
        await client.sendMessage(`${phone}@c.us`, media, { caption: schedule.message });
      } else {
        await client.sendMessage(`${phone}@c.us`, schedule.message);
      }
    } catch (err) {
      console.error(`Error sending scheduled msg to ${phone}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // 2. Send to groups
  for (const groupId of (schedule.targetGroups || [])) {
    try {
      if (media) {
        await client.sendMessage(groupId, media, { caption: schedule.message });
      } else {
        await client.sendMessage(groupId, schedule.message);
      }
    } catch (err) {
      console.error(`Error sending scheduled msg to group ${groupId}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  schedule.lastRun = new Date();
  schedule.runCount += 1;
  await schedule.save();
}

function startScheduleCron(schedule) {
  // Clear existing
  if (activeCrons[schedule.id]) {
    if (typeof activeCrons[schedule.id].stop === 'function') {
      activeCrons[schedule.id].stop();
    } else {
      clearTimeout(activeCrons[schedule.id]);
    }
    delete activeCrons[schedule.id];
  }

  if (!schedule.active) return;

  if (schedule.isRecurring) {
    if (schedule.cronExpr && cron.validate(schedule.cronExpr)) {
      activeCrons[schedule.id] = cron.schedule(schedule.cronExpr, () => runScheduledJob(schedule));
    }
  } else if (schedule.scheduledAt) {
    const delay = new Date(schedule.scheduledAt).getTime() - Date.now();
    if (delay > 0) {
      activeCrons[schedule.id] = setTimeout(async () => {
        await runScheduledJob(schedule);
        schedule.active = false;
        await schedule.save();
        delete activeCrons[schedule.id];
      }, delay);
    }
  }
}
app.set('activeCrons', activeCrons);
app.set('startScheduleCron', startScheduleCron);

// ── Wait for DB to load schedules
sequelize.authenticate().then(loadSchedules).catch(() => console.error('Failed to load schedules: DB down'));

// ── React Fallback ───────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Auto-start WhatsApp session on backend load (keeps it live always)
initWhatsApp('default');

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
