const mongoose = require('mongoose');

const handoverSchema = new mongoose.Schema({
  position: { type: String, required: true, trim: true },
  session: { type: String, required: true, trim: true },
  outgoingExec: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  incomingExec: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'], default: 'DRAFT' },
  sections: {
    responsibilities: { type: String, trim: true },
    ongoingProjects: { type: String, trim: true },
    keyContacts: { type: String, trim: true },
    accessAndPasswords: { type: String, trim: true },
    adviceAndTips: { type: String, trim: true },
    pendingIssues: { type: String, trim: true },
    resources: { type: String, trim: true }
  },
  acknowledgedAt: { type: Date },
  submittedAt: { type: Date }
}, { timestamps: true });

handoverSchema.index({ position: 1, session: 1 });
handoverSchema.index({ outgoingExec: 1 });
handoverSchema.index({ status: 1 });

module.exports = mongoose.model('Handover', handoverSchema);
