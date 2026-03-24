const Member = require('../models/member.model');
const MemberRegistrationLink = require('../models/memberRegistrationLink.model');

// GET all members with filtering + pagination
exports.getMembers = async (req, res) => {
  try {
    const { level, gender, duesPaid, session, search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };
    if (level) filter.level = level;
    if (gender) filter.gender = gender;
    if (search) filter.$text = { $search: search };
    if (duesPaid !== undefined && session) {
      filter['dues'] = { $elemMatch: { session, paid: duesPaid === 'true' } };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [members, total] = await Promise.all([
      Member.find(filter).sort({ level: 1, name: 1 }).skip(skip).limit(parseInt(limit)).populate('addedBy', 'name'),
      Member.countDocuments(filter)
    ]);
    res.json({ members, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET single member
exports.getMemberById = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id).populate('addedBy', 'name').populate('dues.recordedBy', 'name');
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST create member (admin only)
exports.createMember = async (req, res) => {
  try {
    const member = await Member.create({ ...req.body, addedBy: req.user.id });
    res.status(201).json(member);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Matric number already exists' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT update member (admin only)
exports.updateMember = async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE member (admin only, soft delete)
exports.deleteMember = async (req, res) => {
  try {
    await Member.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST record dues payment (admin only)
exports.recordDues = async (req, res) => {
  try {
    const { session, semester, amount, paid, note } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    const existingIndex = member.dues.findIndex(d => d.session === session && d.semester === semester);
    if (existingIndex >= 0) {
      member.dues[existingIndex] = { session, semester, amount, paid, paidAt: paid ? new Date() : null, recordedBy: req.user.id, note };
    } else {
      member.dues.push({ session, semester, amount, paid, paidAt: paid ? new Date() : null, recordedBy: req.user.id, note });
    }
    await member.save();
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST bulk import via CSV data (admin only)
exports.bulkImport = async (req, res) => {
  try {
    const { members } = req.body; // array of member objects
    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: 'No members data provided' });
    }
    const withAdder = members.map(m => ({ ...m, addedBy: req.user.id }));
    const result = await Member.insertMany(withAdder, { ordered: false });
    res.status(201).json({ message: `${result.length} members imported successfully`, count: result.length });
  } catch (err) {
    if (err.writeErrors) {
      return res.status(207).json({ message: `Imported with some errors`, imported: err.result?.nInserted, errors: err.writeErrors.length });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET member statistics
exports.getMemberStats = async (req, res) => {
  try {
    const { session } = req.query;
    const [total, byLevel, byGender] = await Promise.all([
      Member.countDocuments({ isActive: true }),
      Member.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$level', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Member.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$gender', count: { $sum: 1 } } }])
    ]);
    let duesPaid = 0, duesUnpaid = 0;
    if (session) {
      [duesPaid, duesUnpaid] = await Promise.all([
        Member.countDocuments({ isActive: true, dues: { $elemMatch: { session, paid: true } } }),
        Member.countDocuments({ isActive: true, dues: { $elemMatch: { session, paid: false } } })
      ]);
    }
    res.json({
      total,
      byLevel: byLevel.reduce((acc, cur) => { acc[cur._id] = cur.count; return acc; }, {}),
      byGender: byGender.reduce((acc, cur) => { acc[cur._id] = cur.count; return acc; }, {}),
      dues: { paid: duesPaid, unpaid: duesUnpaid }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST create registration link (admin only)
exports.createLink = async (req, res) => {
  try {
    const { label, expiresAt } = req.body;
    if (!expiresAt) return res.status(400).json({ message: 'expiresAt is required.' });
    const link = await MemberRegistrationLink.create({ label, expiresAt, createdBy: req.user.id });
    const populated = await MemberRegistrationLink.findById(link._id).populate('createdBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create link error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET list all registration links (admin only)
exports.listLinks = async (req, res) => {
  try {
    const links = await MemberRegistrationLink.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(links);
  } catch (err) {
    console.error('List links error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// DELETE deactivate a registration link (admin only)
exports.deactivateLink = async (req, res) => {
  try {
    const link = await MemberRegistrationLink.findById(req.params.id);
    if (!link) return res.status(404).json({ message: 'Registration link not found.' });
    link.isActive = false;
    await link.save();
    res.json({ message: 'Registration link deactivated.', isActive: false });
  } catch (err) {
    console.error('Deactivate link error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET validate a registration link (PUBLIC)
exports.validateLink = async (req, res) => {
  try {
    const link = await MemberRegistrationLink.findOne({ token: req.params.token });
    if (!link || !link.isActive) {
      return res.status(400).json({ message: 'This registration link is invalid or no longer active.' });
    }
    if (link.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This registration link has expired.' });
    }
    res.json({ label: link.label, expiresAt: link.expiresAt });
  } catch (err) {
    console.error('Validate link error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// POST register a member via link (PUBLIC)
exports.registerMember = async (req, res) => {
  try {
    const link = await MemberRegistrationLink.findOne({ token: req.params.token });
    if (!link || !link.isActive) {
      return res.status(400).json({ message: 'This registration link is invalid or no longer active.' });
    }
    if (link.expiresAt < new Date()) {
      return res.status(400).json({ message: 'This registration link has expired.' });
    }

    const { fullName, email, matricNumber, level, phone, gender } = req.body;
    if (!fullName?.trim() || !email?.trim() || !matricNumber?.trim() || !level || !phone?.trim() || !gender) {
      return res.status(400).json({ message: 'All fields are required: fullName, email, matricNumber, level, phone, gender.' });
    }

    const existingEmail = await Member.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) return res.status(400).json({ message: 'Email already registered.' });

    const existingMatric = await Member.findOne({ matricNumber: matricNumber.trim().toUpperCase() });
    if (existingMatric) return res.status(400).json({ message: 'Matric number already registered.' });

    const member = await Member.create({
      name: fullName.trim(),
      email: email.toLowerCase().trim(),
      matricNumber: matricNumber.trim().toUpperCase(),
      level,
      phone: phone.trim(),
      gender,
      registrationToken: link._id,
      registeredAt: new Date()
    });

    res.status(201).json({ message: 'Registration successful.', memberId: member._id });
  } catch (err) {
    console.error('Register member error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0];
      return res.status(400).json({ message: `${field === 'email' ? 'Email' : 'Matric number'} already registered.` });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
