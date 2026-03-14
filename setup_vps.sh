#!/bin/bash
echo "======================================"
echo " Sender Pro VPS Setup Script"
echo "======================================"

# Step 1: Install missing Chromium libraries
echo ""
echo "📦 Step 1: Installing Chromium dependencies..."
apt-get install -y \
  libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2t64 \
  libpangocairo-1.0-0 libcairo2 libatspi2.0-0t64 \
  libgtk-3-0t64 libnss3 libx11-xcb1 libxcb-dri3-0 \
  2>/dev/null
echo "✅ Chromium dependencies installed!"

# Step 2: Clear stale WhatsApp sessions
echo ""
echo "🧹 Step 2: Clearing stale WhatsApp sessions..."
rm -rf /var/www/smonlineservice/backend/.wwebjs_auth
rm -rf /var/www/smonlineservice/backend/.wwebjs_cache
echo "✅ Sessions cleared!"

# Step 3: Restart PM2
echo ""
echo "🔄 Step 3: Restarting sender-pro..."
pm2 restart sender-pro
echo "✅ App restarted!"

# Step 4: Wait for server to start
echo ""
echo "⏳ Waiting 6 seconds for server to start..."
sleep 6

# Step 5: Create admin user
echo ""
echo "👤 Step 5: Creating admin user..."
RESULT=$(curl -s -X POST https://smonlineservice.shop/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@smonlineservice.shop","password":"Admin@123"}')
echo "API Response: $RESULT"

# Step 6: Show logs
echo ""
echo "📋 Step 6: PM2 Logs:"
pm2 logs sender-pro --lines 20 --nostream

echo ""
echo "======================================"
echo " ✅ Setup Complete!"
echo " Login: admin@smonlineservice.shop"
echo " Pass:  Admin@123"
echo "======================================"
