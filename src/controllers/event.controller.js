const Event = require('../models/event.model');
const { addNotification } = require('../utils/notifications');
const User = require('../models/user.model');

// GET all events with filtering
exports.getEvents = async (req, res) => {
  try {
    const { status, type, upcoming, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (upcoming === 'true') {
      filter.date = { $gte: new Date() };
      filter.status = { $in: ['UPCOMING', 'ONGOING'] };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ date: upcoming === 'true' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name position')
        .populate('rsvps.user', 'name position'),
      Event.countDocuments(filter)
    ]);
    res.json({ events, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET single event
exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name position')
      .populate('rsvps.user', 'name position');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST create event (admin only)
exports.createEvent = async (req, res) => {
  try {
    const event = await Event.create({
      ...req.body,
      createdBy: req.user.id
    });

    const populated = await Event.findById(event._id)
      .populate('createdBy', 'name position');

    // Notify all exec users
    const execUsers = await User.find({ isActive: true }).select('_id');
    for (const user of execUsers) {
      if (user._id.toString() !== req.user.id.toString()) {
        addNotification(
          user._id,
          `📅 New event: ${event.title} on ${new Date(event.date).toDateString()}`,
          'info',
          { eventId: event._id },
          `/dashboard/events`,
          'medium'
        ).catch(() => {});
      }
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT update event (admin only)
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate('createdBy', 'name position')
     .populate('rsvps.user', 'name position');

    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH update event status (admin only)
exports.updateEventStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).populate('createdBy', 'name position')
     .populate('rsvps.user', 'name position');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Notify all RSVPed users if cancelled
    if (status === 'CANCELLED') {
      for (const rsvp of event.rsvps) {
        if (rsvp.response === 'GOING' || rsvp.response === 'MAYBE') {
          addNotification(
            rsvp.user._id,
            `❌ Event cancelled: ${event.title}`,
            'alert',
            { eventId: event._id },
            `/dashboard/events`,
            'high'
          ).catch(() => {});
        }
      }
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST RSVP to event (any authenticated exec user)
exports.rsvpEvent = async (req, res) => {
  try {
    const { response } = req.body;
    const allowed = ['GOING', 'NOT_GOING', 'MAYBE'];
    if (!allowed.includes(response)) {
      return res.status(400).json({ message: 'Invalid RSVP response' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Cannot RSVP to a cancelled event' });
    }

    // Update existing RSVP or add new one
    const existingIndex = event.rsvps.findIndex(
      r => r.user.toString() === req.user.id.toString()
    );

    if (existingIndex >= 0) {
      event.rsvps[existingIndex].response = response;
      event.rsvps[existingIndex].respondedAt = new Date();
    } else {
      event.rsvps.push({
        user: req.user.id,
        response,
        respondedAt: new Date()
      });
    }

    await event.save();

    const populated = await Event.findById(event._id)
      .populate('createdBy', 'name position')
      .populate('rsvps.user', 'name position');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET event statistics
exports.getEventStats = async (req, res) => {
  try {
    const [total, upcoming, completed, cancelled, byType] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: { $in: ['UPCOMING', 'ONGOING'] }, date: { $gte: new Date() } }),
      Event.countDocuments({ status: 'COMPLETED' }),
      Event.countDocuments({ status: 'CANCELLED' }),
      Event.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
    ]);
    res.json({
      total, upcoming, completed, cancelled,
      byType: byType.reduce((acc, cur) => { acc[cur._id] = cur.count; return acc; }, {})
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
