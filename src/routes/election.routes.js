const express = require('express');
const router = express.Router();
const electionController = require('../controllers/election.controller');
const { authenticate, authorize, electionAdminOnly } = require('../middleware/auth.middleware');
const { uploadTaskFile } = require('../config/cloudinary');

// PUBLIC routes — no auth needed
router.get('/:id/public', electionController.getElectionById);
router.post('/:id/vote', electionController.castVote);
router.get('/:id/check-voted', electionController.checkVoted);

// Protected routes
router.use(authenticate);
router.get('/', electionController.getElections);
router.get('/:id', electionController.getElectionById);
router.post('/', electionAdminOnly, electionController.createElection);
router.post('/:id/candidates', electionAdminOnly, uploadTaskFile.single('photo'), electionController.addCandidate);
router.delete('/:id/candidates/:candidateId', electionAdminOnly, electionController.removeCandidate);
router.patch('/:id/status', electionAdminOnly, electionController.updateStatus);
router.delete('/:id', electionAdminOnly, electionController.deleteElection);
router.get('/vote-audit', authorize(['ADMIN']), electionController.getVoteAudit);
router.get('/:id/voter-breakdown', authorize(['ADMIN']), electionController.getVoterBreakdown);

module.exports = router;
