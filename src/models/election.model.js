const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  matricNumber: { type: String, trim: true, uppercase: true },
  bio: { type: String, trim: true, maxlength: 300 },
  photo: { type: String }, // Cloudinary URL
  voteCount: { type: Number, default: 0 }
}, { _id: true });

const electionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, // e.g. "President 2025/2026"
  position: { type: String, required: true, trim: true }, // e.g. "President"
  session: { type: String, required: true, trim: true }, // e.g. "2025/2026"
  description: { type: String, trim: true },
  status: {
    type: String,
    enum: ['PENDING', 'OPEN', 'CLOSED'],
    default: 'PENDING'
  },
  candidates: [candidateSchema],
  voters: [{
    matricNumber: { type: String, uppercase: true },
    votedAt: { type: Date, default: Date.now },
    candidateId: { type: mongoose.Schema.Types.ObjectId },
    _id: false
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  openedAt: { type: Date },
  closedAt: { type: Date },
  totalVotes: { type: Number, default: 0 }
}, { timestamps: true });

electionSchema.index({ status: 1 });
electionSchema.index({ session: 1 });
electionSchema.index({ 'voters.matricNumber': 1 });

module.exports = mongoose.model('Election', electionSchema);
