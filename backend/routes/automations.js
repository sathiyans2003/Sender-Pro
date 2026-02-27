const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const Project = require('../models/Project');
const Automation = require('../models/Automation');
const AutomationStep = require('../models/AutomationStep');
const AutomationLog = require('../models/AutomationLog');
const { runAutomation } = require('../utils/automationEngine');

// ========================
// PROJECTS
// ========================

// Get all projects for user
router.get('/projects', protect, async (req, res) => {
    try {
        const projects = await Project.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        res.json(projects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create project
router.post('/projects', protect, async (req, res) => {
    try {
        const { name, description } = req.body;
        const project = await Project.create({ userId: req.user.id, name, description });
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// AUTOMATIONS
// ========================

// Get automations by project
router.get('/projects/:projectId/automations', protect, async (req, res) => {
    try {
        const automations = await Automation.findAll({
            where: { projectId: req.params.projectId, userId: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        const parsedAutomations = automations.map(a => {
            const autoJson = a.toJSON();
            if (typeof autoJson.targetGroups === 'string') {
                try { autoJson.targetGroups = JSON.parse(autoJson.targetGroups); }
                catch { autoJson.targetGroups = []; }
            }
            if (!Array.isArray(autoJson.targetGroups)) autoJson.targetGroups = [];
            return autoJson;
        });
        res.json(parsedAutomations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create automation
router.post('/projects/:projectId/automations', protect, async (req, res) => {
    try {
        const { name, triggerType, scheduledAt, targetGroups } = req.body;
        const automation = await Automation.create({
            userId: req.user.id,
            projectId: req.params.projectId,
            name,
            triggerType,
            scheduledAt,
            targetGroups
        });
        res.json(automation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single automation details (with steps)
router.get('/:id', protect, async (req, res) => {
    try {
        const automation = await Automation.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!automation) return res.status(404).json({ error: 'Not found' });

        const steps = await AutomationStep.findAll({
            where: { automationId: automation.id },
            order: [['stepOrder', 'ASC']]
        });
        const autoJson = automation.toJSON();
        if (typeof autoJson.targetGroups === 'string') {
            try { autoJson.targetGroups = JSON.parse(autoJson.targetGroups); }
            catch { autoJson.targetGroups = []; }
        }
        if (!Array.isArray(autoJson.targetGroups)) autoJson.targetGroups = [];

        res.json({ ...autoJson, steps });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save Automation Flow (Steps)
router.post('/:id/steps', protect, async (req, res) => {
    try {
        const { steps } = req.body; // Array of { actionType, message, mediaUrl, delayMinutes, stepOrder }
        const automationId = req.params.id;

        // Verify automation belongs to user
        const automation = await Automation.findOne({ where: { id: automationId, userId: req.user.id } });
        if (!automation) return res.status(404).json({ error: 'Automation not found' });

        // Delete existing steps and recreate for simplicity (or update them)
        await AutomationStep.destroy({ where: { automationId } });

        const cleanSteps = steps.map((s, idx) => {
            const stepData = { ...s, automationId, stepOrder: idx + 1 };
            if (!stepData.delayUntilDate) delete stepData.delayUntilDate;
            return stepData;
        });

        const createdSteps = await AutomationStep.bulkCreate(cleanSteps);

        res.json(createdSteps);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update target groups for automation
router.patch('/:id/groups', protect, async (req, res) => {
    try {
        const { targetGroups } = req.body;
        await Automation.update(
            { targetGroups },
            { where: { id: req.params.id, userId: req.user.id } }
        );
        const automation = await Automation.findOne({ where: { id: req.params.id, userId: req.user.id } });
        res.json(automation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Run Manual Trigger
router.post('/:id/run', protect, async (req, res) => {
    try {
        const automation = await Automation.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!automation) return res.status(404).json({ error: 'Automation not found' });

        automation.status = 'active';
        await automation.save();

        if (automation.triggerType === 'schedule') {
            res.json({ message: 'Automation activated & scheduled for later', automation });
        } else {
            // Non-blocking trigger
            const getClient = req.app.get('whatsappClient');
            runAutomation(automation.id, getClient).catch(err => console.error(err));
            res.json({ message: 'Automation Started Now', automation });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Pause / Update Status
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const { status } = req.body; // 'active', 'paused'
        await Automation.update(
            { status },
            { where: { id: req.params.id, userId: req.user.id } }
        );
        const automation = await Automation.findOne({ where: { id: req.params.id, userId: req.user.id } });
        res.json(automation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Trigger settings
router.patch('/:id/trigger', protect, async (req, res) => {
    try {
        const { triggerType, scheduledAt } = req.body;
        const updateData = { triggerType };
        updateData.scheduledAt = scheduledAt ? scheduledAt : null;

        await Automation.update(
            updateData,
            { where: { id: req.params.id, userId: req.user.id } }
        );
        const automation = await Automation.findOne({ where: { id: req.params.id, userId: req.user.id } });
        res.json(automation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
