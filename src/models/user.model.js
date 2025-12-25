const mongoose = require("mongoose");

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
  isActive: { 
    type: Boolean, 
    default: true 
  },
  department: {
    type: String,
    default: "Industrial & Production Engineering"
  },
  position: {
    type: String,
    default: "Executive Member"
  },
  lastLogin: {
    type: Date
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model("User", userSchema);