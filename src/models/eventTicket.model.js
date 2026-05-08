const mongoose = require('mongoose');
const crypto = require('crypto');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  claimed: { type: Boolean, default: false },
  claimedAt: { type: Date },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const eventTicketSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  memberName: { type: String, required: true },
  memberEmail: { type: String, required: true },
  matricNumber: { type: String },
  token: {
    type: String,
    unique: true,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'CONFIRMED'],
    default: 'PENDING',
  },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date },
  items: [itemSchema],
  checkedIn: { type: Boolean, default: false },
  checkInTime: { type: Date },
}, { timestamps: true });

eventTicketSchema.index({ token: 1 });
eventTicketSchema.index({ event: 1, paymentStatus: 1 });
eventTicketSchema.index({ event: 1, member: 1 }, { unique: true });

module.exports = mongoose.model('EventTicket', eventTicketSchema);
