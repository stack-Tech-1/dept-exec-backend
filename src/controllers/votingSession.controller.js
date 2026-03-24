const VotingSession = require('../models/votingSession.model');
const Election = require('../models/election.model');

// POST /api/voting-sessions — admin only
exports.createSession = async (req, res) => {
  try {
    const { elections, label, expiresAt } = req.body;
    if (!Array.isArray(elections) || elections.length === 0) {
      return res.status(400).json({ message: 'At least one election is required.' });
    }

    const session = await VotingSession.create({
      elections,
      label,
      expiresAt: expiresAt || undefined,
      createdBy: req.user.id
    });

    const populated = await VotingSession.findById(session._id)
      .populate('elections', 'title position status')
      .populate('createdBy', 'name position');

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET /api/voting-sessions — authenticated
exports.listSessions = async (req, res) => {
  try {
    const sessions = await VotingSession.find()
      .populate('elections', 'title position status')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .select('-voterLog');
    res.json(sessions);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET /api/voting-sessions/:token — public
exports.getSessionByToken = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token })
      .populate({
        path: 'elections',
        select: '-voters'
      });

    if (!session) return res.status(404).json({ message: 'Voting session not found.' });
    if (!session.isActive) return res.status(400).json({ message: 'This voting session is no longer active.' });
    if (session.expiresAt && session.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This voting session has expired.' });
    }

    // Strip voteCount from candidates before sending
    const obj = session.toObject();
    obj.elections = obj.elections.map(e => ({
      ...e,
      candidates: e.candidates.map(({ voteCount, ...rest }) => rest)
    }));
    delete obj.voterLog;

    res.json(obj);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// PATCH /api/voting-sessions/:token/deactivate — admin only
exports.deactivateSession = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });

    session.isActive = false;
    await session.save();

    res.json({ message: 'Voting session deactivated.', isActive: false });
  } catch (err) {
    console.error('Deactivate session error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// POST /api/voting-sessions/:token/vote — public
exports.submitVotes = async (req, res) => {
  try {
    const { identifier, votes } = req.body;
    if (!identifier?.trim()) {
      return res.status(400).json({ message: 'Identifier (matric number) is required.' });
    }
    if (!Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ message: 'At least one vote is required.' });
    }

    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });
    if (!session.isActive) return res.status(400).json({ message: 'This voting session is no longer active.' });
    if (session.expiresAt && session.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This voting session has expired.' });
    }

    const normalizedId = identifier.trim().toUpperCase();
    const alreadyVoted = session.voterLog.some(v => v.identifier === normalizedId);
    if (alreadyVoted) {
      return res.status(400).json({ message: 'You have already voted in this session.' });
    }

    const sessionElectionIds = session.elections.map(id => id.toString());
    const electionsVoted = [];

    for (const vote of votes) {
      const { electionId, candidateId } = vote;
      if (!electionId || !candidateId) {
        return res.status(400).json({ message: 'Each vote must include electionId and candidateId.' });
      }
      if (!sessionElectionIds.includes(electionId.toString())) {
        return res.status(400).json({ message: `Election ${electionId} is not part of this voting session.` });
      }

      const election = await Election.findById(electionId);
      if (!election) return res.status(404).json({ message: `Election ${electionId} not found.` });
      if (election.status !== 'OPEN') {
        return res.status(400).json({ message: `Election "${election.title}" is not currently open for voting.` });
      }

      const candidate = election.candidates.id(candidateId);
      if (!candidate) return res.status(404).json({ message: `Candidate not found in election "${election.title}".` });

      candidate.voteCount += 1;
      election.totalVotes += 1;
      await election.save();

      electionsVoted.push(electionId);
    }

    session.voterLog.push({ identifier: normalizedId, electionsVoted });
    await session.save();

    res.json({ message: 'Votes submitted successfully.' });
  } catch (err) {
    console.error('Submit votes error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
