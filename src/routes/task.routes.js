const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorize"); // ✅ ADD THIS
const {
  createTask,
  getTasks,
  updateTaskStatus,
} = require("../controllers/task.controller");

const router = express.Router();

// ✅ HARDENED: Only ADMIN can create tasks
router.post("/", protect, authorizeRoles("ADMIN"), createTask);

// ALL AUTHENTICATED USERS: Get tasks (filtered by role in controller)
router.get("/", protect, getTasks);

// ALL AUTHENTICATED USERS: Update task status (with ownership checks)
router.patch("/:id/status", protect, updateTaskStatus);

module.exports = router;