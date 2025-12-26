const express = require("express");
const {
  inviteUser,
  registerWithInvite,
  login,
} = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorize"); // ✅ ADD THIS
const { validateInviteToken } = require("../controllers/auth.controller");


const router = express.Router();

// ✅ HARDENED: Use authorizeRoles middleware
router.post("/invite", protect, authorizeRoles("ADMIN"), inviteUser);

// PUBLIC: Register with invite token
router.post("/register", registerWithInvite);

// Add this route (public - no auth needed)
router.get("/validate-invite/:token", validateInviteToken);

// PUBLIC: Login
router.post("/login", login);

module.exports = router;