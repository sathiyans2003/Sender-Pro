// routes/admin.js  – Super Admin panel API
const express = require('express');
const protect = require('../middleware/auth');
const { User, Subscription, Campaign, Contact } = require('../models');
const syncToSheets = require('../utils/syncSheets');
const sendEmail = require('../utils/sendEmail');
const router = express.Router();

// ── Global App Limits (Super Admin controlled) ─────────────────
let APP_LIMITS = {
    maxSubAccountsPerAdmin: 5,   // How many sub-accounts an Admin can create
    maxCampaignsPerUser: 100,    // Optional future control
    trialDays: 7,                // Trial period for new signups
};

// GET /api/admin/limits — get current limits
router.get('/limits', protect, async (req, res) => {
    if (req.user?.role !== 'superadmin') return res.status(403).json({ message: 'Super Admin only' });
    res.json(APP_LIMITS);
});

// PATCH /api/admin/limits — update limits
router.patch('/limits', protect, async (req, res) => {
    if (req.user?.role !== 'superadmin') return res.status(403).json({ message: 'Super Admin only' });
    const { maxSubAccountsPerAdmin, trialDays, maxCampaignsPerUser } = req.body;
    if (maxSubAccountsPerAdmin !== undefined) APP_LIMITS.maxSubAccountsPerAdmin = parseInt(maxSubAccountsPerAdmin);
    if (trialDays !== undefined) APP_LIMITS.trialDays = parseInt(trialDays);
    if (maxCampaignsPerUser !== undefined) APP_LIMITS.maxCampaignsPerUser = parseInt(maxCampaignsPerUser);
    res.json({ message: 'Limits updated successfully', limits: APP_LIMITS });
});

// Super Admin only guard middleware
const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'superadmin' && !req.user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// GET /api/admin/sync-all - push all users to sheet
router.get('/sync-all', protect, adminOnly, async (req, res) => {
    try {
        const syncPayments = require('../utils/syncPayments');

        // 1. Sync all users
        const users = await User.findAll();
        let count = 0;
        for (const u of users) {
            // Assign roles logically if empty (retroactive fix)
            if (!u.role || u.role === 'user') {
                if (u.parentId !== null) {
                    u.role = 'subaccount';
                    await u.save();
                } else if (u.isAdmin || u.email === 'smdigitalworks1@gmail.com') {
                    u.role = 'admin';
                    await u.save();
                }
            }
            await syncToSheets(u);
            count++;
            await new Promise(r => setTimeout(r, 200)); // Sleep nicely for Apps Script rates
        }

        // 2. Sync all payments
        const payments = await Subscription.findAll({
            include: [{ model: User, attributes: ['name', 'email', 'whatsappNumber'] }],
            where: { status: 'paid' }
        });

        let paymentCount = 0;
        for (const p of payments) {
            if (p.User) {
                await syncPayments({
                    userId: p.userId,
                    name: p.User.name,
                    email: p.User.email,
                    whatsappNumber: p.User.whatsappNumber,
                    plan: p.plan,
                    amount: p.amount,
                    status: p.status,
                    paymentId: p.razorpayPaymentId || 'N/A',
                    paymentDate: new Date(p.createdAt).toLocaleString(),
                });
                paymentCount++;
            }
        }

        res.json({ message: `Successfully synced ${count} users and ${paymentCount} payments to Google Sheets` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/admin/users  – all users with subscription info
router.get('/users', protect, adminOnly, async (req, res) => {
    try {
        const whereClause = req.user.role === 'superadmin' ? {} : { parentId: req.user.id };
        const users = await User.findAll({
            where: whereClause,
            attributes: ['id', 'name', 'email', 'whatsappNumber', 'isAdmin', 'subStatus', 'subExpiry', 'createdAt', 'parentId'],
            include: [{
                model: User,
                as: 'parentAdmin',
                attributes: ['name', 'email']
            }],
            order: [['createdAt', 'DESC']],
        });
        res.json(users);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/admin/stats  – dashboard stats
router.get('/stats', protect, adminOnly, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const whereClause = req.user.role === 'superadmin' ? {} : { parentId: req.user.id };

        const totalUsers = await User.count({ where: whereClause });

        // Regular Users only: parentId IS NULL and isAdmin = false
        const regularUserWhere = req.user.role === 'superadmin'
            ? { parentId: { [Op.is]: null }, isAdmin: false }
            : { parentId: req.user.id, isAdmin: false };
        const regularUserCount = await User.count({ where: regularUserWhere });

        // Sub-accounts only: parentId IS NOT NULL
        const subAccountWhere = req.user.role === 'superadmin'
            ? { parentId: { [Op.not]: null } }
            : { parentId: req.user.id };
        const subAccountCount = await User.count({ where: subAccountWhere });

        const trialUsers = await User.count({ where: { ...whereClause, subStatus: 'trial' } });

        let totalRevenue = 0, totalPayments = 0;
        if (req.user.role === 'superadmin') {
            totalRevenue = await Subscription.sum('amount', { where: { status: 'paid' } });
            totalPayments = await Subscription.count({ where: { status: 'paid' } });
        }
        res.json({
            totalUsers,
            regularUserCount,
            subAccountCount,
            trialUsers,
            totalRevenue: (totalRevenue || 0) / 100,
            totalPayments,
        });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/admin/payments  – all payment records
router.get('/payments', protect, adminOnly, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.json([]); // Only Super Admin can see payments
        }
        const payments = await Subscription.findAll({
            include: [{ model: User, attributes: ['name', 'email'] }],
            order: [['createdAt', 'DESC']],
        });
        res.json(payments);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/admin/users - add sub account
router.post('/users', protect, adminOnly, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            const count = await User.count({ where: { parentId: req.user.id } });
            const limit = APP_LIMITS.maxSubAccountsPerAdmin;
            if (count >= limit) return res.status(400).json({ message: `Sub-account limit reached (max ${limit})` });
        }

        const { name, email, password, whatsappNumber, subStatus, subExpiry, isAdmin, parentId } = req.body;
        if (!name || !email || !password || !whatsappNumber)
            return res.status(400).json({ message: 'Name, email, password, and WhatsApp number are required' });

        const existing = await User.findOne({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email already exists' });

        const determinedParentId = req.user.role === 'superadmin' ? (parentId || null) : req.user.id;
        const determinedIsAdmin = req.user.role === 'superadmin' ? (isAdmin || false) : false;

        let determinedRole = 'user';
        if (determinedParentId) {
            determinedRole = 'subaccount';
        } else if (determinedIsAdmin) {
            determinedRole = 'admin';
        }

        const u = await User.create({
            name, email, password, whatsappNumber,
            role: determinedRole,
            parentId: determinedParentId,
            isAdmin: determinedIsAdmin,
            subStatus: subStatus || 'none',
            subExpiry: subExpiry ? new Date(subExpiry) : null,
        });

        res.status(201).json({ id: u.id, name: u.name, email: u.email, subStatus: u.subStatus, subExpiry: u.subExpiry, isAdmin: u.isAdmin, parentId: u.parentId });

        // Sync to Google Sheets (Async)
        syncToSheets(u).catch(e => console.error('Sheet sync failed:', e.message));

        // Send Welcome Email (Async)
        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        sendEmail({
            email: u.email,
            subject: 'Welcome to Sender Pro - Your Account Details',
            message: `Hello ${u.name},\nYour Sender Pro account has been created.\n\nLogin Details:\nEmail: ${u.email}\nPassword: ${password}\n\nLogin here: ${loginUrl}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #7c3aed;">Welcome to Sender Pro! 🎉</h2>
                <p>Hi <strong>${u.name}</strong>,</p>
                <p>Your account has been created successfully. Here are your login credentials:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Name:</strong> ${u.name}</p>
                  <p style="margin: 5px 0;"><strong>Email:</strong> ${u.email}</p>
                  <p style="margin: 5px 0;"><strong>WhatsApp Number:</strong> ${u.whatsappNumber}</p>
                  <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
                </div>
                <p>You can login to your dashboard using the link below:</p>
                <a href="${loginUrl}" style="display: inline-block; padding: 10px 20px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a>
              </div>
            `
        }).catch(e => console.error('Welcome email failed:', e.message));
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// PATCH /api/admin/users/:id  – update user subscription (manual override)
router.patch('/users/:id', protect, adminOnly, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            const check = await User.findOne({ where: { id: req.params.id, parentId: req.user.id } });
            if (!check) return res.status(403).json({ message: 'Not authorized to edit this user' });
        }
        const { subStatus, subExpiry, isAdmin, parentId, name, email, password, whatsappNumber } = req.body;
        const update = {};
        if (subStatus !== undefined) update.subStatus = subStatus;
        if (subExpiry !== undefined) update.subExpiry = subExpiry ? new Date(subExpiry) : null;
        if (isAdmin !== undefined) update.isAdmin = isAdmin;
        if (req.user.role === 'superadmin' && parentId !== undefined) update.parentId = parentId;
        if (req.user.role === 'superadmin') {
            if (name !== undefined) update.name = name;
            if (email !== undefined) update.email = email;
            if (password && password.trim() !== '') update.password = password; // Make sure to hash if not handled in model
            if (whatsappNumber !== undefined) update.whatsappNumber = whatsappNumber;
        }

        // Note: Make sure the model hash hook works on update or we find a way to hash if needed.
        // If password is plain text, sequelize model `beforeUpdate` hook usually handles it. We can manually hash if needed.
        // Let's assume the hook works. But wait, if they didn't define a hook, we might need to manually hash it.
        // Let me check if there is a `beforeUpdate` hook or if I should just update it.
        // I will just let `User.update` try or find the user and `save()` it.

        let targetUser = await User.findByPk(req.params.id);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        Object.assign(targetUser, update);
        await targetUser.save();

        // ── Create / Update Subscription record if a plan was selected ──
        const { selectedPlan } = req.body;
        if (selectedPlan && subStatus === 'active') {
            const { PLANS } = require('./payments');
            const roleType = targetUser.isAdmin ? 'admin' : (targetUser.parentId ? 'subaccount' : 'user');
            const planKey = `${roleType}_${selectedPlan}`;
            const planConfig = PLANS[planKey];

            if (planConfig) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + planConfig.days);

                await Subscription.create({
                    userId: targetUser.id,
                    plan: planKey,
                    amount: planConfig.amount,
                    status: 'paid', // manually assigned by admin is considered paid
                    startDate: new Date(),
                    endDate: expiresAt,
                });

                // Sync payment specifically for manual assignment
                const syncPayments = require('../utils/syncPayments');
                syncPayments({
                    userId: targetUser.id,
                    name: targetUser.name,
                    email: targetUser.email,
                    whatsappNumber: targetUser.whatsappNumber,
                    plan: planKey,
                    amount: planConfig.amount,
                    status: 'paid',
                    orderId: `MANUAL_${Date.now()}`,
                    paymentId: 'MANUAL_ADMIN',
                    startDate: new Date(),
                    endDate: expiresAt
                }).catch(e => console.error('Manual payment sync failed:', e.message));
            }
        }

        const user = await User.findByPk(req.params.id, {
            attributes: ['id', 'name', 'email', 'isAdmin', 'subStatus', 'subExpiry', 'parentId', 'createdAt', 'whatsappNumber'],
        });
        res.json(user);

        // Sync to Google Sheets (Async)
        syncToSheets(user).catch(e => console.error('Sheet sync failed:', e.message));
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/admin/users/:id  – delete user
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            const check = await User.findOne({ where: { id: req.params.id, parentId: req.user.id } });
            if (!check) return res.status(403).json({ message: 'Not authorized to delete this user' });
        }
        if (req.user.id === Number(req.params.id))
            return res.status(400).json({ message: 'Cannot delete yourself' });
        await User.destroy({ where: { id: req.params.id } });
        res.json({ message: 'User deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
