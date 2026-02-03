// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\minutes.routes.js
const express = require("express");
const router = express.Router();
const minutesController = require("../controllers/minutes.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");

// All routes require authentication
router.use(authenticate);

// Get all minutes (Exec can only see approved)
router.get("/", minutesController.getAllMinutes);

// Get minutes statistics
router.get("/statistics", minutesController.getMinutesStatistics);

// Get single minutes
router.get("/:id", minutesController.getMinutesById);

// Download PDF (Exec can download approved minutes)
router.get("/:id/download", minutesController.downloadMinutesPDF);

// Create minutes (admin only)
router.post("/", 
  authorize(["ADMIN"]), 
  upload.single("recording"), 
  minutesController.createMinutes
);

// Update minutes (admin only, only if not approved)
router.put("/:id", 
  authorize(["ADMIN"]), 
  minutesController.updateMinutes
);

// Approve minutes (admin only, cannot self-approve)
router.post("/:id/approve", 
  authorize(["ADMIN"]), 
  minutesController.approveMinutes
);

// Delete minutes (admin only, only if not approved)
router.delete("/:id", 
  authorize(["ADMIN"]), 
  minutesController.deleteMinutes
);

module.exports = router;