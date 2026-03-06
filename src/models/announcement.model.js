const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  audience: {
    type: String,
    enum: ['ALL', 'MEMBERS_ONLY', 'EXEC_ONLY', 'LEVEL_100', 'LEVEL_200', 'LEVEL_300', 'LEVEL_400', 'LEVEL_500'],
    default: 'ALL'
  },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientCount: { type: Number, default: 0 },
  emailsSent: { type: Number, default: 0 },
  emailsFailed: { type: Number, default: 0 },
  notificationsSent: { type: Number, default: 0 },
  status: { type: String, enum: ['SENDING', 'SENT', 'FAILED'], default: 'SENDING' },
  priority: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
}, { timestamps: true });

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ sentBy: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
