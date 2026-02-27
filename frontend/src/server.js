const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const mongoose   = require('mongoose');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode     = require('qrcode');
const cron       = require('node-cron');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

// ── MongoDB ──────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/senderpro')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(e  => console.error('❌ MongoDB error:', e.message));

// ── Routes ──────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/contacts',  require('./routes/contacts'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/autoreply', require('./routes/autoreply'));
app.use('/api/schedule',  require('./routes/schedule'));
app.use('/api/groups',    require('./routes/groups'));
app.use('/api/dashboard', require('./routes/dashboard'));

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
    try { waClient.destroy(); } catch {}
    waClient = null;
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: `user_${userId}` }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
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
      const rules = await AutoReply.find({ active: true }).sort('order');
      for (const rule of rules) {
        const body = msg.body.toLowerCase();
        const matches =
          rule.triggerType === 'any'      ? true :
          rule.triggerType === 'exact'    ? body === rule.trigger.toLowerCase() :
          body.includes(rule.trigger.toLowerCase());
        if (matches) {
          await msg.reply(rule.response);
          break;
        }
      }
    } catch {}
  });

  waClient.initialize();
}

// ── Socket.IO ────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('whatsapp:status', { status: waStatus });

  socket.on('whatsapp:connect', ({ userId }) => initWhatsApp(userId));

  socket.on('whatsapp:disconnect', async () => {
    if (waClient) {
      try { await waClient.logout(); } catch {}
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
    const schedules = await Schedule.find({ active: true });
    schedules.forEach(s => startScheduleCron(s));
    console.log(`📅 Loaded ${schedules.length} schedules`);
  } catch {}
}

const activeCrons = {};
function startScheduleCron(schedule) {
  if (activeCrons[schedule.id]) activeCrons[schedule.id].destroy();
  if (!schedule.active || !cron.validate(schedule.cronExpr)) return;

  activeCrons[schedule.id] = cron.schedule(schedule.cronExpr, async () => {
    const client = getClient();
    if (!client) return;
    for (const phone of schedule.contacts) {
      try { await client.sendMessage(`${phone}@c.us`, schedule.message); } catch {}
      await new Promise(r => setTimeout(r, 3000));
    }
    schedule.lastRun = new Date();
    await schedule.save();
  });
}
app.set('activeCrons', activeCrons);
app.set('startScheduleCron', startScheduleCron);

mongoose.connection.once('open', loadSchedules);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
