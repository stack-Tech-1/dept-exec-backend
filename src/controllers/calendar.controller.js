const Calendar = require('../models/calendar.model');

exports.getEvents = async (req, res) => {
  try {
    const { month, year, session, type } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (session) filter.session = session;
    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      filter.startDate = { $gte: start, $lte: end };
    }
    const events = await Calendar.find(filter)
      .sort({ startDate: 1 })
      .populate('createdBy', 'name');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, description, type, startDate, endDate, isAllDay, session, color } = req.body;
    if (!title?.trim() || !type || !startDate) {
      return res.status(400).json({ message: 'Title, type and start date are required' });
    }
    const event = await Calendar.create({
      title, description, type, startDate, endDate,
      isAllDay, session, color,
      createdBy: req.user.id
    });
    const populated = await Calendar.findById(event._id).populate('createdBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const event = await Calendar.findByIdAndUpdate(
      req.params.id, { $set: req.body }, { new: true }
    ).populate('createdBy', 'name');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    await Calendar.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getUpcoming = async (req, res) => {
  try {
    const events = await Calendar.find({ startDate: { $gte: new Date() } })
      .sort({ startDate: 1 })
      .limit(10)
      .populate('createdBy', 'name');
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
