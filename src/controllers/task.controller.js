// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\task.controller.js
const Task = require("../models/task.model");
const User = require("../models/user.model");

const { sendEmail } = require("../utils/mailer");
const { addNotification, createTaskNotification } = require("../utils/notifications"); // Already added

// ✅ ADD: Status transition rules (State Machine)
const allowedTransitions = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  OVERDUE: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["VERIFIED"],
  VERIFIED: []
};

exports.createTask = async (req, res) => {
  const { title, description, assignedTo, dueDate, priority, assignByPosition } = req.body;

  if (!title || !dueDate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  let assigneeId = assignedTo;
  
  // ✅ AUTO-ASSIGN BY POSITION if assignByPosition is provided
  if (assignByPosition && !assignedTo) {
    const positionUser = await User.findOne({ 
      position: { $regex: new RegExp(assignByPosition, 'i') },
      role: 'EXEC',
      isActive: true
    });
    
    if (positionUser) {
      assigneeId = positionUser._id;
      console.log(`✅ Auto-assigned to ${positionUser.position}: ${positionUser.name}`);
    } else {
      return res.status(404).json({ 
        message: `No active executive found with position: ${assignByPosition}` 
      });
    }
  }

  if (!assigneeId) {
    return res.status(400).json({ message: "No assignee specified" });
  }

  const assignedUser = await User.findById(assigneeId);
  if (!assignedUser) {
    return res.status(400).json({ message: "Invalid user assigned" });
  }

  const task = await Task.create({
    title,
    description,
    assignedTo: assigneeId,
    dueDate: new Date(dueDate),
    priority: priority || "MEDIUM",
    createdBy: req.user.id,
    assignedByPosition: assignByPosition || null,
    statusHistory: [{
      status: "PENDING",
      changedBy: req.user.id,
      changedAt: new Date(),
    }],
  });

  // Enhanced email notification with position context
  await sendEmail({
    to: assignedUser.email,
    subject: `📋 New Task Assigned as ${assignedUser.position} - "${title}"`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0d7c3d; padding: 20px; text-align: center; color: white;">
        <h2>New Task Assigned to ${assignedUser.position}</h2>
      </div>
      <div style="padding: 20px; background: white;">
        <p>Hello <strong>${assignedUser.position} ${assignedUser.name}</strong>,</p>
        <p>You have been assigned a new task in your capacity as ${assignedUser.position}:</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="margin-top: 0;">${title}</h3>
          <p><strong>Description:</strong> ${description || 'No description provided'}</p>
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
          <p><strong>Priority:</strong> <span style="color: ${
            priority === 'HIGH' ? '#dc3545' : 
            priority === 'MEDIUM' ? '#ffc107' : '#28a745'
          }">${priority || "MEDIUM"}</span></p>
          <p><strong>Assigned by:</strong> ${req.user.name} (${req.user.position})</p>
          ${assignByPosition ? `<p><strong>Auto-assigned by position:</strong> ${assignByPosition}</p>` : ''}
        </div>
        
        <div style="margin: 20px 0; padding: 15px; background: #e8f4fd; border-radius: 8px; border-left: 4px solid #0d7c3d;">
          <h4 style="margin-top: 0; color: #0d7c3d;">Role Context</h4>
          <p>This task has been assigned based on your position as <strong>${assignedUser.position}</strong>.</p>
          <p>Please prioritize according to your role responsibilities.</p>
        </div>
        
        <p>Please log in to the system to begin work.</p>
        <p><em>– Department Executive System</em></p>
      </div>
    </div>
    `,
  });

  // ✅ UPDATED: Use createTaskNotification instead of addNotification
  await createTaskNotification(task, 'created');

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

      // ✅ UPDATED: Use createTaskNotification instead of addNotification
      await createTaskNotification(task, 'completed');
    }
  }

  await task.save();
  
  const populatedTask = await Task.findById(task._id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email');

  res.json(populatedTask);
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position')
      .populate('statusHistory.changedBy', 'name email position');

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ✅ HARDENED: Exec can only access tasks assigned to them
    if (req.user.role === "EXEC" && task.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You can only view tasks assigned to you",
      });
    }

    res.json(task);
  } catch (error) {
    console.error("Get task by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { title, description, assignedTo, dueDate, priority } = req.body;
    const taskId = req.params.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ✅ HARDENED: Check permissions
    if (req.user.role === "EXEC") {
      // Exec can only update tasks assigned to them
      if (task.assignedTo.toString() !== req.user.id) {
        return res.status(403).json({
          message: "You can only update tasks assigned to you",
        });
      }
      
      // Exec can only update certain fields
      const allowedFields = ['title', 'description'];
      const updateData = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
      
      Object.assign(task, updateData);
    } else if (req.user.role === "ADMIN") {
      // Admin can update any field
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (dueDate !== undefined) task.dueDate = new Date(dueDate);
      if (priority !== undefined) task.priority = priority;
      
      // If assignedTo changed, notify new assignee
      if (assignedTo && task.assignedTo.toString() !== assignedTo) {
        const newAssignee = await User.findById(assignedTo);
        if (!newAssignee) {
          return res.status(400).json({ message: "Invalid user assigned" });
        }
        
        // Notify old assignee
        await addNotification(
          task.assignedTo,
          `Task reassigned: ${task.title}`,
          'task',
          { taskId: task._id },
          `/dashboard/tasks/${task._id}`,
          'medium'
        );
        
        // Notify new assignee
        await sendEmail({
          to: newAssignee.email,
          subject: `Task Reassigned to You: ${task.title}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0d7c3d; padding: 20px; text-align: center; color: white;">
              <h2>Task Reassigned</h2>
            </div>
            <div style="padding: 20px; background: white;">
              <p>Hello <strong>${newAssignee.position} ${newAssignee.name}</strong>,</p>
              <p>A task has been reassigned to you:</p>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0;">${task.title}</h3>
                <p><strong>Description:</strong> ${task.description || 'No description provided'}</p>
                <p><strong>Due Date:</strong> ${task.dueDate.toLocaleDateString()}</p>
                <p><strong>Priority:</strong> <span style="color: ${
                  task.priority === 'HIGH' ? '#dc3545' : 
                  task.priority === 'MEDIUM' ? '#ffc107' : '#28a745'
                }">${task.priority}</span></p>
                <p><strong>Reassigned by:</strong> ${req.user.name} (${req.user.position})</p>
              </div>
              
              <p>Please log in to the system to view the task details.</p>
              <p><em>– Department Executive System</em></p>
            </div>
          </div>
          `,
        });

        await addNotification(
          newAssignee.id,
          `Task reassigned to you as ${newAssignee.position}: ${task.title}`,
          'task',
          { taskId: task._id },
          `/dashboard/tasks/${task._id}`,
          'medium'
        );

        task.assignedTo = assignedTo;
      }
    }

    // Add to update history
    task.updateHistory.push({
      updatedBy: req.user.id,
      updatedAt: new Date(),
      changes: req.body
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position')
      .populate('updateHistory.updatedBy', 'name email position');

    res.json(populatedTask);

  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ✅ HARDENED: Prevent deletion of completed tasks
    if (task.status === "COMPLETED") {
      return res.status(400).json({
        message: "Completed tasks cannot be deleted for record keeping",
      });
    }

    // Notify assignee about task deletion
    const assignee = await User.findById(task.assignedTo);
    if (assignee) {
      await addNotification(
        assignee.id,
        `Task deleted: ${task.title}`,
        'task',
        { taskId: task._id },
        null,
        'medium'
      );
    }

    await task.deleteOne();

    console.log(`🗑️ Task deleted: ${task.title} by user ${req.user.id}`);

    res.json({ 
      message: "Task deleted successfully",
      taskId: req.params.id
    });

  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Upload attachment — assignee or admin
exports.uploadAttachment = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.user.role === 'EXEC' && task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only upload to your own tasks' });
    }

    if (task.status === 'VERIFIED') {
      return res.status(400).json({ message: 'Cannot upload to a verified task' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    task.attachments.push({
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/tasks/${req.file.filename}`,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    });

    await task.save();

    const admin = await User.findById(task.createdBy);
    if (admin) {
      await sendEmail({
        to: admin.email,
        subject: `📎 New attachment on task: ${task.title}`,
        text: `${req.user.name} uploaded a file (${req.file.originalname}) on task "${task.title}". Log in to review it.`
      });
      await addNotification(
        admin._id,
        `${req.user.name} uploaded a file on task: ${task.title}`,
        'task',
        { taskId: task._id },
        `/dashboard/tasks/${task._id}`,
        'medium'
      );
    }

    res.json({ message: 'File uploaded successfully', task });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add comment — admin or assignee
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Comment text is required' });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.user.role === 'EXEC' && task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    task.comments.push({
      text: text.trim(),
      author: req.user.id,
      createdAt: new Date()
    });

    await task.save();

    const notifyUserId = req.user.id === task.createdBy.toString()
      ? task.assignedTo
      : task.createdBy;

    await addNotification(
      notifyUserId,
      `New comment on task "${task.title}" by ${req.user.name}`,
      'task',
      { taskId: task._id },
      `/dashboard/tasks/${task._id}`,
      'low'
    );

    const populated = await Task.findById(task._id)
      .populate('comments.author', 'name position');

    res.json({ message: 'Comment added', comments: populated.comments });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update progress — assignee only
exports.updateProgress = async (req, res) => {
  try {
    const { progress } = req.body;

    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'Progress must be between 0 and 100' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (req.user.role === 'EXEC' && task.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update progress on your own tasks' });
    }

    if (task.status === 'VERIFIED') {
      return res.status(400).json({ message: 'Cannot update a verified task' });
    }

    task.progress = progress;
    await task.save();

    res.json({ message: 'Progress updated', progress: task.progress });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify task — admin only
exports.verifyTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Only COMPLETED tasks can be verified' });
    }

    task.status = 'VERIFIED';
    task.verifiedBy = req.user.id;
    task.verifiedAt = new Date();
    task.progress = 100;

    task.statusHistory.push({
      status: 'VERIFIED',
      changedBy: req.user.id,
      changedAt: new Date()
    });

    await task.save();

    await sendEmail({
      to: task.assignedTo.email,
      subject: `✅ Task Verified: ${task.title}`,
      text: `Hello ${task.assignedTo.name},\n\nYour task "${task.title}" has been reviewed and verified by ${req.user.name} (${req.user.position}).\n\nWell done!\n\n– IESA Exec System`
    });

    await addNotification(
      task.assignedTo._id,
      `Your task "${task.title}" has been verified by ${req.user.name}`,
      'task',
      { taskId: task._id },
      `/dashboard/tasks/${task._id}`,
      'high'
    );

    res.json({ message: 'Task verified successfully', task });
  } catch (error) {
    console.error('Verify task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Optional: Get task statistics
exports.getTaskStatistics = async (req, res) => {
  try {
    let filter = {};
    
    // Exec can only see their own stats
    if (req.user.role === "EXEC") {
      filter.assignedTo = req.user.id;
    }

    const totalTasks = await Task.countDocuments(filter);
    const completedTasks = await Task.countDocuments({ ...filter, status: "COMPLETED" });
    const pendingTasks = await Task.countDocuments({ ...filter, status: "PENDING" });
    const inProgressTasks = await Task.countDocuments({ ...filter, status: "IN_PROGRESS" });
    const overdueTasks = await Task.countDocuments({ ...filter, status: "OVERDUE" });

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Group by priority
    const byPriority = await Task.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } }
    ]);

    res.json({
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      overdueTasks,
      completionRate: Math.round(completionRate),
      byPriority: byPriority.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error("Get task statistics error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};