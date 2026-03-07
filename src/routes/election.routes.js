const express = require('express');
const router = express.Router();
const electionController = require('../controllers/election.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadTaskFile } = require('../config/cloudinary');

// PUBLIC routes — no auth needed
router.get('/:id/public', electionController.getElectionById);
router.post('/:id/vote', electionController.castVote);
router.get('/:id/check-voted', electionController.checkVoted);

// Protected routes
router.use(authenticate);
router.get('/', electionController.getElections);
router.get('/:id', electionController.getElectionById);
router.post('/', authorize(['ADMIN']), electionController.createElection);
router.post('/:id/candidates', authorize(['ADMIN']), uploadTaskFile.single('photo'), electionController.addCandidate);
router.delete('/:id/candidates/:candidateId', authorize(['ADMIN']), electionController.removeCandidate);
router.patch('/:id/status', authorize(['ADMIN']), electionController.updateStatus);

module.exports = router;
