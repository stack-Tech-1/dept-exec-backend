// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\report.routes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

// Task analytics
router.get("/tasks", reportController.getTaskReport);

// Meeting analytics
router.get("/meetings", reportController.getMeetingReport);

// Goal analytics
router.get("/goals", reportController.getGoalReport);

// User performance
router.get("/users", reportController.getUserPerformance);
router.get("/users/:userId", reportController.getUserPerformance);

// Department report (admin only)
router.get("/department", authorize(["ADMIN"]), reportController.getDepartmentReport);

// Dashboard summary (all-in-one stats)
router.get("/dashboard-summary", reportController.getDashboardSummary);

// Export reports (admin only)
router.get("/export/:reportType", authorize(["ADMIN"]), reportController.exportReport);

module.exports = router;