const mongoose = require("mongoose");
const { EXECUTIVE_POSITIONS } = require("./user.model");

const inviteSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  role: { 
    type: String, 
    enum: ["ADMIN", "EXEC"],
    required: true
  },
  position: {
    type: String,
    enum: EXECUTIVE_POSITIONS,
    default: "Executive Member"
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: { 
    type: Boolean, 
    default: false 
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { 
  timestamps: true 
});

// Index for faster queries
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
//inviteSchema.index({ token: 1 });

module.exports = mongoose.model("Invite", inviteSchema);