const Attendance = require('../models/attendance.model');
const Member = require('../models/member.model');
const crypto = require('crypto');

// Generate a short unique session code
const generateCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

// POST create attendance session (admin only)
exports.createSession = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });

    // Generate unique code, retry if collision
    let sessionCode, exists = true;
    while (exists) {
      sessionCode = generateCode();
      exists = await Attendance.findOne({ sessionCode });
    }

    const session = await Attendance.create({
      title,
      description,
      sessionCode,
      createdBy: req.user.id,
      status: 'OPEN'
    });

    const populated = await Attendance.findById(session._id)
      .populate('createdBy', 'name position');

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET all attendance sessions
exports.getSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [sessions, total] = await Promise.all([
      Attendance.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name position'),
      Attendance.countDocuments(filter)
    ]);
    res.json({ sessions, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET single session with attendees
exports.getSessionById = async (req, res) => {
  try {
    const session = await Attendance.findById(req.params.id)
      .populate('createdBy', 'name position');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET session by code (PUBLIC — no auth — for member scanning)
exports.getSessionByCode = async (req, res) => {
  try {
    const session = await Attendance.findOne({
      sessionCode: req.params.code.toUpperCase()
    }).select('title description status sessionCode createdAt');
    if (!session) return res.status(404).json({ message: 'Invalid attendance code' });
    if (session.status === 'CLOSED') {
      return res.status(400).json({ message: 'This attendance session is closed' });
    }
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST mark attendance (PUBLIC — no auth — member submits matric number)
exports.markAttendance = async (req, res) => {
  try {
    const { matricNumber } = req.body;
    if (!matricNumber?.trim()) {
      return res.status(400).json({ message: 'Matric number is required' });
    }

    const session = await Attendance.findOne({
      sessionCode: req.params.code.toUpperCase()
    });
    if (!session) return res.status(404).json({ message: 'Invalid attendance code' });
    if (session.status === 'CLOSED') {
      return res.status(400).json({ message: 'This attendance session is closed' });
    }

    // Find member by matric number
    const member = await Member.findOne({
      matricNumber: matricNumber.trim().toUpperCase(),
      isActive: true
    });
    if (!member) {
      return res.status(404).json({ message: 'Matric number not found. Please check and try again.' });
    }

    // Check if already marked
    const alreadyMarked = session.attendees.some(
      a => a.member.toString() === member._id.toString()
    );
    if (alreadyMarked) {
      return res.status(400).json({ message: `${member.name}, you are already marked present!` });
    }

    // Mark attendance
    session.attendees.push({
      member: member._id,
      name: member.name,
      matricNumber: member.matricNumber,
      level: member.level,
      markedAt: new Date()
    });
    await session.save();

    // Emit real-time update to admin via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('attendance-update', {
        sessionId: session._id,
        attendee: {
          name: member.name,
          matricNumber: member.matricNumber,
          level: member.level,
          markedAt: new Date()
        }
      });
    }

    res.json({
      message: `✅ Attendance recorded! Welcome, ${member.name}.`,
      member: { name: member.name, level: member.level }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH close session (admin only)
exports.closeSession = async (req, res) => {
  try {
    const session = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status: 'CLOSED', closedAt: new Date() },
      { new: true }
    ).populate('createdBy', 'name position');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Notify all connected clients that session is closed
    const io = req.app.get('io');
    if (io) {
      io.emit('attendance-closed', { sessionId: session._id, sessionCode: session.sessionCode });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET export attendance as CSV data (admin only)
exports.exportSession = async (req, res) => {
  try {
    const session = await Attendance.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const rows = [
      ['Name', 'Matric Number', 'Level', 'Time Marked'],
      ...session.attendees.map(a => [
        a.name,
        a.matricNumber,
        a.level,
        new Date(a.markedAt).toLocaleString()
      ])
    ];

    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${session.sessionCode}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
