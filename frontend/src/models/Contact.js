const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:    { type: String, default: '' },
  phone:   { type: String, required: true },
  group:   { type: String, default: 'Default' },
  tags:    { type: [String], default: [] },
  source:  { type: String, enum: ['manual', 'import', 'group_grab'], default: 'manual' },
  createdAt: { type: Date, default: Date.now },
});

contactSchema.index({ userId: 1, phone: 1 }, { unique: true });
module.exports = mongoose.model('Contact', contactSchema);
