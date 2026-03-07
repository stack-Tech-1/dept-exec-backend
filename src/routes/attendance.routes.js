const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// PUBLIC routes — no auth needed (for member QR scanning)
router.get('/code/:code', attendanceController.getSessionByCode);
router.post('/code/:code/mark', attendanceController.markAttendance);

// Protected routes — exec portal users
router.use(authenticate);
router.get('/', attendanceController.getSessions);
router.get('/:id', attendanceController.getSessionById);
router.get('/:id/export', authorize(['ADMIN']), attendanceController.exportSession);
router.post('/', authorize(['ADMIN']), attendanceController.createSession);
router.patch('/:id/close', authorize(['ADMIN']), attendanceController.closeSession);

module.exports = router;
