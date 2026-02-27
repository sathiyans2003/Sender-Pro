const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:      { type: String, required: true },
  message:   { type: String, required: true },
  mediaUrl:  { type: String, default: '' },
  contacts:  { type: [String], default: [] },
  status:    { type: String, enum: ['draft','running','completed','failed'], default: 'draft' },
  sent:      { type: Number, default: 0 },
  failed:    { type: Number, default: 0 },
  total:     { type: Number, default: 0 },
  delay:     { type: Number, default: 3 },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  finishedAt:{ type: Date },
});
module.exports = mongoose.model('Campaign', campaignSchema);
