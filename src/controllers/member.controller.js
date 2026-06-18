const Member = require('../models/member.model');
const MemberRegistrationLink = require('../models/memberRegistrationLink.model');
const { sendEmail } = require('../utils/mailer');
const { isMatricInRange } = require('../utils/matricRanges');

// GET all members with filtering + pagination
exports.getMembers = async (req, res) => {
  try {
    const { level, gender, duesPaid, session, search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: req.query.isActive === 'false' ? false : true };
    if (level) filter.level = level;
    if (gender) filter.gender = gender;
    if (search) {
      const re = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: re }, { matricNumber: re }];
    }
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

// POST send vote code via email (admin only)
exports.sendVoteCode = async (req, res) => {
  try {
    const member = await Member.findById(req.params.id).select('+voteCode email name');
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (!member.email) return res.status(400).json({ message: 'This member has no email address on record.' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    member.voteCode = code;
    member.voteCodeExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    await member.save();

    const result = await sendEmail({
      to: member.email,
      subject: 'Your IESA Voting Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f9fafb;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#059669;font-size:22px;margin:0;">IESA Election</h1>
            <p style="color:#6b7280;font-size:13px;margin:6px 0 0;">Industrial &amp; Production Engineering Students' Association</p>
          </div>
          <p style="color:#111827;font-size:15px;">Hi <strong>${member.name}</strong>,</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;">Your personal voting code for the upcoming election is:</p>
          <div style="background:#fff;border:2px solid #d1fae5;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
            <span style="font-size:40px;font-weight:900;letter-spacing:0.3em;color:#059669;font-family:monospace;">${code}</span>
          </div>
          <p style="color:#374151;font-size:14px;line-height:1.6;">When voting, enter your <strong>matric number</strong> and this <strong>6-digit code</strong> together. The code is valid for <strong>48 hours</strong> and can only be used <strong>once</strong>.</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">If you did not request this code or have any concerns, please contact your association executives immediately.</p>
        </div>
      `
    });

    if (!result.success) {
      return res.status(500).json({ message: 'Failed to send email. Please try again.' });
    }

    res.json({ message: `Code sent to ${member.email}` });
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

function computeLinkStatus(link) {
  if (!link.isActive) return 'inactive';
  const endOfDay = new Date(link.expiresAt);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < new Date() ? 'expired' : 'active';
}

// POST create registration link (admin only)
exports.createLink = async (req, res) => {
  try {
    let { label, expiresAt } = req.body;
    if (!expiresAt) return res.status(400).json({ message: 'expiresAt is required.' });
    const expiry = new Date(expiresAt);
    expiry.setHours(23, 59, 59, 999);
    const link = await MemberRegistrationLink.create({ label, expiresAt: expiry, createdBy: req.user.id });
    const populated = await MemberRegistrationLink.findById(link._id).populate('createdBy', 'name');
    res.status(201).json({ ...populated.toObject(), status: computeLinkStatus(populated) });
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
    res.json(links.map(l => ({ ...l.toObject(), status: computeLinkStatus(l) })));
  } catch (err) {
    console.error('List links error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// DELETE a registration link (admin only)
exports.deactivateLink = async (req, res) => {
  try {
    const link = await MemberRegistrationLink.findByIdAndDelete(req.params.id);
    if (!link) return res.status(404).json({ message: 'Registration link not found.' });
    res.json({ message: 'Registration link deleted.' });
  } catch (err) {
    console.error('Delete link error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// GET list pending D.E. applications (admin only)
exports.listPendingDE = async (req, res) => {
  try {
    const members = await Member.find({ approvalStatus: 'pending' })
      .sort({ createdAt: 1 })
      .populate('addedBy', 'name');
    res.json(members);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH approve a pending D.E. member (admin only)
exports.approveMember = async (req, res) => {
  try {
    const member = await Member.findOneAndUpdate(
      { _id: req.params.id, approvalStatus: 'pending' },
      { isActive: true, approvalStatus: 'approved' },
      { new: true }
    );
    if (!member) return res.status(404).json({ message: 'Pending member not found.' });
    res.json({ message: 'Member approved.', member });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH restore a soft-deleted member (admin only)
exports.restoreMember = async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    if (!member) return res.status(404).json({ message: 'Member not found.' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE reject a pending D.E. application (admin only)
exports.rejectMember = async (req, res) => {
  try {
    const member = await Member.findOneAndDelete({ _id: req.params.id, approvalStatus: 'pending' });
    if (!member) return res.status(404).json({ message: 'Pending member not found.' });
    res.json({ message: 'Application rejected and removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET validate a registration link (PUBLIC)
exports.validateLink = async (req, res) => {
  try {
    const link = await MemberRegistrationLink.findOne({ token: req.params.token });
    if (!link || !link.isActive) {
      return res.status(400).json({ message: 'This registration link is invalid or no longer active.' });
    }
    const endOfDay = new Date(link.expiresAt); endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay < new Date()) {
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
    const endOfDay = new Date(link.expiresAt); endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay < new Date()) {
      return res.status(400).json({ message: 'This registration link has expired.' });
    }

    const { fullName, email, matricNumber, level, phone, gender, isDirectEntry } = req.body;
    if (!fullName?.trim() || !email?.trim() || !matricNumber?.trim() || !level || !phone?.trim() || !gender) {
      return res.status(400).json({ message: 'All fields are required: fullName, email, matricNumber, level, phone, gender.' });
    }

    const existingEmail = await Member.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) return res.status(400).json({ message: 'Email already registered.' });

    const existingMatric = await Member.findOne({ matricNumber: matricNumber.trim().toUpperCase() });
    if (existingMatric) return res.status(400).json({ message: 'Matric number already registered.' });

    const outOfRange = !isDirectEntry && !isMatricInRange(matricNumber.trim(), level);
    const needsApproval = !!isDirectEntry || outOfRange;

    const member = await Member.create({
      name: fullName.trim(),
      email: email.toLowerCase().trim(),
      matricNumber: matricNumber.trim().toUpperCase(),
      level,
      phone: phone.trim(),
      gender,
      isDirectEntry: !!isDirectEntry,
      isActive: !needsApproval,
      approvalStatus: needsApproval ? 'pending' : 'approved',
      registrationToken: link._id,
      registeredAt: new Date()
    });

    res.status(201).json({
      message: needsApproval
        ? 'Registration submitted. An administrator will review your application.'
        : 'Registration successful.',
      memberId: member._id,
      pending: needsApproval,
    });
  } catch (err) {
    console.error('Register member error:', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0];
      return res.status(400).json({ message: `${field === 'email' ? 'Email' : 'Matric number'} already registered.` });
    }
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};
