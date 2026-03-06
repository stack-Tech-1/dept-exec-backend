// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\task.routes.js
const express = require("express");
const router = express.Router();
const taskController = require("../controllers/task.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { uploadTaskFile } = require('../config/cloudinary');

// All routes require authentication
router.use(authenticate);

// Get all tasks (Admin sees all, Exec sees only assigned)
router.get("/", taskController.getTasks);

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

// Upload attachment (assignee only)
router.post('/:id/attachments', uploadTaskFile.single('file'), taskController.uploadAttachment);

// Add comment (admin or assignee)
router.post('/:id/comments', taskController.addComment);

// Update progress percentage (assignee only)
router.patch('/:id/progress', taskController.updateProgress);

// Verify task completion (admin only)
router.post('/:id/verify', authorize(['ADMIN']), taskController.verifyTask);

module.exports = router;