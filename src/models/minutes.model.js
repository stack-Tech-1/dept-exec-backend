const mongoose = require("mongoose");

const minutesSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  time: String,
  venue: {
    type: String,
    default: "Not specified"
  },
  minutesText: {
    type: String,
    required: true
  },

  recordingUrl: String,
  recordingFilename: String,

  attendance: [{
    type: String // Store as ["Precious Adetipe (ADMIN)", "Treasurer (EXEC)"]
  }],
  session: {
    type: String,
    default: "2024/2025"
  },
  semester: {
    type: String,
    default: "First Semester"
  },

  approved: { 
    type: Boolean, 
    default: false 
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  approvedAt: Date,

  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
}, { 
  timestamps: true 
});

// Indexes for faster queries
minutesSchema.index({ date: -1 });
minutesSchema.index({ session: 1, semester: 1 });
minutesSchema.index({ approved: 1 });

module.exports = mongoose.model("Minutes", minutesSchema);