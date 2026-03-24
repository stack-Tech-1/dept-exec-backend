const Election = require('../models/election.model');
const Member = require('../models/member.model');

// GET all elections
exports.getElections = async (req, res) => {
  try {
    const { status, session } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (session) filter.session = session;
    const elections = await Election.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name position')
      .select('-voters.matricNumber'); // hide who voted for privacy
    res.json(elections);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET single election (public — for voting page)
exports.getElectionById = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'name position')
      .select('-voters.matricNumber');
    if (!election) return res.status(404).json({ message: 'Election not found' });
    res.json(election);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST create election (admin only)
exports.createElection = async (req, res) => {
  try {
    const { title, position, session, description } = req.body;
    if (!title?.trim() || !position?.trim() || !session?.trim()) {
      return res.status(400).json({ message: 'Title, position and session are required' });
    }
    const election = await Election.create({
      title, position, session, description,
      createdBy: req.user.id,
      status: 'PENDING'
    });
    const populated = await Election.findById(election._id).populate('createdBy', 'name position');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST add candidate to election (admin only)
exports.addCandidate = async (req, res) => {
  try {
    const { name, matricNumber, bio } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Candidate name is required' });

    const election = await Election.findById(req.params.id);
    if (!election) return res.status(404).json({ message: 'Election not found' });
    if (election.status === 'CLOSED') {
      return res.status(400).json({ message: 'Cannot add candidates to a closed election' });
    }

    // req.file.path is the Cloudinary URL set by uploadTaskFile middleware in the route
    const photoUrl = req.file?.path || null;

    election.candidates.push({ name, matricNumber, bio, photo: photoUrl });
    await election.save();
    res.json(election);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE remove candidate (admin only)
exports.removeCandidate = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) return res.status(404).json({ message: 'Election not found' });
    if (election.status === 'OPEN') {
      return res.status(400).json({ message: 'Cannot remove candidates while election is open' });
    }
    election.candidates = election.candidates.filter(
      c => c._id.toString() !== req.params.candidateId
    );
    await election.save();
    res.json(election);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH update election status (admin only)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['PENDING', 'OPEN', 'CLOSED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const election = await Election.findById(req.params.id);
    if (!election) return res.status(404).json({ message: 'Election not found' });
    if (election.status === 'CLOSED') {
      return res.status(400).json({ message: 'This election is already closed and cannot be changed.' });
    }
    if (status === 'PENDING' && election.status === 'OPEN') {
      return res.status(400).json({ message: 'An open election cannot be moved back to pending.' });
    }
    election.status = status;
    if (status === 'OPEN') election.openedAt = new Date();
    if (status === 'CLOSED') election.closedAt = new Date();
    await election.save();

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('election-status-update', {
        electionId: election._id,
        status
      });
    }

    const populated = await Election.findById(election._id)
      .populate('createdBy', 'name position')
      .select('-voters.matricNumber');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST cast vote (PUBLIC — matric number auth)
exports.castVote = async (req, res) => {
  try {
    const { matricNumber, candidateId } = req.body;
    if (!matricNumber?.trim() || !candidateId) {
      return res.status(400).json({ message: 'Matric number and candidate are required' });
    }

    const election = await Election.findById(req.params.id);
    if (!election) return res.status(404).json({ message: 'Election not found' });
    if (election.status !== 'OPEN') {
      return res.status(400).json({ message: 'This election is not currently open for voting' });
    }

    // Verify matric number exists in member DB
    const member = await Member.findOne({
      matricNumber: matricNumber.trim().toUpperCase(),
      isActive: true
    });
    if (!member) {
      return res.status(404).json({ message: 'Matric number not found. Only registered IESA members can vote.' });
    }

    // Check already voted
    const alreadyVoted = election.voters.some(
      v => v.matricNumber === matricNumber.trim().toUpperCase()
    );
    if (alreadyVoted) {
      return res.status(400).json({ message: 'You have already voted in this election.' });
    }

    // Find candidate
    const candidate = election.candidates.id(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Record vote
    candidate.voteCount += 1;
    election.totalVotes += 1;
    election.voters.push({
      matricNumber: matricNumber.trim().toUpperCase(),
      candidateId,
      votedAt: new Date()
    });
    await election.save();

    // Emit live results update
    const io = req.app.get('io');
    if (io) {
      io.emit('vote-cast', {
        electionId: election._id,
        candidateId,
        candidates: election.candidates.map(c => ({
          _id: c._id,
          name: c.name,
          voteCount: c.voteCount,
          percentage: election.totalVotes > 0
            ? Math.round((c.voteCount / election.totalVotes) * 100)
            : 0
        })),
        totalVotes: election.totalVotes
      });
    }

    res.json({
      message: `✅ Vote cast successfully for ${candidate.name}!`,
      totalVotes: election.totalVotes
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET check if matric number has voted (PUBLIC)
exports.checkVoted = async (req, res) => {
  try {
    const { matricNumber } = req.query;
    if (!matricNumber) return res.status(400).json({ message: 'Matric number required' });
    const election = await Election.findById(req.params.id);
    if (!election) return res.status(404).json({ message: 'Election not found' });
    const hasVoted = election.voters.some(
      v => v.matricNumber === matricNumber.trim().toUpperCase()
    );
    res.json({ hasVoted });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
