const Automation = require('../models/Automation');
const AutomationStep = require('../models/AutomationStep');
const AutomationLog = require('../models/AutomationLog');
const { MessageMedia } = require('whatsapp-web.js');

const runAutomation = async (automationId, getClient) => {
    try {
        const automation = await Automation.findByPk(automationId);
        if (!automation || automation.status === 'paused') {
            console.log('Automation is paused or missing. Cannot start.');
            return;
        }

        const steps = await AutomationStep.findAll({
            where: { automationId },
            order: [['stepOrder', 'ASC']]
        });
        if (!steps.length) return;

        console.log(`🚀 Starting Automation: ${automation.name}`);

        let targetGroups = automation.targetGroups;
        if (typeof targetGroups === 'string') {
            try {
                targetGroups = JSON.parse(targetGroups);
            } catch (e) {
                console.error("Error parsing targetGroups:", targetGroups);
                targetGroups = [];
            }
        }

        if (!Array.isArray(targetGroups)) targetGroups = [];

        // Execute for each group in parallel or sequentially. We choose sequentially grouping for stability over WP.
        for (const groupId of targetGroups) {
            console.log(`Executing automation for group: ${groupId}`);

            for (const step of steps) {
                // Check if automation was paused midway
                const checkStatus = await Automation.findByPk(automationId);
                if (checkStatus.status === 'paused') {
                    console.log('Automation paused midway.');
                    return;
                }

                if (step.actionType === 'delay') {
                    let delayMs = 0;

                    if (step.delayOption === 'exact_time' && step.delayUntilDate) {
                        delayMs = new Date(step.delayUntilDate).getTime() - Date.now();
                        if (delayMs < 0) delayMs = 0; // if time passed, don't wait
                        console.log(`Waiting until exact specific time: ${new Date(step.delayUntilDate).toLocaleString()}...`);
                    } else {
                        const value = step.delayValue || step.delayMinutes || 0;
                        if (step.delayUnit === 'days') delayMs = value * 24 * 60 * 60 * 1000;
                        else if (step.delayUnit === 'hours') delayMs = value * 60 * 60 * 1000;
                        else delayMs = value * 60 * 1000;
                        console.log(`Waiting for ${value} ${step.delayUnit || 'minutes'}...`);
                    }

                    // Create pending log
                    await AutomationLog.create({ automationId, groupId, stepId: step.id, status: 'success' });
                    if (delayMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }
                else if (step.actionType === 'send_message') {
                    // getClient here is a function passed from the router: req.app.get('whatsappClient')
                    // WHICH ITSELF RETURNS A FUNCTION in server.js! So we need to call it again.
                    // Wait, `req.app.get('whatsappClient')` returns `function getClient() { return waClient; }`
                    // So getClient itself is that function. `const client = getClient();` should work. Let me check the whatsapp-web.js API.

                    let client;
                    if (typeof getClient === 'function') {
                        client = getClient();
                    } else {
                        client = getClient; // fallback if it's the direct object
                    }

                    if (!client) {
                        console.error('WhatsApp client not ready for automation.');
                        await AutomationLog.create({ automationId, groupId, stepId: step.id, status: 'failed', error: 'WhatsApp disconnected' });
                        continue;
                    }

                    try {
                        let media = null;
                        if (step.mediaUrl) {
                            try { media = await MessageMedia.fromUrl(step.mediaUrl); }
                            catch (e) { console.error('Media load error:', e.message); }
                        }

                        if (media) {
                            await client.sendMessage(groupId, media, { caption: step.message });
                        } else {
                            await client.sendMessage(groupId, step.message);
                        }

                        // Success log
                        await AutomationLog.create({ automationId, groupId, stepId: step.id, status: 'success' });
                        console.log(`Message sent to ${groupId}`);

                        // small delay between WP messages to avoid spam blocks
                        await new Promise(resolve => setTimeout(resolve, 3000));

                    } catch (err) {
                        console.error(`Failed to send message: ${err.message}`);
                        await AutomationLog.create({ automationId, groupId, stepId: step.id, status: 'failed', error: err.message });
                    }
                }
            } // end step loop
        } // end group loop

        // Complete Automation for One-Time Manual
        if (automation.triggerType === 'manual') {
            automation.status = 'completed';
        }
        automation.lastRunAt = new Date();
        await automation.save();
        console.log(`✅ Automation completed: ${automation.name}`);

    } catch (error) {
        console.error(`Automation Engine Error: ${error.message}`);
    }
};

module.exports = { runAutomation };
