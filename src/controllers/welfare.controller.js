const Welfare = require('../models/welfare.model');
const { addNotification } = require('../utils/notifications');
const User = require('../models/user.model');

// POST submit ticket (PUBLIC)
exports.submitTicket = async (req, res) => {
  try {
    const { category, subject, description, isAnonymous, submitterName, submitterMatric, submitterEmail } = req.body;
    if (!category || !subject?.trim() || !description?.trim()) {
      return res.status(400).json({ message: 'Category, subject and description are required' });
    }
    if (!isAnonymous && !submitterName?.trim()) {
      return res.status(400).json({ message: 'Please provide your name or submit anonymously' });
    }

    const ticket = await Welfare.create({
      category,
      subject,
      description,
      isAnonymous: isAnonymous === true || isAnonymous === 'true',
      submitterName: isAnonymous ? null : submitterName,
      submitterMatric: isAnonymous ? null : submitterMatric,
      submitterEmail: isAnonymous ? null : submitterEmail,
      priority: category === 'HARASSMENT' ? 'HIGH' : 'MEDIUM'
    });

    // Notify all exec users
    const execUsers = await User.find({ isActive: true }).select('_id');
    for (const user of execUsers) {
      addNotification(
        user._id,
        `🆘 New ${category.toLowerCase()} ticket: ${subject}`,
        category === 'HARASSMENT' ? 'alert' : 'info',
        { ticketId: ticket._id },
        '/dashboard/welfare',
        category === 'HARASSMENT' ? 'high' : 'medium'
      ).catch(() => {});
    }

    res.status(201).json({
      message: 'Your ticket has been submitted successfully.',
      ticketId: ticket.ticketId,
      _id: ticket._id
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET check ticket status by ticketId (PUBLIC)
exports.checkTicketStatus = async (req, res) => {
  try {
    const ticket = await Welfare.findOne({ ticketId: req.params.ticketId.toUpperCase() })
      .select('ticketId subject category status priority responses createdAt resolvedAt')
      .populate('responses.responder', 'name');

    if (!ticket) return res.status(404).json({ message: 'Ticket not found. Please check your ticket ID.' });

    // Only show non-internal responses to public
    const publicResponses = ticket.responses.filter(r => !r.isInternal);
    res.json({ ...ticket.toObject(), responses: publicResponses });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET all tickets (exec only)
exports.getTickets = async (req, res) => {
  try {
    const { status, category, priority, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tickets, total] = await Promise.all([
      Welfare.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('assignedTo', 'name')
        .populate('resolvedBy', 'name'),
      Welfare.countDocuments(filter)
    ]);
    res.json({ tickets, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET single ticket (exec only)
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Welfare.findById(req.params.id)
      .populate('assignedTo', 'name position')
      .populate('resolvedBy', 'name')
      .populate('responses.responder', 'name position');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST respond to ticket (exec only)
exports.respondToTicket = async (req, res) => {
  try {
    const { message, isInternal = false } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Response message is required' });
    const ticket = await Welfare.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    ticket.responses.push({
      responder: req.user.id,
      responderName: req.user.name,
      message,
      isInternal,
      createdAt: new Date()
    });
    if (ticket.status === 'OPEN') ticket.status = 'IN_PROGRESS';
    await ticket.save();
    const updated = await Welfare.findById(ticket._id)
      .populate('assignedTo', 'name position')
      .populate('responses.responder', 'name position');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH update ticket status/priority (exec only)
exports.updateTicket = async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.body;
    const ticket = await Welfare.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo) ticket.assignedTo = assignedTo;
    if (status === 'RESOLVED') {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = req.user.id;
    }
    await ticket.save();
    const updated = await Welfare.findById(ticket._id)
      .populate('assignedTo', 'name position')
      .populate('resolvedBy', 'name');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET welfare stats (exec only)
exports.getStats = async (req, res) => {
  try {
    const [total, open, inProgress, resolved, byCategory] = await Promise.all([
      Welfare.countDocuments(),
      Welfare.countDocuments({ status: 'OPEN' }),
      Welfare.countDocuments({ status: 'IN_PROGRESS' }),
      Welfare.countDocuments({ status: 'RESOLVED' }),
      Welfare.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
    ]);
    res.json({
      total, open, inProgress, resolved,
      byCategory: byCategory.reduce((acc, cur) => { acc[cur._id] = cur.count; return acc; }, {})
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
