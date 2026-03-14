const axios = require('axios');

/**
 * Syncs payment data to Google Sheets via Apps Script Web App
 * @param {Object} paymentInfo - Object containing payment/subscription info
 */
const syncPayments = async (paymentInfo) => {
    const scriptUrl = process.env.GOOGLE_SHEETS_SYNC_URL;
    if (!scriptUrl) return;

    // Payload for the payment entry
    // Usually Apps script handles properties blindly, 
    // but its `action: 'insertPayment'` might need to be supported by the apps script,
    // OR if the script just appends based on sheetName, we can pass action: 'upsertUser' or 'appendPayment'
    // Let's use 'upsertUser' but with different fields, as long as Apps script just dumps keys/values if it's dynamic, 
    // or we might need to conform to what Apps Script expects.
    // Assuming Apps Script writes userData blindly to columns matching the keys, 
    // or maybe the user has updated Apps Script. I will use action: 'upsertUser' just in case.

    try {
        await axios.post(scriptUrl, {
            action: 'upsertUser', // Or whatever your App Script maps. 'upsertUser' uses 'email' to find or add row by default.
            sheetName: 'Payment details',
            userData: {
                id: paymentInfo.userId, // Required if the script uses ID, otherwise email
                name: paymentInfo.name,
                email: paymentInfo.email,
                phone: paymentInfo.whatsappNumber,
                amount: paymentInfo.amount,
                paymentId: paymentInfo.paymentId,
                paymentDate: (new Date()).toLocaleString(),
                plan: paymentInfo.plan,
                status: paymentInfo.status
            }
        });
        console.log(`Synced payment for ${paymentInfo.email} to Payment details sheet`);
    } catch (error) {
        console.error(`Payment Sync Error [${paymentInfo.email}]:`, error.message);
    }
};

module.exports = syncPayments;
