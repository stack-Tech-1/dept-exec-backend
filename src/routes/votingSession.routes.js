const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/votingSession.controller');
const { authenticate, adminOnly } = require('../middleware/auth.middleware');

// PUBLIC
router.get('/:token',        ctrl.getSessionByToken);
router.post('/:token/vote',  ctrl.submitVotes);

// Protected
router.use(authenticate);
router.get('/',              ctrl.listSessions);
router.post('/',             adminOnly, ctrl.createSession);
router.patch('/:token/deactivate', adminOnly, ctrl.deactivateSession);

module.exports = router;
