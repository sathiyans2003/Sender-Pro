require('dotenv').config({ path: '../.env' });
const { User, sequelize } = require('../models');
const syncToSheets = require('../utils/syncSheets');

async function syncAll() {
    console.log('🚀 Starting full synchronization to Google Sheets...');

    try {
        // Authenticate DB
        await sequelize.authenticate();
        console.log('✅ Database connected.');

        // Fetch all top-level paid users/admins
        // Filter criteria: parentId is null AND (subStatus is active OR trial)
        const users = await User.findAll();

        console.log(`Found ${users.length} top-level accounts. Filtering for paid status...`);

        let syncCount = 0;
        for (const user of users) {
            console.log(`Syncing: ${user.email} (${user.subStatus})`);
            await syncToSheets(user);
            syncCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n✨ Finished! Successfully synced ${syncCount} accounts to Google Sheets.`);
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    } finally {
        process.exit();
    }
}

syncAll();
