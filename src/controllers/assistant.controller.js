const { GoogleGenerativeAI } = require('@google/generative-ai');
const Member = require('../models/member.model');
const Task = require('../models/task.model');
const Event = require('../models/event.model');
const Announcement = require('../models/announcement.model');
const Attendance = require('../models/attendance.model');
const Welfare = require('../models/welfare.model');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Detect what data is needed based on message keywords
const detectIntent = (message) => {
  const msg = message.toLowerCase();
  return {
    needsMembers:     /member|student|dues|level|matric|gender|active|registered/.test(msg),
    needsTasks:       /task|assign|overdue|complet|verif|progress/.test(msg),
    needsEvents:      /event|social|academic|competition|departmental|rsvp/.test(msg),
    needsAnnouncements: /announc|message|sent|blast|email/.test(msg),
    needsAttendance:  /attend|present|absent|meeting|session|scan/.test(msg),
    needsWelfare:     /welfare|complaint|ticket|issue|report/.test(msg),
    isDraftRequest:   /draft|write|compose|create.*announc|announc.*draft/.test(msg),
    isMinutesSummary: /summar|minute|notes|meeting notes/.test(msg),
  };
};

// Fetch relevant context data
const fetchContext = async (intent) => {
  const context = {};

  if (intent.needsMembers) {
    const [total, byLevel, byGender, recentlyAdded] = await Promise.all([
      Member.countDocuments({ isActive: true }),
      Member.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$level', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Member.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$gender', count: { $sum: 1 } } }]),
      Member.find({ isActive: true }).sort({ createdAt: -1 }).limit(5).select('name level matricNumber createdAt'),
    ]);
    context.members = {
      total,
      byLevel: byLevel.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
      byGender: byGender.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
      recentlyAdded: recentlyAdded.map(m => ({ name: m.name, level: m.level, matric: m.matricNumber }))
    };
  }

  if (intent.needsTasks) {
    const [total, byStatus, overdue, recent] = await Promise.all([
      Task.countDocuments(),
      Task.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Task.countDocuments({ dueDate: { $lt: new Date() }, status: { $nin: ['COMPLETED', 'VERIFIED'] } }),
      Task.find().sort({ createdAt: -1 }).limit(5).select('title status assignedTo dueDate priority').populate('assignedTo', 'name'),
    ]);
    context.tasks = {
      total,
      byStatus: byStatus.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
      overdue,
      recent: recent.map(t => ({ title: t.title, status: t.status, assignedTo: t.assignedTo?.name, dueDate: t.dueDate }))
    };
  }

  if (intent.needsEvents) {
    const [upcoming, recent] = await Promise.all([
      Event.find({ status: { $in: ['UPCOMING', 'ONGOING'] }, date: { $gte: new Date() } })
        .sort({ date: 1 }).limit(5).select('title type date venue status rsvps'),
      Event.find({ status: 'COMPLETED' }).sort({ date: -1 }).limit(3).select('title type date rsvps'),
    ]);
    context.events = {
      upcoming: upcoming.map(e => ({
        title: e.title, type: e.type, date: e.date, venue: e.venue,
        goingCount: e.rsvps?.filter(r => r.response === 'GOING').length || 0
      })),
      recentlyCompleted: recent.map(e => ({ title: e.title, type: e.type, date: e.date }))
    };
  }

  if (intent.needsAnnouncements) {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 }).limit(5)
      .select('title audience recipientCount emailsSent status createdAt')
      .populate('sentBy', 'name');
    context.announcements = announcements.map(a => ({
      title: a.title, audience: a.audience,
      recipients: a.recipientCount, emailsSent: a.emailsSent,
      sentBy: a.sentBy?.name, sentAt: a.createdAt
    }));
  }

  if (intent.needsAttendance) {
    const sessions = await Attendance.find()
      .sort({ createdAt: -1 }).limit(5)
      .select('title status attendees createdAt');
    context.attendance = sessions.map(s => ({
      title: s.title, status: s.status,
      attendeeCount: s.attendees?.length || 0, date: s.createdAt
    }));
  }

  if (intent.needsWelfare) {
    const [total, open, inProgress, resolved] = await Promise.all([
      Welfare.countDocuments(),
      Welfare.countDocuments({ status: 'OPEN' }),
      Welfare.countDocuments({ status: 'IN_PROGRESS' }),
      Welfare.countDocuments({ status: 'RESOLVED' }),
    ]);
    context.welfare = { total, open, inProgress, resolved };
  }

  return context;
};

exports.chat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: 'AI assistant is not configured' });
    }

    // Detect intent and fetch relevant data
    const intent = detectIntent(message);
    const context = await fetchContext(intent);

    // Build system prompt
    const systemPrompt = `You are IESA Assistant, an intelligent helper for the IESA (Industrial Engineering Students' Association) Executive Portal at the University of Ibadan, Nigeria.

You help executive members manage the association efficiently. You can:
- Answer questions about members, dues, attendance, tasks, events
- Draft professional announcements
- Summarize meeting notes
- Give insights and recommendations based on association data
- Help with general executive duties

Always be professional, concise, and helpful. Use Nigerian university context when relevant.
When drafting announcements, make them formal and appropriate for a university association.
When you don't have specific data, say so honestly.

${Object.keys(context).length > 0 ? `\n## Current IESA Data Context:\n${JSON.stringify(context, null, 2)}` : ''}

Answer based on the data provided above when relevant. Be specific with numbers and names when available.`;

    // Build conversation history for Gemini
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });

    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    res.json({
      message: response,
      role: 'assistant',
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Assistant error:', err.message);
    if (err.message?.includes('API_KEY')) {
      return res.status(503).json({ message: 'AI service configuration error' });
    }
    res.status(500).json({ message: 'Assistant temporarily unavailable. Please try again.' });
  }
};

// Suggested prompts based on portal data
exports.getSuggestions = async (req, res) => {
  try {
    const [memberCount, overdueTasks, openTickets, upcomingEvents] = await Promise.all([
      Member.countDocuments({ isActive: true }),
      Task.countDocuments({ dueDate: { $lt: new Date() }, status: { $nin: ['COMPLETED', 'VERIFIED'] } }),
      Welfare.countDocuments({ status: 'OPEN' }),
      Event.countDocuments({ status: 'UPCOMING', date: { $gte: new Date() } }),
    ]);

    const suggestions = [
      `How many members do we have in each level?`,
      `Draft an announcement for our upcoming general meeting`,
      overdueTasks > 0 ? `We have ${overdueTasks} overdue tasks — what should we prioritize?` : `What tasks are currently in progress?`,
      openTickets > 0 ? `Summarize the ${openTickets} open welfare tickets` : `How is our welfare system performing?`,
      upcomingEvents > 0 ? `What events do we have coming up?` : `Help me plan an IESA social event`,
      `Which members haven't paid dues this session?`,
      `Write a formal end-of-semester message to all IESA members`,
    ];

    res.json({ suggestions, stats: { memberCount, overdueTasks, openTickets, upcomingEvents } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
