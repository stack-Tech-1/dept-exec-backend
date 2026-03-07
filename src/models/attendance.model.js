const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  sessionCode: { type: String, required: true, unique: true, uppercase: true },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  closedAt: { type: Date },
  attendees: [{
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    name: { type: String },
    matricNumber: { type: String },
    level: { type: String },
    markedAt: { type: Date, default: Date.now },
    _id: false
  }]
}, { timestamps: true });

attendanceSchema.index({ sessionCode: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
