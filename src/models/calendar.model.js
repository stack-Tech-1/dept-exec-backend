const mongoose = require('mongoose');

const calendarSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: {
    type: String,
    enum: ['EXAM', 'IESA_EVENT', 'DEADLINE', 'HOLIDAY', 'ACADEMIC', 'OTHER'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  isAllDay: { type: Boolean, default: true },
  session: { type: String, trim: true },
  color: { type: String, default: '#10b981' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isRecurring: { type: Boolean, default: false }
}, { timestamps: true });

calendarSchema.index({ startDate: 1 });
calendarSchema.index({ session: 1 });
calendarSchema.index({ type: 1 });

module.exports = mongoose.model('Calendar', calendarSchema);
