const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

// All user routes require authentication
router.use(authenticate);

// GET /api/users - Get all users (Admin only)
router.get("/", authorize("ADMIN"), userController.getAllUsers);

// GET /api/users/statistics
router.get("/statistics", userController.getUserStatistics);

// GET /api/users/search?query=string
router.get("/search", userController.searchUsers);

// GET /api/users/profile - Get current user profile
router.get("/profile", userController.getCurrentUser);

// PUT /api/users/profile - Update current user profile
router.put("/profile", userController.updateCurrentUser);

// POST /api/users/change-password - Change own password
router.post("/change-password", userController.changePassword);

// POST /api/users/:id/reactivate - Reactivate member (Admin only)
router.post("/:id/reactivate", authorize("ADMIN"), userController.reactivateUser);

// GET /api/users/:id - Get user by ID
router.get("/:id", (req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.id === req.params.id) {
    return userController.getUserById(req, res, next);
  }
  return res.status(403).json({ success: false, message: 'Not authorized' });
});

// PUT /api/users/:id - Update user
router.put("/:id", (req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.id === req.params.id) {
    return userController.updateUser(req, res, next);
  }
  return res.status(403).json({ success: false, message: 'Not authorized' });
});

// DELETE /api/users/:id - Deactivate user (Admin only)
router.delete("/:id", authorize("ADMIN"), userController.deleteUser);

module.exports = router;