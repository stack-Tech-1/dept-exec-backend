// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\utils\notifications.js
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { getIO } = require('../socket');
const { sendEmail } = require('./mailer');

exports.addNotification = async (userId, message, type = 'info', data = {}, actionUrl = null, priority = 'medium') => {
  try {
    const notification = await Notification.create({
      user: userId,
      message,
      type,
      data,
      actionUrl,
      priority,
      read: false
    });

    // Send real-time notification via Socket.io
    const io = getIO();
    io.to(`user-${userId}`).emit('notification', {
      id: notification._id,
      message,
      type,
      data,
      actionUrl,
      priority,
      createdAt: notification.createdAt
    });

    // Send email for high priority notifications
    if (priority === 'high') {
      const user = await User.findById(userId);
      if (user && user.email) {
        await sendEmail({
          to: user.email,
          subject: `🔔 High Priority Notification: ${message.substring(0, 50)}...`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; padding: 20px; text-align: center; color: white;">
              <h2>High Priority Notification</h2>
            </div>
            <div style="padding: 20px; background: white;">
              <p>Hello <strong>${user.position} ${user.name}</strong>,</p>
              <p>You have a new high priority notification:</p>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc3545;">
                <h3 style="margin-top: 0; color: #dc3545;">${message}</h3>
                ${type ? `<p><strong>Type:</strong> ${type}</p>` : ''}
                ${actionUrl ? `<p><a href="${actionUrl}" style="color: #0d7c3d; text-decoration: none;">View Details →</a></p>` : ''}
              </div>
              
              <p>Please log in to the system to address this notification.</p>
              <p><em>– Department Executive System</em></p>
            </div>
          </div>
          `,
        });
      }
    }

    console.log(`📢 Notification created for user ${userId}: ${message}`);
    return notification;
  } catch (error) {
    console.error('Failed to add notification:', error);
    throw error;
  }
};

exports.getUserNotifications = async (userId, limit = 20, unreadOnly = false) => {
  try {
    const query = { user: userId };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return notifications;
  } catch (error) {
    console.error('Failed to get user notifications:', error);
    throw error;
  }
};

exports.markAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      throw new Error('Notification not found or unauthorized');
    }

    await notification.markAsRead();
    
    // Notify via Socket.io
    const io = getIO();
    io.to(`user-${userId}`).emit('notification-read', { notificationId });

    return notification;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
};

exports.markAllAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      { user: userId, read: false },
      { 
        $set: { 
          read: true, 
          readAt: new Date() 
        } 
      }
    );

    // Notify via Socket.io
    const io = getIO();
    io.to(`user-${userId}`).emit('all-notifications-read');

    console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
};

exports.getUnreadCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      user: userId,
      read: false
    });
    return count;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    throw error;
  }
};

exports.sendEmailNotification = async (userId, subject, htmlContent) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.email) {
      throw new Error('User not found or no email address');
    }
    
    await sendEmail({
      to: user.email,
      subject,
      html: htmlContent
    });

    console.log(`📧 Email notification sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error('Failed to send email notification:', error);
    throw error;
  }
};

exports.createTaskNotification = async (task, action = 'created') => {
  try {
    const assignee = await User.findById(task.assignedTo);
    if (!assignee) return;

    const actions = {
      created: 'New task assigned',
      updated: 'Task updated',
      completed: 'Task completed',
      overdue: 'Task overdue'
    };

    const message = `${actions[action]}: ${task.title}`;
    const actionUrl = `/dashboard/tasks/${task._id}`;
    const priority = task.priority === 'HIGH' ? 'high' : 
                     task.priority === 'MEDIUM' ? 'medium' : 'low';

    await this.addNotification(
      assignee._id,
      message,
      'task',
      { taskId: task._id, priority: task.priority, dueDate: task.dueDate },
      actionUrl,
      priority
    );
  } catch (error) {
    console.error('Failed to create task notification:', error);
  }
};

exports.createMinutesNotification = async (minutes, action = 'created') => {
  try {
    const creator = await User.findById(minutes.createdBy);
    if (!creator) return;

    const actions = {
      created: 'New minutes created',
      approved: 'Minutes approved',
      updated: 'Minutes updated'
    };

    const message = `${actions[action]}: ${minutes.title}`;
    const actionUrl = `/dashboard/minutes/${minutes._id}`;
    
    // Notify admin users for approval
    if (action === 'created') {
      const admins = await User.find({ role: 'ADMIN', isActive: true });
      for (const admin of admins) {
        await this.addNotification(
          admin._id,
          `Minutes pending approval: ${minutes.title}`,
          'minutes',
          { minutesId: minutes._id, createdBy: creator.name },
          actionUrl,
          'medium'
        );
      }
    }
  } catch (error) {
    console.error('Failed to create minutes notification:', error);
  }
};