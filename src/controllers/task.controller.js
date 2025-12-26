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

  // Send email notification with position
  await sendEmail({
    to: assignedUser.email,
    subject: `New Task Assigned to ${assignedUser.position} - ${assignedUser.name}`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0d7c3d; padding: 20px; text-align: center; color: white;">
        <h2>New Task Assigned</h2>
      </div>
      <div style="padding: 20px; background: white;">
        <p>Hello <strong>${assignedUser.position} ${assignedUser.name}</strong>,</p>
        <p>You have been assigned a new task:</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${title}</h3>
          <p><strong>Description:</strong> ${description || 'No description provided'}</p>
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
          <p><strong>Priority:</strong> <span style="color: ${
            priority === 'HIGH' ? '#dc3545' : 
            priority === 'MEDIUM' ? '#ffc107' : '#28a745'
          }">${priority || "MEDIUM"}</span></p>
          <p><strong>Assigned by:</strong> ${req.user.name} (${req.user.position})</p>
        </div>
        
        <p>Please log in to the system to begin work.</p>
        <p><em>– Department Executive System</em></p>
      </div>
    </div>
    `,
  });

  // In-app notification
  addNotification(
    assignedUser.id,
    `New task assigned to you as ${assignedUser.position}: ${title}`
  );

  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email position') 
    .populate('createdBy', 'name email position'); 

  res.status(201).json(populatedTask);
};

// Update other methods to populate position as needed
exports.getTasks = async (req, res) => {
    if (req.user.role === "EXEC") {
      const tasks = await Task.find({ assignedTo: req.user.id })
        .populate('assignedTo', 'name email position') 
        .populate('createdBy', 'name email position') 
        .sort({ dueDate: 1 });
      return res.json(tasks);
    }

    const tasks = await Task.find()
    .populate('assignedTo', 'name email position') 
    .populate('createdBy', 'name email position') 
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