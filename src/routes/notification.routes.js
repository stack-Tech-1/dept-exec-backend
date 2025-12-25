const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const {
  getUserNotifications,
  markAllAsRead,
} = require("../utils/notifications");

const router = express.Router();

// Get my notifications
router.get("/", protect, (req, res) => {
  res.json(getUserNotifications(req.user.id));
});

// Mark all as read
router.patch("/read", protect, (req, res) => {
  markAllAsRead(req.user.id);
  res.json({ message: "Notifications marked as read" });
});

module.exports = router;