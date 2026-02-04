// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\utils\overdueChecker.js
const Task = require('../models/task.model');
const User = require('../models/user.model');
const { addNotification, sendEmailNotification } = require('./notifications');
const { getIO } = require('../socket');

let checkerInterval;

const checkOverdueTasks = async () => {
  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Find tasks that are due yesterday or before and not completed/overdue
    const overdueTasks = await Task.find({
      dueDate: { $lte: yesterday },
      status: { $in: ['PENDING', 'IN_PROGRESS'] }
    }).populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email');

    for (const task of overdueTasks) {
      // Update task status to OVERDUE
      if (task.status !== 'OVERDUE') {
        task.status = 'OVERDUE';
        task.statusHistory.push({
          status: 'OVERDUE',
          changedBy: 'system',
          changedAt: now,
          note: 'Auto-marked overdue by system'
        });
        await task.save();

        // Send email notification to assignee
        if (task.assignedTo.email) {
          await sendEmailNotification(
            task.assignedTo._id,
            `⚠️ Task Overdue: ${task.title}`,
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc3545; padding: 20px; text-align: center; color: white;">
                <h2>Task Overdue</h2>
              </div>
              <div style="padding: 20px; background: white;">
                <p>Hello <strong>${task.assignedTo.position} ${task.assignedTo.name}</strong>,</p>
                <p>The following task is now overdue:</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc3545;">
                  <h3 style="margin-top: 0;">${task.title}</h3>
                  <p><strong>Due Date:</strong> ${task.dueDate.toLocaleDateString()} (OVERDUE)</p>
                  <p><strong>Priority:</strong> <span style="color: #dc3545">${task.priority}</span></p>
                  <p><strong>Original Assigner:</strong> ${task.createdBy?.name}</p>
                </div>
                
                <p style="color: #dc3545; font-weight: bold;">
                  ⚠️ This task requires immediate attention!
                </p>
                
                <p>Please update the task status or contact ${task.createdBy?.name} for extension.</p>
                <p><em>– Department Executive System</em></p>
              </div>
            </div>
            `
          );
        }

        // Send notification to creator
        if (task.createdBy && task.createdBy._id.toString() !== task.assignedTo._id.toString()) {
          addNotification(
            task.createdBy._id,
            `Task overdue: "${task.title}" assigned to ${task.assignedTo.name}`
          );
        }

        // Real-time notification via Socket.io
        const io = getIO();
        io.to(`user-${task.assignedTo._id}`).emit('task-overdue', {
          taskId: task._id,
          title: task.title,
          dueDate: task.dueDate
        });

        console.log(`⚠️ Marked task as overdue: ${task.title} (ID: ${task._id})`);
      }
    }

    if (overdueTasks.length > 0) {
      console.log(`✅ Checked ${overdueTasks.length} overdue tasks`);
    }
  } catch (error) {
    console.error('Overdue checker error:', error);
  }
};

const startOverdueChecker = () => {
  // Run immediately on start
  checkOverdueTasks();
  
  // Then run every hour
  checkerInterval = setInterval(checkOverdueTasks, 60 * 60 * 1000);
  
  console.log('⏰ Overdue task checker started (running hourly)');
};

const stopOverdueChecker = () => {
  if (checkerInterval) {
    clearInterval(checkerInterval);
    console.log('⏰ Overdue task checker stopped');
  }
};

module.exports = { startOverdueChecker, stopOverdueChecker, checkOverdueTasks };