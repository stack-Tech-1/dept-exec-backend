const express = require("express");
const {
  inviteUser,
  registerWithInvite,
  login,
} = require("../controllers/auth.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validateInviteToken } = require("../controllers/auth.controller");


const router = express.Router();

// ✅ HARDENED: Use authorize middleware
router.post("/invite", authenticate, authorize("ADMIN"), inviteUser);

// PUBLIC: Register with invite token
router.post("/register", registerWithInvite);

// Add this route (public - no auth needed)
router.get("/validate-invite/:token", validateInviteToken);

// PUBLIC: Login
router.post("/login", login);

module.exports = router;