const mongoose = require('mongoose');
const crypto = require('crypto');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  claimed: { type: Boolean, default: false },
  claimedAt: { type: Date },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const eventGuestSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  type: {
    type: String,
    enum: ['NON_STUDENT', 'EXTERNAL_STUDENT'],
    required: true,
  },
  department: { type: String, trim: true },
  token: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  paymentStatus: {
    type: String,
    enum: ['NOT_REQUIRED', 'PENDING', 'CONFIRMED'],
    default: 'NOT_REQUIRED',
  },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date },
  items: [itemSchema],
  checkedIn: { type: Boolean, default: false },
  checkInTime: { type: Date },
  registeredAt: { type: Date, default: Date.now },
}, { timestamps: true });

eventGuestSchema.index({ event: 1, email: 1 }, { unique: true });
eventGuestSchema.index({ token: 1 });
eventGuestSchema.index({ event: 1 });

module.exports = mongoose.model('EventGuest', eventGuestSchema);
