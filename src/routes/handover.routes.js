const express = require('express');
const router = express.Router();
const handoverController = require('../controllers/handover.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/', handoverController.getHandovers);
router.get('/:id', handoverController.getHandoverById);
router.post('/', handoverController.createHandover);
router.put('/:id', handoverController.updateHandover);

module.exports = router;
