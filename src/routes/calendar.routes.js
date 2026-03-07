const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', calendarController.getEvents);
router.get('/upcoming', calendarController.getUpcoming);
router.post('/', authorize(['ADMIN']), calendarController.createEvent);
router.put('/:id', authorize(['ADMIN']), calendarController.updateEvent);
router.delete('/:id', authorize(['ADMIN']), calendarController.deleteEvent);

module.exports = router;
