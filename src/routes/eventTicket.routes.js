const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/eventTicket.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// PUBLIC — scanner reads ticket info
router.get('/token/:token', ctrl.getTicketByToken);

// All routes below require authentication
router.use(authenticate);

// Admin: list tickets for an event
router.get('/event/:eventId', ctrl.getEventTickets);
router.get('/event/:eventId/export', authorize(['ADMIN']), ctrl.exportTickets);

// Admin: create tickets for members
router.post('/', authorize(['ADMIN']), ctrl.createTickets);

// Admin: confirm payment + email
router.put('/:id/confirm', authorize(['ADMIN']), ctrl.confirmPayment);
router.post('/:id/resend', authorize(['ADMIN']), ctrl.resendTicketEmail);

// Admin: scanner actions (any authenticated user can scan)
router.put('/token/:token/checkin', ctrl.checkIn);
router.put('/token/:token/redeem', ctrl.redeemItem);

module.exports = router;
