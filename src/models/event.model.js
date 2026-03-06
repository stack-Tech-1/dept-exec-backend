const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: {
    type: String,
    enum: ['SOCIAL', 'ACADEMIC', 'COMPETITION', 'DEPARTMENTAL_WEEK'],
    required: true
  },
  date: { type: Date, required: true },
  endDate: { type: Date }, // optional end date for multi-day events
  time: { type: String, required: true }, // e.g. "2:00 PM"
  venue: { type: String, required: true, trim: true },
  expectedAttendance: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'],
    default: 'UPCOMING'
  },
  rsvps: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    response: { type: String, enum: ['GOING', 'NOT_GOING', 'MAYBE'], required: true },
    respondedAt: { type: Date, default: Date.now },
    _id: false
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coverImage: { type: String }, // Cloudinary URL
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ type: 1 });
eventSchema.index({ title: 'text', description: 'text', venue: 'text' });

module.exports = mongoose.model('Event', eventSchema);
