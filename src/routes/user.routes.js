const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware"); // ✅ Change to authenticate, authorize

// All user routes require authentication
router.use(authenticate); // ✅ Change to authenticate, authorize

// GET /api/users - Get all users (Admin only)
router.get("/", authorize("ADMIN"), userController.getAllUsers);

// GET /api/users/me - Get current user profile
router.get("/me", userController.getCurrentUser);

// PUT /api/users/profile - Update current user profile
router.put("/profile", userController.updateCurrentUser);

// GET /api/users/:id - Get user by ID
router.get("/:id", (req, res, next) => {
    // Allow admin or the user themselves
    if (req.user.role === 'ADMIN' || req.user.id === req.params.id) {
      return userController.getUserById(req, res, next);
    }
    return res.status(403).json({ success: false, message: 'Not authorized' });
  });
  
  // PUT /api/users/:id - Update user
  router.put("/:id", (req, res, next) => {
    // Allow admin or the user themselves
    if (req.user.role === 'ADMIN' || req.user.id === req.params.id) {
      return userController.updateUser(req, res, next);
    }
    return res.status(403).json({ success: false, message: 'Not authorized' });
  });
  
  // DELETE /api/users/:id - Delete user (Admin only)
  router.delete("/:id", authorize("ADMIN"), userController.deleteUser);
  
  module.exports = router;