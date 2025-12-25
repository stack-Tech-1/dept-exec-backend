const Task = require("../models/task.model");
const User = require("../models/user.model");

const { sendEmail } = require("../utils/mailer");
const { addNotification } = require("../utils/notifications");

// ✅ ADD: Status transition rules (State Machine)
const allowedTransitions = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: [] // No transitions from completed
};

exports.createTask = async (req, res) => {
  const { title, description, assignedTo, dueDate, priority } = req.body;

  if (!title || !assignedTo || !dueDate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const assignedUser = await User.findById(assignedTo);
  if (!assignedUser) {
    return res.status(400).json({ message: "Invalid user assigned" });
  }

  const task = await Task.create({
    title,
    description,
    assignedTo,
    dueDate: new Date(dueDate),
    priority: priority || "MEDIUM",
    createdBy: req.user.id,
    statusHistory: [{
      status: "PENDING",
      changedBy: req.user.id,
      changedAt: new Date(),
    }],
  });

  // Send email notification
  await sendEmail({
    to: assignedUser.email,
    subject: "New Task Assigned to You",
    text: `
Hello ${assignedUser.name},

You have been assigned a new task:

Task: ${title}
Description: ${description || 'No description provided'}
Due Date: ${new Date(dueDate).toDateString()}
Priority: ${priority || "MEDIUM"}

Please log in to the system to begin work.

– Dept Exec System
`,
  });

  // In-app notification
  addNotification(
    assignedUser.id,
    `New task assigned: ${title}`
  );

  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email');

  res.status(201).json(populatedTask);
};

exports.getTasks = async (req, res) => {
  if (req.user.role === "EXEC") {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1 });
    return res.json(tasks);
  }

  const tasks = await Task.find()
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort({ dueDate: 1 });
  
  res.json(tasks);
};

exports.updateTaskStatus = async (req, res) => {
  const { status } = req.body;
  
  const task = await Task.findById(req.params.id);

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  // ✅ HARDENED: Ownership enforcement
  if (req.user.role === "EXEC" && task.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({
      message: "You can only update tasks assigned to you",
    });
  }

  // ✅ HARDENED: Prevent system status from being manually set
  if (status === "OVERDUE") {
    return res.status(403).json({ 
      message: "OVERDUE status can only be set automatically by the system" 
    });
  }

  // ✅ HARDENED: Lock completed tasks (no modifications)
  if (task.status === "COMPLETED") {
    return res.status(400).json({
      message: "Completed tasks cannot be modified",
    });
  }

  // ✅ HARDENED: State machine - validate allowed transitions
  if (status !== task.status && !allowedTransitions[task.status]?.includes(status)) {
    return res.status(400).json({
      message: `Invalid status transition from ${task.status} to ${status}`,
      allowedTransitions: allowedTransitions[task.status] || []
    });
  }

  // Update status and history
  task.status = status;
  task.statusHistory.push({
    status,
    changedBy: req.user.id,
    changedAt: new Date(),
  });

  // Set completedAt if task is completed
  if (status === "COMPLETED") {
    task.completedAt = new Date();
    
    // Notify admin
    const completedByUser = await User.findById(task.assignedTo);
    const adminUser = await User.findById(task.createdBy);
    
    if (adminUser) {
      // Email notification
      await sendEmail({
        to: adminUser.email,
        subject: "Task Completed",
        text: `
Hello ${adminUser.name},

The following task has been completed:

Task: ${task.title}
Completed By: ${completedByUser.name}
Completed At: ${task.completedAt.toDateString()}

– Dept Exec System
`,
      });

      // In-app notification
      addNotification(
        adminUser.id,
        `Task completed: ${task.title} by ${completedByUser.name}`
      );
    }
  }

  await task.save();
  
  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email');

  res.json(populatedTask);
};