const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware"); // ✅ Change to authenticate, authorize

// All user routes require authentication
router.use(authenticate, authorize); // ✅ Change to authenticate, authorize

// GET /api/users - Get all users (Admin only)
router.get("/", authorize("ADMIN"), userController.getAllUsers);

// GET /api/users/me - Get current user profile
router.get("/me", userController.getCurrentUser);

module.exports = router;