const VotingSession = require('../models/votingSession.model');
const Election = require('../models/election.model');
const Member = require('../models/member.model');
const User = require('../models/user.model');

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
    if (session.isPaused) {
      return res.json({ isPaused: true, label: session.label, message: 'Voting is temporarily paused. Please check back soon.' });
    }
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

// PATCH /api/voting-sessions/:token/close-all — admin only
exports.closeSessionElections = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });

    const now = new Date();
    await Election.updateMany(
      { _id: { $in: session.elections }, status: 'OPEN' },
      { $set: { status: 'CLOSED', closedAt: now } }
    );

    session.isActive = false;
    await session.save();

    const io = req.app.get('io');
    if (io) {
      for (const elId of session.elections) {
        io.emit('election-status-update', { electionId: elId.toString(), status: 'CLOSED' });
      }
    }

    res.json({ message: 'All elections in this session have been closed.' });
  } catch (err) {
    console.error('Close session elections error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// DELETE /api/voting-sessions/:token — admin only
exports.deleteSession = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token })
      .populate('elections', 'status');
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });

    const hasOpenElections = session.elections.some(e => e.status === 'OPEN');
    if (hasOpenElections) {
      return res.status(400).json({ message: 'Cannot delete a session that has open elections. Close all elections first.' });
    }

    await VotingSession.deleteOne({ token: req.params.token });
    res.json({ message: 'Voting session deleted.' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// PATCH /api/voting-sessions/:token/pause — admin only
exports.pauseSession = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });
    if (!session.isActive) return res.status(400).json({ message: 'Session is already deactivated.' });
    session.isPaused = true;
    await session.save();
    res.json({ message: 'Voting session paused.', isPaused: true });
  } catch (err) {
    console.error('Pause session error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// PATCH /api/voting-sessions/:token/resume — admin only
exports.resumeSession = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });
    session.isPaused = false;
    await session.save();
    res.json({ message: 'Voting session resumed.', isPaused: false });
  } catch (err) {
    console.error('Resume session error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// POST /api/voting-sessions/:token/vote — public
exports.submitVotes = async (req, res) => {
  try {
    const { identifier, votes, code } = req.body;
    if (!identifier?.trim()) {
      return res.status(400).json({ message: 'Identifier (matric number) is required.' });
    }
    if (!code?.trim()) {
      return res.status(400).json({ message: 'Vote code is required. Please check your email.' });
    }
    if (!Array.isArray(votes)) {
      return res.status(400).json({ message: 'votes must be an array.' });
    }

    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });
    if (!session.isActive) return res.status(400).json({ message: 'This voting session is no longer active.' });
    if (session.isPaused) {
      return res.status(400).json({ message: 'Voting is currently paused. Please wait for it to resume.' });
    }
    if (session.expiresAt && session.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This voting session has expired.' });
    }

    const normalizedId = identifier.trim().toUpperCase();

    const member = await Member.findOne({ matricNumber: normalizedId, isActive: true }).select('+voteCode +voteCodeExpiry');
    if (!member) {
      return res.status(403).json({ message: 'Matric number not found. Only registered department members can vote.' });
    }

    // Validate vote code
    if (!member.voteCode || member.voteCode !== code.trim() ||
        !member.voteCodeExpiry || member.voteCodeExpiry < new Date()) {
      return res.status(403).json({ message: 'Invalid or expired vote code. Please check your email.' });
    }

    const isExec = await User.findOne({ matricNumber: normalizedId });
    if (isExec) {
      return res.status(403).json({ message: 'Executives are not eligible to vote.' });
    }

    const alreadyVoted = session.voterLog.some(v => v.identifier === normalizedId);
    if (alreadyVoted) {
      return res.status(400).json({ message: 'You have already voted in this session.' });
    }

    const sessionElectionIds = session.elections.map(id => id.toString());
    const votedElectionIds = new Set();

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
      election.voters.push({
        matricNumber: normalizedId,
        candidateId: candidate._id,
        votedAt: new Date()
      });
      await election.save();

      votedElectionIds.add(electionId.toString());
    }

    // Increment undecidedCount for elections in session that were skipped
    for (const elId of sessionElectionIds) {
      if (!votedElectionIds.has(elId)) {
        await Election.findByIdAndUpdate(elId, { $inc: { undecidedCount: 1 } });
      }
    }

    session.voterLog.push({ identifier: normalizedId, electionsVoted: sessionElectionIds });
    await session.save();

    // Invalidate the vote code so it cannot be reused
    await Member.findByIdAndUpdate(member._id, { $unset: { voteCode: '', voteCodeExpiry: '' } });

    res.json({ message: 'Votes submitted successfully.' });
  } catch (err) {
    console.error('Submit votes error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET /api/voting-sessions/:token/voters — admin only
exports.getSessionVoters = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });

    const matrics = session.voterLog.map(v => v.identifier);
    const members = await Member.find({ matricNumber: { $in: matrics } }).select('name matricNumber').lean();
    const nameMap = {};
    members.forEach(m => { nameMap[m.matricNumber] = m.name; });

    const voters = session.voterLog.map(v => ({
      identifier: v.identifier,
      name: nameMap[v.identifier] ?? null,
      votedAt: v.votedAt,
    }));

    res.json(voters);
  } catch (err) {
    console.error('Get session voters error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// DELETE /api/voting-sessions/:token/votes/:matricNumber — admin only
exports.revokeVote = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token });
    if (!session) return res.status(404).json({ message: 'Voting session not found.' });

    const normalizedMatric = req.params.matricNumber.toUpperCase();
    const logIndex = session.voterLog.findIndex(v => v.identifier === normalizedMatric);
    if (logIndex === -1) return res.status(404).json({ message: 'This member has not voted in this session.' });

    // Capture full vote snapshot before any deletion
    const revEntry = { identifier: normalizedMatric, revokedBy: req.user.id, elections: [] };
    for (const elId of session.elections) {
      const elSnap = await Election.findById(elId);
      if (!elSnap) continue;
      const vr = elSnap.voters.find(v => v.matricNumber === normalizedMatric);
      if (!vr) continue;
      const cand = elSnap.candidates.id(vr.candidateId);
      revEntry.elections.push({
        electionId:    elSnap._id,
        electionTitle: elSnap.title,
        candidateId:   vr.candidateId,
        candidateName: cand?.name ?? null,
        votedAt:       vr.votedAt,
      });
    }
    session.revocationLog.push(revEntry);

    for (const elId of session.elections) {
      const election = await Election.findById(elId);
      if (!election) continue;

      const voterIndex = election.voters.findIndex(v => v.matricNumber === normalizedMatric);
      if (voterIndex !== -1) {
        const { candidateId } = election.voters[voterIndex];
        const candidate = election.candidates.id(candidateId);
        if (candidate && candidate.voteCount > 0) candidate.voteCount -= 1;
        if (election.totalVotes > 0) election.totalVotes -= 1;
        election.voters.splice(voterIndex, 1);
      } else {
        if (election.undecidedCount > 0) election.undecidedCount -= 1;
      }
      await election.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('vote-cast', {
          electionId: election._id.toString(),
          candidates: election.candidates,
          totalVotes: election.totalVotes,
        });
      }
    }

    session.voterLog.splice(logIndex, 1);
    await session.save();

    res.json({ message: 'Vote revoked. This member may now vote again with a new code.' });
  } catch (err) {
    console.error('Revoke vote error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET /voting-sessions/:token/revocation-log — admin only
exports.getRevocationLog = async (req, res) => {
  try {
    const session = await VotingSession.findOne({ token: req.params.token })
      .populate('revocationLog.revokedBy', 'name position');
    if (!session) return res.status(404).json({ message: 'Session not found.' });

    const matrics = session.revocationLog.map(r => r.identifier);
    const members = await Member.find({ matricNumber: { $in: matrics } })
      .select('name matricNumber level isActive').lean();
    const memberMap = Object.fromEntries(members.map(m => [m.matricNumber, m]));

    const log = session.revocationLog.map(r => ({
      identifier:      r.identifier,
      revokedAt:       r.revokedAt,
      revokedBy:       r.revokedBy,
      elections:       r.elections,
      memberName:      memberMap[r.identifier]?.name ?? null,
      memberLevel:     memberMap[r.identifier]?.level ?? null,
      memberIsDeleted: memberMap[r.identifier] ? !memberMap[r.identifier].isActive : true,
    }));

    res.json(log);
  } catch (err) {
    console.error('Get revocation log error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
