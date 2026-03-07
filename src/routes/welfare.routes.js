const express = require('express');
const router = express.Router();
const welfareController = require('../controllers/welfare.controller');
const { authenticate } = require('../middleware/auth.middleware');

// PUBLIC routes
router.post('/submit', welfareController.submitTicket);
router.get('/check/:ticketId', welfareController.checkTicketStatus);

// Protected routes — all exec
router.use(authenticate);
router.get('/stats', welfareController.getStats);
router.get('/', welfareController.getTickets);
router.get('/:id', welfareController.getTicketById);
router.post('/:id/respond', welfareController.respondToTicket);
router.patch('/:id', welfareController.updateTicket);

module.exports = router;
