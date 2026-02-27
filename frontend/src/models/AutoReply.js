const mongoose = require('mongoose');

const autoReplySchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trigger:     { type: String, required: true },
  triggerType: { type: String, enum: ['contains', 'exact', 'any'], default: 'contains' },
  response:    { type: String, required: true },
  active:      { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
  hitCount:    { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
});
module.exports = mongoose.model('AutoReply', autoReplySchema);
