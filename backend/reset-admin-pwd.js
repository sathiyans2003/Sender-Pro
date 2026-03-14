require('dotenv').config();
const { SuperAdmin } = require('./models');

async function updatePassword() {
    const admin = await SuperAdmin.findOne({ where: { email: 'smdigitalworks1@gmail.com' } });
    if (admin) {
        admin.password = 'smdigitalworks';
        await admin.save();
        console.log("Updated password to 'smdigitalworks'");
    } else {
        console.log("No superadmin found.");
    }
    process.exit();
}
updatePassword();
