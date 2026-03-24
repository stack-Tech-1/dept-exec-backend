const mongoose = require('mongoose');
const crypto = require('crypto');

const memberRegistrationLinkSchema = new mongoose.Schema({
  token: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  label: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('MemberRegistrationLink', memberRegistrationLinkSchema);
