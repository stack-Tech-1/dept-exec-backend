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
router.delete('/:id', authorize(['ADMIN']), electionController.deleteElection);
router.get('/:id/voter-breakdown', (req, res, next) => {
  if (req.user.role === 'ADMIN' || req.user.position === 'Electoral Chairman') return next();
  return res.status(403).json({ message: 'Access denied.' });
}, electionController.getVoterBreakdown);

module.exports = router;
