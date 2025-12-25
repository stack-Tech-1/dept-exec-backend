const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,

  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },

  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE"],
    default: "PENDING",
  },

  completedAt: Date,

  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"],
    default: "MEDIUM"
  },

  statusHistory: [
    {
      status: {
        type: String,
        enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE"],
        required: true
      },
      changedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
        required: true
      },
      changedAt: {
        type: Date,
        default: Date.now
      },
      _id: false // Don't create IDs for subdocuments
    }
  ],
}, { 
  timestamps: true 
});

// Indexes for performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1 });

module.exports = mongoose.model("Task", taskSchema);