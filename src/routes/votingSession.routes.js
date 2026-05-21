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
router.patch('/:token/deactivate',  adminOnly, ctrl.deactivateSession);
router.patch('/:token/close-all',   adminOnly, ctrl.closeSessionElections);
router.patch('/:token/pause',       adminOnly, ctrl.pauseSession);
router.patch('/:token/resume',      adminOnly, ctrl.resumeSession);
router.get('/:token/voters',                   adminOnly, ctrl.getSessionVoters);
router.delete('/:token/votes/:matricNumber',   adminOnly, ctrl.revokeVote);
router.delete('/:token',            adminOnly, ctrl.deleteSession);

module.exports = router;
