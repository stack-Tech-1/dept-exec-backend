const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', announcementController.getAnnouncements);
router.get('/:id', announcementController.getAnnouncementById);
router.post('/', authorize(['ADMIN']), announcementController.sendAnnouncement);

module.exports = router;
