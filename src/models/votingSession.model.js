const mongoose = require('mongoose');
const crypto = require('crypto');

const votingSessionSchema = new mongoose.Schema({
  token: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  elections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Election' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  label: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date },
  voterLog: [{
    identifier: { type: String, uppercase: true, trim: true },
    votedAt: { type: Date, default: Date.now },
    electionsVoted: [{ type: mongoose.Schema.Types.ObjectId }],
    _id: false
  }]
}, { timestamps: true });

module.exports = mongoose.model('VotingSession', votingSessionSchema);
