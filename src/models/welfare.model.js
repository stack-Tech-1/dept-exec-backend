const mongoose = require('mongoose');
const crypto = require('crypto');

const welfareSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    default: () => 'IESA-' + crypto.randomBytes(3).toString('hex').toUpperCase()
  },
  category: {
    type: String,
    enum: ['ACADEMIC', 'FINANCIAL', 'HARASSMENT', 'GENERAL', 'SUGGESTION'],
    required: true
  },
  subject: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  isAnonymous: { type: Boolean, default: false },
  submitterName: { type: String, trim: true },
  submitterMatric: { type: String, trim: true, uppercase: true },
  submitterEmail: { type: String, trim: true, lowercase: true },
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'],
    default: 'OPEN'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  responses: [{
    responder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    responderName: { type: String },
    message: { type: String, required: true, trim: true },
    isInternal: { type: Boolean, default: false }, // internal notes vs member-visible
    createdAt: { type: Date, default: Date.now },
    _id: false
  }],
  resolvedAt: { type: Date },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

welfareSchema.index({ status: 1 });
welfareSchema.index({ category: 1 });
welfareSchema.index({ ticketId: 1 });
welfareSchema.index({ submitterMatric: 1 });
welfareSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Welfare', welfareSchema);
