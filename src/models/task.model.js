//C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\models\task.model.js
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
  updateHistory: [{
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    changes: {
      type: Object,
      default: {},
    },
  }],

  completedAt: Date,

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

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
taskSchema.index({ title: 'text', description: 'text', 'assignedTo.name': 'text' });
taskSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model("Task", taskSchema);