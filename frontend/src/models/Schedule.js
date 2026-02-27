const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:      { type: String, required: true },
  message:   { type: String, required: true },
  contacts:  { type: [String], default: [] },
  cronExpr:  { type: String, required: true },
  active:    { type: Boolean, default: true },
  lastRun:   { type: Date },
  runCount:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Schedule', scheduleSchema);
