const axios = require('axios');

/**
 * Syncs user data to Google Sheets via Apps Script Web App
 * @param {Object} user - User object from DB
 */
const syncToSheets = async (user) => {
    const scriptUrl = process.env.GOOGLE_SHEETS_SYNC_URL;
    if (!scriptUrl) return;

    let targetSheet = '';
    let parentEmail = 'None';

    // Logic based on explicit DB role OR legacy Fallbacks
    if (user.role === 'admin' || user.role === 'superadmin' || user.isAdmin) {
        targetSheet = 'Admin';
    } else if (user.role === 'subaccount' || user.parentId !== null) {
        targetSheet = 'Sub Acc';
    } else {
        targetSheet = 'Users';
    }

    if (user.parentId !== null) {
        // Sub-accounts (Managed by an Admin)
        targetSheet = 'Sub Acc';
        try {
            const { User } = require('../models');
            const parent = await User.findByPk(user.parentId);
            if (parent) parentEmail = `${parent.name} (${parent.email})`;
        } catch (e) { /* ignore */ }
    }

    const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.isAdmin ? 'Admin' : (user.role === 'superadmin' ? 'SuperAdmin' : 'User'),
        subStatus: user.subStatus,
        subExpiry: user.subExpiry,
        createdAt: user.createdAt,
        whatsappNumber: user.whatsappNumber, // primary contact number
        managedBy: parentEmail // New field to show who owns this sub-account
    };

    try {
        // Sync to specific targetSheet (Admin, Users, or Sub Acc)
        await axios.post(scriptUrl, {
            action: 'upsertUser',
            sheetName: targetSheet,
            userData: payload
        });
        console.log(`Synced ${user.email} to ${targetSheet} sheet`);
    } catch (error) {
        console.error(`Sync Error [${user.email}]:`, error.message);
    }
};

module.exports = syncToSheets;
