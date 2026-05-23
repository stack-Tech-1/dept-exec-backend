const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/votingSession.controller');
const { authenticate, adminOnly, electionAdminOnly } = require('../middleware/auth.middleware');

// PUBLIC
router.get('/:token',        ctrl.getSessionByToken);
router.post('/:token/vote',  ctrl.submitVotes);

// Protected
router.use(authenticate);
router.get('/',              ctrl.listSessions);
router.post('/',             electionAdminOnly, ctrl.createSession);
router.patch('/:token/deactivate',  electionAdminOnly, ctrl.deactivateSession);
router.patch('/:token/close-all',   electionAdminOnly, ctrl.closeSessionElections);
router.patch('/:token/pause',       electionAdminOnly, ctrl.pauseSession);
router.patch('/:token/resume',      electionAdminOnly, ctrl.resumeSession);
router.get('/:token/voters',        adminOnly, ctrl.getSessionVoters);
router.delete('/:token/votes/:matricNumber', electionAdminOnly, ctrl.revokeVote);
router.delete('/:token',            electionAdminOnly, ctrl.deleteSession);

module.exports = router;
