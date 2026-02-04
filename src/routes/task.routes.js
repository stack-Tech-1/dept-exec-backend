// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\task.routes.js
const express = require("express");
const router = express.Router();
const taskController = require("../controllers/task.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { paginateResults } = require('../middleware/pagination');
const Task = require('../models/task.model');

// All routes require authentication
router.use(authenticate);

//router.get("/statistics", taskController.getTaskStatistics);

// Get all tasks (Admin sees all, Exec sees only assigned)
// Update GET / route:
router.get("/", 
  authenticate,
  (req, res, next) => {
    if (req.user.role === "EXEC") {
      req.query.assignedTo = req.user.id;
    }
    next();
  },
  paginateResults(Task, ['assignedTo', 'createdBy']),
  (req, res) => {
    res.json(res.paginatedResults);
  }
);

// Get task by ID
router.get("/:id", taskController.getTaskById);

// Create task (Admin only)
router.post("/", authorize(["ADMIN"]), taskController.createTask);

// Update task (Admin can update any, Exec can only update assigned)
router.put("/:id", taskController.updateTask);

// Update task status (Admin & Exec can update)
router.patch("/:id/status", taskController.updateTaskStatus);

// Delete task (Admin only)
router.delete("/:id", authorize(["ADMIN"]), taskController.deleteTask);

module.exports = router;