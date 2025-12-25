const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/authorize"); // ✅ ADD THIS
const upload = require("../utils/upload");
const {
  createMinutes,
  getAllMinutes,
  getMinutesById,
  updateMinutes,
  approveMinutes,
  downloadMinutesPDF,
} = require("../controllers/minutes.controller");

const router = express.Router();

// ✅ HARDENED: Use authorizeRoles middleware
router.post(
  "/",
  protect,
  authorizeRoles("ADMIN"),
  upload.single("recording"),
  createMinutes
);

// ALL USERS: view all minutes (with security filtering in controller)
router.get("/", protect, getAllMinutes);

// ALL USERS: view specific minutes by ID (with security in controller)
router.get("/:id", protect, getMinutesById);

// Download approved minutes as PDF
router.get("/:id/pdf", protect, downloadMinutesPDF);

// ✅ HARDENED: Use authorizeRoles middleware
router.put("/:id", protect, authorizeRoles("ADMIN"), updateMinutes);

// ✅ HARDENED: Use authorizeRoles middleware
router.patch("/:id/approve", protect, authorizeRoles("ADMIN"), approveMinutes);

// ✅ HARDENED: Disable DELETE entirely for audit integrity
router.delete("/:id", protect, (req, res) => {
  res.status(403).json({
    message: "Minutes cannot be deleted for audit integrity",
  });
});

module.exports = router;