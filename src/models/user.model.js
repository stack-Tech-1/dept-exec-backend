//C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\models\user.model.js
const mongoose = require("mongoose");

// Define executive positions
const EXECUTIVE_POSITIONS = [
    "President",
    "Vice President", 
    "General Secretary",
    "Assistant General Secretary",
    "Treasurer",
    "Public Relations Officer",
    "Sports Director",
    "Assistant Sports Director", 
    "Social Director",
    "Financial Secretary",
    "Executive Member" // Default
  ];

  const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: { 
      type: String, 
      unique: true,
      required: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["ADMIN", "EXEC"],
      default: "EXEC",
    },
    position: {
      type: String,
      enum: EXECUTIVE_POSITIONS,
      default: "Executive Member",
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    department: {
      type: String,
      default: "Industrial & Production Engineering"
    },
    lastLogin: {
      type: Date
    },
    bio: {
      type: String,
      maxlength: 500
    },
    phone: {
      type: String,
      trim: true
    },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpiry: { type: Date, default: null },
  }, {
    timestamps: true
  });

  userSchema.index({
    name: 'text',
    email: 'text',
    position: 'text',
    department: 'text'
  });

  module.exports = mongoose.model("User", userSchema);

// Export positions for use in other files
module.exports.EXECUTIVE_POSITIONS = EXECUTIVE_POSITIONS;