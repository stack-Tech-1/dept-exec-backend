let notifications = {}; // userId -> notifications array

function addNotification(userId, message) {
  if (!notifications[userId]) {
    notifications[userId] = [];
  }

  notifications[userId].unshift({
    id: Date.now(),
    message,
    read: false,
    createdAt: new Date(),
  });
}

function getUserNotifications(userId) {
  return notifications[userId] || [];
}

function markAllAsRead(userId) {
  if (!notifications[userId]) return;

  notifications[userId].forEach(n => {
    n.read = true;
  });
}

module.exports = {
  addNotification,
  getUserNotifications,
  markAllAsRead,
};