const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadTaskFile } = require('../config/cloudinary');

router.use(authenticate);

router.get('/', eventController.getEvents);
router.get('/stats', eventController.getEventStats);
router.get('/:id', eventController.getEventById);
router.post('/upload-image', authorize(['ADMIN']), uploadTaskFile.single('coverImage'), eventController.uploadCoverImage);
router.post('/', authorize(['ADMIN']), eventController.createEvent);
router.put('/:id', authorize(['ADMIN']), eventController.updateEvent);
router.patch('/:id/status', authorize(['ADMIN']), eventController.updateEventStatus);
router.post('/:id/rsvp', eventController.rsvpEvent);

module.exports = router;
