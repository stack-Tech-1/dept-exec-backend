const EventTicket = require('../models/eventTicket.model');
const Event = require('../models/event.model');
const Member = require('../models/member.model');
const { sendEmail } = require('../utils/mailer');

// POST /api/event-tickets — Admin: create tickets for selected members
exports.createTickets = async (req, res) => {
  try {
    const { eventId, memberIds } = req.body;
    if (!eventId || !Array.isArray(memberIds) || !memberIds.length) {
      return res.status(400).json({ message: 'eventId and memberIds[] are required' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.isPaidEvent) return res.status(400).json({ message: 'This event is not configured as a paid event' });

    const members = await Member.find({ _id: { $in: memberIds } });
    const created = [];
    const skipped = [];

    for (const member of members) {
      const existing = await EventTicket.findOne({ event: eventId, member: member._id });
      if (existing) { skipped.push(member.name); continue; }

      const ticket = await EventTicket.create({
        event: eventId,
        member: member._id,
        memberName: member.name,
        memberEmail: member.email,
        matricNumber: member.matricNumber,
        items: (event.ticketItems || []).map(name => ({ name, claimed: false })),
      });
      created.push(ticket);
    }

    res.status(201).json({ created, skipped, message: `${created.length} ticket(s) created, ${skipped.length} skipped (already exist)` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/event-tickets/event/:eventId — Admin: all tickets for an event
exports.getEventTickets = async (req, res) => {
  try {
    const tickets = await EventTicket.find({ event: req.params.eventId })
      .populate('confirmedBy', 'name')
      .sort({ memberName: 1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/event-tickets/:id/confirm — Admin: confirm payment + send email
exports.confirmPayment = async (req, res) => {
  try {
    const ticket = await EventTicket.findById(req.params.id).populate('event');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.paymentStatus === 'CONFIRMED') {
      return res.status(400).json({ message: 'Payment already confirmed' });
    }

    ticket.paymentStatus = 'CONFIRMED';
    ticket.confirmedBy = req.user.id;
    ticket.confirmedAt = new Date();
    await ticket.save();

    const event = ticket.event;
    const ticketUrl = `${process.env.FRONTEND_URL}/picnic/ticket/${ticket.token}`;
    const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await sendEmail({
      to: ticket.memberEmail,
      subject: `🎉 Your Ticket for ${event.title} is Confirmed!`,
      html: buildTicketEmail({
        memberName: ticket.memberName,
        eventTitle: event.title,
        eventDate,
        eventVenue: event.venue,
        eventTime: event.time,
        items: ticket.items.map(i => i.name),
        ticketUrl,
      }),
    });

    const populated = await EventTicket.findById(ticket._id).populate('confirmedBy', 'name');
    res.json({ ticket: populated, message: `Payment confirmed and ticket emailed to ${ticket.memberEmail}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/event-tickets/:id/resend — Admin: resend ticket email
exports.resendTicketEmail = async (req, res) => {
  try {
    const ticket = await EventTicket.findById(req.params.id).populate('event');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.paymentStatus !== 'CONFIRMED') {
      return res.status(400).json({ message: 'Cannot resend — payment not confirmed yet' });
    }

    const event = ticket.event;
    const ticketUrl = `${process.env.FRONTEND_URL}/picnic/ticket/${ticket.token}`;
    const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await sendEmail({
      to: ticket.memberEmail,
      subject: `🎫 Your Ticket for ${event.title} — Resent`,
      html: buildTicketEmail({
        memberName: ticket.memberName,
        eventTitle: event.title,
        eventDate,
        eventVenue: event.venue,
        eventTime: event.time,
        items: ticket.items.map(i => i.name),
        ticketUrl,
      }),
    });

    res.json({ message: `Ticket email resent to ${ticket.memberEmail}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/event-tickets/token/:token — PUBLIC: get ticket by token (member view + scanner)
exports.getTicketByToken = async (req, res) => {
  try {
    const ticket = await EventTicket.findOne({ token: req.params.token })
      .populate('event', 'title date time venue coverImage isPaidEvent');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found. This link may be invalid.' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/event-tickets/token/:token/checkin — Admin: check in a member
exports.checkIn = async (req, res) => {
  try {
    const ticket = await EventTicket.findOne({ token: req.params.token });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.paymentStatus !== 'CONFIRMED') {
      return res.status(400).json({ message: 'This ticket has not been paid for' });
    }
    if (ticket.checkedIn) {
      return res.status(400).json({
        message: `${ticket.memberName} is already checked in`,
        alreadyCheckedIn: true,
        checkInTime: ticket.checkInTime,
      });
    }

    ticket.checkedIn = true;
    ticket.checkInTime = new Date();
    await ticket.save();

    const io = req.app.get('io');
    if (io) io.emit('ticket-checkin', { eventId: ticket.event, memberName: ticket.memberName });

    res.json({ message: `✅ Welcome, ${ticket.memberName}!`, ticket });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PUT /api/event-tickets/token/:token/redeem — Admin: mark an item as claimed
exports.redeemItem = async (req, res) => {
  try {
    const { itemName } = req.body;
    if (!itemName) return res.status(400).json({ message: 'itemName is required' });

    const ticket = await EventTicket.findOne({ token: req.params.token });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.paymentStatus !== 'CONFIRMED') {
      return res.status(400).json({ message: 'This ticket has not been paid for' });
    }

    const item = ticket.items.find(i => i.name === itemName);
    if (!item) return res.status(404).json({ message: `Item "${itemName}" not found on this ticket` });
    if (item.claimed) {
      return res.status(400).json({
        message: `${itemName} was already claimed`,
        alreadyClaimed: true,
        claimedAt: item.claimedAt,
      });
    }

    item.claimed = true;
    item.claimedAt = new Date();
    item.claimedBy = req.user.id;
    await ticket.save();

    res.json({ message: `✅ ${itemName} redeemed for ${ticket.memberName}`, ticket });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/event-tickets/event/:eventId/export — Admin: CSV export
exports.exportTickets = async (req, res) => {
  try {
    const tickets = await EventTicket.find({ event: req.params.eventId }).sort({ memberName: 1 });
    if (!tickets.length) return res.status(404).json({ message: 'No tickets found for this event' });

    const itemNames = tickets[0].items.map(i => i.name);
    const headers = ['Name', 'Matric Number', 'Email', 'Payment Status', 'Checked In', 'Check-in Time', ...itemNames];

    const rows = tickets.map(t => [
      t.memberName,
      t.matricNumber || '',
      t.memberEmail,
      t.paymentStatus,
      t.checkedIn ? 'Yes' : 'No',
      t.checkInTime ? new Date(t.checkInTime).toLocaleString('en-GB') : '',
      ...t.items.map(i => i.claimed ? `Yes (${new Date(i.claimedAt).toLocaleTimeString('en-GB')})` : 'No'),
    ]);

    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tickets-export.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── Email template ───────────────────────────────────────────────────────────
function buildTicketEmail({ memberName, eventTitle, eventDate, eventVenue, eventTime, items, ticketUrl }) {
  const itemRows = items.map(item =>
    `<p style="margin:6px 0;color:#3fb950;font-size:15px;">✅ ${item}</p>`
  ).join('');

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:40px;border-radius:12px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:48px;margin-bottom:8px;">🎉</div>
    <h1 style="color:#3fb950;font-size:26px;margin:0;">You're Confirmed!</h1>
    <p style="color:#8b949e;margin-top:8px;">Your ticket for <strong style="color:#e6edf3;">${eventTitle}</strong> is ready</p>
  </div>

  <p style="color:#e6edf3;font-size:16px;">Hi <strong>${memberName}</strong>,</p>
  <p style="color:#8b949e;line-height:1.6;">Your payment has been confirmed by the social director. Here are your event details and what's included in your ticket.</p>

  <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin:24px 0;">
    <p style="margin:0 0 12px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Event Details</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>📅</strong> ${eventDate}</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>⏰</strong> ${eventTime}</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>📍</strong> ${eventVenue}</p>
  </div>

  <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin:24px 0;">
    <p style="margin:0 0 12px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">What's Included</p>
    ${itemRows}
  </div>

  <div style="text-align:center;margin:32px 0;">
    <a href="${ticketUrl}"
       style="background:#238636;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">
      View My Ticket &amp; QR Code →
    </a>
  </div>

  <p style="color:#8b949e;font-size:13px;text-align:center;line-height:1.6;">
    Open your ticket page to see your personal QR code.<br>
    Save a screenshot — you'll need it on the day to collect your items.
  </p>

  <hr style="border:none;border-top:1px solid #30363d;margin:24px 0;">
  <p style="color:#8b949e;font-size:12px;text-align:center;">
    IESA — Industrial Engineering Students' Association · University of Ibadan
  </p>
</div>`;
}
