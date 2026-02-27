const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const protect = require('../middleware/auth');

router.post('/', protect, async (req, res) => {
    try {
        const { base64, filename, fileType } = req.body;
        if (!base64) return res.status(400).json({ message: 'No file data provided' });

        // Remove header if present (e.g., data:image/png;base64,)
        const base64Data = base64.replace(/^data:.*?;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        const fileName = `${Date.now()}_${filename || 'upload'}`;
        const filePath = path.join(__dirname, '../uploads', fileName);

        fs.writeFileSync(filePath, buffer);

        // Construct the full URL
        const protocol = req.protocol;
        const host = req.get('host');
        const fileUrl = `${protocol}://${host}/uploads/${fileName}`;

        res.json({ url: fileUrl });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: 'Upload failed', error: err.message });
    }
});

module.exports = router;
