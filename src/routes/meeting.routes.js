// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\meeting.routes.js
const express = require("express");
const router = express.Router();
const meetingController = require("../controllers/meeting.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

// Get all meetings (Admin sees all, Exec sees upcoming)
router.get("/", meetingController.getAllMeetings);

// Get upcoming meetings (for dashboard)
router.get("/upcoming", meetingController.getUpcomingMeetings);

// Get meeting statistics
router.get("/statistics", meetingController.getMeetingStatistics);

// Get user's meetings (with RSVP status)
router.get("/user", meetingController.getUserMeetings);

// Get meeting by ID
router.get("/:id", meetingController.getMeetingById);

// Create meeting (admin only)
router.post("/", authorize(["ADMIN"]), meetingController.createMeeting);

// Update meeting (admin only)
router.put("/:id", authorize(["ADMIN"]), meetingController.updateMeeting);

// Delete meeting (admin only)
router.delete("/:id", authorize(["ADMIN"]), meetingController.deleteMeeting);

// Update RSVP (both Admin and Exec)
router.post("/:id/rsvp", meetingController.updateRSVP);

// Link minutes to meeting (admin or meeting creator)
router.post("/:id/minutes", meetingController.linkMinutes);

module.exports = router;