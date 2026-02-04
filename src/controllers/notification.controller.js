// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\notification.controller.js
const Notification = require('../models/notification.model');
const { getIO } = require('../socket');

exports.getUserNotifications = async (req, res) => {
  try {
    const { limit = 20, unreadOnly = false } = req.query;
    const userId = req.user.id;

    const query = { user: userId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Add relative time for each notification
    const notificationsWithRelativeTime = notifications.map(notification => {
      const now = new Date();
      const createdAt = new Date(notification.createdAt);
      const diffMs = now - createdAt;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      let relativeTime = "Just now";
      if (diffSec >= 60) relativeTime = `${diffMin}m ago`;
      if (diffMin >= 60) relativeTime = `${diffHour}h ago`;
      if (diffHour >= 24) relativeTime = `${diffDay}d ago`;
      if (diffDay >= 7) relativeTime = createdAt.toLocaleDateString();

      return {
        ...notification,
        relativeTime
      };
    });

    res.json(notificationsWithRelativeTime);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to get notifications', error: error.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Notification.countDocuments({
      user: userId,
      read: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count', error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      _id: id,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    // Send real-time update
    const io = getIO();
    io.to(`user-${userId}`).emit('notification-read', { id });

    res.json({ 
      message: 'Notification marked as read',
      notification 
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { user: userId, read: false },
      { 
        $set: { 
          read: true, 
          readAt: new Date() 
        } 
      }
    );

    // Send real-time update
    const io = getIO();
    io.to(`user-${userId}`).emit('all-notifications-read');

    res.json({ 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: error.message });
  }
};