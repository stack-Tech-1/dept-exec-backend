const Handover = require('../models/handover.model');
const { addNotification } = require('../utils/notifications');

exports.getHandovers = async (req, res) => {
  try {
    const { session, position, status } = req.query;
    const filter = {};
    if (session) filter.session = session;
    if (position) filter.position = position;
    if (status) filter.status = status;
    const handovers = await Handover.find(filter)
      .sort({ createdAt: -1 })
      .populate('outgoingExec', 'name position')
      .populate('incomingExec', 'name position');
    res.json(handovers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getHandoverById = async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id)
      .populate('outgoingExec', 'name position')
      .populate('incomingExec', 'name position');
    if (!handover) return res.status(404).json({ message: 'Handover not found' });
    res.json(handover);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.createHandover = async (req, res) => {
  try {
    const { position, session, incomingExec, sections } = req.body;
    if (!position?.trim() || !session?.trim()) {
      return res.status(400).json({ message: 'Position and session are required' });
    }
    const handover = await Handover.create({
      position, session, incomingExec, sections,
      outgoingExec: req.user.id,
      status: 'DRAFT'
    });
    const populated = await Handover.findById(handover._id)
      .populate('outgoingExec', 'name position')
      .populate('incomingExec', 'name position');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateHandover = async (req, res) => {
  try {
    const handover = await Handover.findById(req.params.id);
    if (!handover) return res.status(404).json({ message: 'Handover not found' });
    if (handover.outgoingExec.toString() !== req.user.id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { sections, incomingExec, status } = req.body;
    if (sections) handover.sections = { ...handover.sections, ...sections };
    if (incomingExec) handover.incomingExec = incomingExec;
    if (status === 'SUBMITTED') {
      handover.status = 'SUBMITTED';
      handover.submittedAt = new Date();
      if (handover.incomingExec) {
        addNotification(
          handover.incomingExec,
          `📋 Handover notes submitted for ${handover.position}`,
          'info',
          { handoverId: handover._id },
          '/dashboard/handover',
          'high'
        ).catch(() => {});
      }
    }
    if (status === 'ACKNOWLEDGED') {
      handover.status = 'ACKNOWLEDGED';
      handover.acknowledgedAt = new Date();
    }
    await handover.save();
    const populated = await Handover.findById(handover._id)
      .populate('outgoingExec', 'name position')
      .populate('incomingExec', 'name position');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
