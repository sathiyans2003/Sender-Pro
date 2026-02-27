const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/User');
const protect = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');
const router = express.Router();

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields required' });

    if (await User.findOne({ where: { email } }))
      return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, password });
    res.status(201).json({
      id: user.id, name: user.name, email: user.email, token: sign(user.id)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid email or password' });

    res.json({
      id: user.id, name: user.name, email: user.email, token: sign(user.id)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Me
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password reset token',
        message: message,
        html: `<h3>Password Reset</h3><p>You are receiving this email because you requested the reset of your password.</p><p>Please click the link below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a><br/><p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`
      });
      res.json({ message: 'Email sent' });
    } catch (err) {
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      console.log('Email could not be sent. Please check your SMTP configuration in the .env file.', err);
      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Reset Password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      where: {
        resetPasswordToken,
        resetPasswordExpire: { [Op.gt]: Date.now() }
      }
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
