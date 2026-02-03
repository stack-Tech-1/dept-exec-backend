// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\goal.routes.js
const express = require("express");
const router = express.Router();
const goalController = require("../controllers/goal.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

// Get all goals
router.get("/", goalController.getAllGoals);

// Get goal statistics
router.get("/statistics", goalController.getGoalStatistics);

// Get goal by ID
router.get("/:id", goalController.getGoalById);

// Create goal (admin only)
router.post("/", authorize(["ADMIN"]), goalController.createGoal);

// Update goal
router.put("/:id", goalController.updateGoal);

// Link task to goal
router.post("/:id/tasks", goalController.linkTaskToGoal);

// Archive goal (admin only)
router.post("/:id/archive", authorize(["ADMIN"]), goalController.archiveGoal);

module.exports = router;