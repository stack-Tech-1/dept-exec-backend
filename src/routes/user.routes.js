const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware"); // ✅ Change to protect
const { authorizeRoles } = require("../middleware/authorize");

// All user routes require authentication
router.use(protect); // ✅ Change to protect

// GET /api/users - Get all users (Admin only)
router.get("/", authorizeRoles("ADMIN"), userController.getAllUsers);

// GET /api/users/me - Get current user profile
router.get("/me", userController.getCurrentUser);

module.exports = router;