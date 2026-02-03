// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\models\goal.model.js
const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Goal title is required"],
    trim: true,
  },
  description: {
    type: String,
    default: "",
  },
  category: {
    type: String,
    enum: ["academic", "administrative", "social", "infrastructure", "other"],
    default: "administrative",
  },
  targetDate: {
    type: Date,
    required: [true, "Target date is required"],
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  status: {
    type: String,
    enum: ["not-started", "in-progress", "completed", "behind-schedule", "at-risk"],
    default: "not-started",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  department: {
    type: String,
    default: "IPE Department",
  },
  tasks: [{
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    title: String,
    status: String,
    weight: {
      type: Number,
      min: 1,
      max: 100,
      default: 1,
    },
  }],
  milestones: [{
    title: String,
    description: String,
    targetDate: Date,
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
  }],
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  kpis: [{
    name: String,
    target: Number,
    current: {
      type: Number,
      default: 0,
    },
    unit: String,
  }],
  budget: {
    allocated: {
      type: Number,
      default: 0,
    },
    spent: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
  },
  dependencies: [{
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Goal",
    },
    type: {
      type: String,
      enum: ["blocks", "delays", "optional"],
    },
  }],
  tags: [String],
  notes: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  isArchived: {
    type: Boolean,
    default: false,
  },
  lastProgressUpdate: Date,
}, {
  timestamps: true,
});

// Indexes
goalSchema.index({ targetDate: 1 });
goalSchema.index({ status: 1 });
goalSchema.index({ priority: 1 });
goalSchema.index({ category: 1 });
goalSchema.index({ createdBy: 1 });

// Virtual for days remaining
goalSchema.virtual("daysRemaining").get(function() {
  const now = new Date();
  const target = new Date(this.targetDate);
  const diffTime = target - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days elapsed
goalSchema.virtual("daysElapsed").get(function() {
  const now = new Date();
  const start = new Date(this.startDate);
  const diffTime = now - start;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for expected progress based on time
goalSchema.virtual("expectedProgress").get(function() {
  const totalDays = (new Date(this.targetDate) - new Date(this.startDate)) / (1000 * 60 * 60 * 24);
  const elapsedDays = this.daysElapsed;
  
  if (totalDays <= 0) return 100;
  return Math.min(100, Math.floor((elapsedDays / totalDays) * 100));
});

// Method to update progress based on tasks
goalSchema.methods.calculateProgress = async function() {
  if (this.tasks.length === 0) return this.progress;
  
  const Task = require("./task.model");
  let totalWeight = 0;
  let completedWeight = 0;
  
  // Calculate weighted progress from tasks
  for (const taskRef of this.tasks) {
    if (taskRef.taskId) {
      const task = await Task.findById(taskRef.taskId);
      if (task) {
        totalWeight += taskRef.weight;
        if (task.status === "COMPLETED") {
          completedWeight += taskRef.weight;
        }
      }
    }
  }
  
  if (totalWeight > 0) {
    this.progress = Math.round((completedWeight / totalWeight) * 100);
  }
  
  // Update status based on progress
  if (this.progress === 100) {
    this.status = "completed";
  } else if (this.progress > 0) {
    this.status = "in-progress";
  }
  
  this.lastProgressUpdate = new Date();
  return this.progress;
};

// Method to add task to goal
goalSchema.methods.addTask = function(taskId, title, weight = 1) {
  const existing = this.tasks.find(t => t.taskId.toString() === taskId.toString());
  if (!existing) {
    this.tasks.push({
      taskId,
      title,
      weight,
      status: "pending"
    });
  }
  return this;
};

// Method to add milestone
goalSchema.methods.addMilestone = function(title, description, targetDate) {
  this.milestones.push({
    title,
    description,
    targetDate,
    completed: false
  });
  return this;
};

const Goal = mongoose.model("Goal", goalSchema);
module.exports = Goal;