const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { getUserNotifications, markAllAsRead } = require("../utils/notifications");

const router = express.Router();

// Get my notifications
router.get("/", authenticate, (req, res) => {
  res.json(getUserNotifications(req.user.id));
});

// Mark all as read
router.patch("/read", authenticate, (req, res) => {
  markAllAsRead(req.user.id);
  res.json({ message: "Notifications marked as read" });
});

module.exports = router;