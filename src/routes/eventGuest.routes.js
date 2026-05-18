const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/eventGuest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// PUBLIC — basic event info for registration page (title, date, venue, guestRegistrationEnabled)
router.get('/events/:eventId/public-info', ctrl.getEventPublicInfo);

// PUBLIC — guest self-registration for a specific event
router.post('/events/:eventId/guests/register', ctrl.registerGuest);

// PUBLIC — guest ticket view by token
router.get('/guests/token/:token', ctrl.getGuestByToken);

// Admin — list + export guests for an event
router.get('/events/:eventId/guests', authenticate, ctrl.getGuestsForEvent);
router.get('/events/:eventId/guests/export', authenticate, authorize(['ADMIN']), ctrl.exportGuestsCsv);

// Admin — per-guest payment and email actions
router.patch('/guests/:id/confirm-payment', authenticate, authorize(['ADMIN']), ctrl.confirmGuestPayment);
router.post('/guests/:id/resend', authenticate, authorize(['ADMIN']), ctrl.resendGuestEmail);

// Admin — scanner actions (any authenticated user can scan)
router.patch('/guests/token/:token/checkin', authenticate, ctrl.checkInGuest);
router.patch('/guests/token/:token/redeem', authenticate, ctrl.redeemGuestItem);

module.exports = router;
