const EventGuest = require('../models/eventGuest.model');
const Event = require('../models/event.model');
const { sendEmail } = require('../utils/mailer');

// GET /api/events/:eventId/public-info — PUBLIC (for registration page)
exports.getEventPublicInfo = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .select('title date time venue isPaidEvent guestRegistrationEnabled status registrationBrandName coverImage');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/events/:eventId/guests/register — PUBLIC
exports.registerGuest = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, email, phone, type, department } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!type || !['NON_STUDENT', 'EXTERNAL_STUDENT'].includes(type)) {
      return res.status(400).json({ message: 'Type must be NON_STUDENT or EXTERNAL_STUDENT' });
    }
    if (type === 'EXTERNAL_STUDENT' && !department?.trim()) {
      return res.status(400).json({ message: 'Department is required for students from other departments' });
    }

    const event = await Event.findById(eventId).select('title date time venue isPaidEvent ticketItems guestRegistrationEnabled registrationBrandName coverImage');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!event.guestRegistrationEnabled) {
      return res.status(403).json({ message: 'Guest registration is not open for this event' });
    }

    const existing = await EventGuest.findOne({ event: eventId, email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'You are already registered for this event with that email address' });
    }

    const guestData = {
      event: eventId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || undefined,
      type,
      department: type === 'EXTERNAL_STUDENT' ? department.trim() : undefined,
      paymentStatus: event.isPaidEvent ? 'PENDING' : 'NOT_REQUIRED',
      items: (event.ticketItems || []).map(name => ({ name, claimed: false })),
    };

    const guest = await EventGuest.create(guestData);

    const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const ticketUrl = `${process.env.FRONTEND_URL}/events/guest-ticket/${guest.token}`;

    await sendEmail({
      to: guest.email,
      subject: event.isPaidEvent
        ? `Registration Received — ${event.title}`
        : `You're Registered! — ${event.title}`,
      html: buildRegistrationEmail({
        guestName: guest.name,
        eventTitle: event.title,
        eventDate,
        eventVenue: event.venue,
        eventTime: event.time,
        isPaidEvent: event.isPaidEvent,
        ticketUrl,
        brandName: event.registrationBrandName,
      }),
    });

    res.status(201).json({
      message: event.isPaidEvent
        ? 'Registration received! Check your email for details. Payment confirmation will be sent once verified.'
        : 'You are registered! Check your email for your confirmation.',
      guestId: guest._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You are already registered for this event with that email address' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/events/:eventId/guests — Admin
exports.getGuestsForEvent = async (req, res) => {
  try {
    const guests = await EventGuest.find({ event: req.params.eventId })
      .populate('confirmedBy', 'name')
      .sort({ registeredAt: -1 });
    res.json(guests);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/guests/token/:token — PUBLIC (for ticket page)
exports.getGuestByToken = async (req, res) => {
  try {
    const guest = await EventGuest.findOne({ token: req.params.token })
      .populate('event', 'title date time venue coverImage isPaidEvent registrationBrandName');
    if (!guest) return res.status(404).json({ message: 'Ticket not found. This link may be invalid.' });
    res.json(guest);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH /api/guests/:id/confirm-payment — Admin
exports.confirmGuestPayment = async (req, res) => {
  try {
    const guest = await EventGuest.findById(req.params.id).populate('event');
    if (!guest) return res.status(404).json({ message: 'Guest not found' });
    if (guest.paymentStatus === 'CONFIRMED') {
      return res.status(400).json({ message: 'Payment already confirmed' });
    }

    guest.paymentStatus = 'CONFIRMED';
    guest.confirmedBy = req.user.id;
    guest.confirmedAt = new Date();
    await guest.save();

    const event = guest.event;
    const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const ticketUrl = `${process.env.FRONTEND_URL}/events/guest-ticket/${guest.token}`;

    await sendEmail({
      to: guest.email,
      subject: `Your Ticket for ${event.title} is Confirmed!`,
      html: buildTicketConfirmedEmail({
        guestName: guest.name,
        eventTitle: event.title,
        eventDate,
        eventVenue: event.venue,
        eventTime: event.time,
        items: guest.items.map(i => i.name),
        ticketUrl,
        brandName: event.registrationBrandName,
      }),
    });

    const populated = await EventGuest.findById(guest._id).populate('confirmedBy', 'name');
    res.json({ guest: populated, message: `Payment confirmed and ticket emailed to ${guest.email}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/guests/:id/resend — Admin
exports.resendGuestEmail = async (req, res) => {
  try {
    const guest = await EventGuest.findById(req.params.id).populate('event');
    if (!guest) return res.status(404).json({ message: 'Guest not found' });

    const event = guest.event;
    const eventDate = new Date(event.date).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const ticketUrl = `${process.env.FRONTEND_URL}/events/guest-ticket/${guest.token}`;

    if (guest.paymentStatus === 'CONFIRMED') {
      await sendEmail({
        to: guest.email,
        subject: `Your Ticket for ${event.title} — Resent`,
        html: buildTicketConfirmedEmail({
          guestName: guest.name,
          eventTitle: event.title,
          eventDate,
          eventVenue: event.venue,
          eventTime: event.time,
          items: guest.items.map(i => i.name),
          ticketUrl,
          brandName: event.registrationBrandName,
        }),
      });
    } else {
      await sendEmail({
        to: guest.email,
        subject: `Your Registration for ${event.title} — Resent`,
        html: buildRegistrationEmail({
          guestName: guest.name,
          eventTitle: event.title,
          eventDate,
          eventVenue: event.venue,
          eventTime: event.time,
          isPaidEvent: event.isPaidEvent,
          ticketUrl,
          brandName: event.registrationBrandName,
        }),
      });
    }

    res.json({ message: `Email resent to ${guest.email}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH /api/guests/token/:token/checkin — Admin (called from scan page)
exports.checkInGuest = async (req, res) => {
  try {
    const guest = await EventGuest.findOne({ token: req.params.token });
    if (!guest) return res.status(404).json({ message: 'Guest ticket not found' });

    if (guest.paymentStatus === 'PENDING') {
      return res.status(400).json({ message: 'This guest ticket has not been paid for' });
    }
    if (guest.checkedIn) {
      return res.status(400).json({
        message: `${guest.name} is already checked in`,
        alreadyCheckedIn: true,
        checkInTime: guest.checkInTime,
      });
    }

    guest.checkedIn = true;
    guest.checkInTime = new Date();
    await guest.save();

    const io = req.app.get('io');
    if (io) io.emit('ticket-checkin', { eventId: guest.event, memberName: guest.name, isGuest: true });

    res.json({
      message: `Welcome, ${guest.name}!`,
      guest: { name: guest.name, type: guest.type, department: guest.department },
      isGuest: true,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// PATCH /api/guests/token/:token/redeem — Admin
exports.redeemGuestItem = async (req, res) => {
  try {
    const { itemName } = req.body;
    if (!itemName) return res.status(400).json({ message: 'itemName is required' });

    const guest = await EventGuest.findOne({ token: req.params.token });
    if (!guest) return res.status(404).json({ message: 'Guest ticket not found' });
    if (guest.paymentStatus !== 'CONFIRMED') {
      return res.status(400).json({ message: 'This guest ticket has not been paid for' });
    }

    const item = guest.items.find(i => i.name === itemName);
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
    await guest.save();

    res.json({ message: `${itemName} redeemed for ${guest.name}`, guest });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/events/:eventId/guests/export — Admin
exports.exportGuestsCsv = async (req, res) => {
  try {
    const guests = await EventGuest.find({ event: req.params.eventId }).sort({ name: 1 });
    if (!guests.length) return res.status(404).json({ message: 'No guests found for this event' });

    const itemNames = guests[0].items.map(i => i.name);
    const headers = ['Name', 'Email', 'Phone', 'Type', 'Department', 'Payment Status', 'Checked In', 'Check-in Time', ...itemNames];

    const rows = guests.map(g => [
      g.name,
      g.email,
      g.phone || '',
      g.type,
      g.department || '',
      g.paymentStatus,
      g.checkedIn ? 'Yes' : 'No',
      g.checkInTime ? new Date(g.checkInTime).toLocaleString('en-GB') : '',
      ...g.items.map(i => i.claimed ? `Yes (${new Date(i.claimedAt).toLocaleTimeString('en-GB')})` : 'No'),
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="guests-export.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── Email templates ──────────────────────────────────────────────────────────

function buildRegistrationEmail({ guestName, eventTitle, eventDate, eventVenue, eventTime, isPaidEvent, ticketUrl, brandName }) {
  const displayBrand = brandName || 'IESA';
  const orgLine = brandName
    ? `${brandName} · University of Ibadan`
    : "IESA — Industrial Engineering Students' Association · University of Ibadan";

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#e6edf3;padding:40px;border-radius:12px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:48px;margin-bottom:8px;">${isPaidEvent ? '📋' : '🎉'}</div>
    <h1 style="color:#3fb950;font-size:26px;margin:0;">${isPaidEvent ? 'Registration Received' : "You're Registered!"}</h1>
    <p style="color:#8b949e;margin-top:8px;">For <strong style="color:#e6edf3;">${eventTitle}</strong></p>
  </div>

  <p style="color:#e6edf3;font-size:16px;">Hi <strong>${guestName}</strong>,</p>
  <p style="color:#8b949e;line-height:1.6;">
    ${isPaidEvent
      ? 'Your registration has been received. Once your payment is confirmed, you will receive another email with your ticket and QR code.'
      : 'Your spot is confirmed! Use the link below to view your ticket and QR code for check-in on the day.'}
  </p>

  <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin:24px 0;">
    <p style="margin:0 0 12px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Event Details</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>📅</strong> ${eventDate}</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>⏰</strong> ${eventTime}</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>📍</strong> ${eventVenue}</p>
  </div>

  ${!isPaidEvent ? `
  <div style="text-align:center;margin:32px 0;">
    <a href="${ticketUrl}"
       style="background:#238636;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">
      View My Ticket &amp; QR Code →
    </a>
  </div>` : ''}

  <hr style="border:none;border-top:1px solid #30363d;margin:24px 0;">
  <p style="color:#8b949e;font-size:12px;text-align:center;">${orgLine}</p>
</div>`;
}

function buildTicketConfirmedEmail({ guestName, eventTitle, eventDate, eventVenue, eventTime, items, ticketUrl, brandName }) {
  const orgLine = brandName
    ? `${brandName} · University of Ibadan`
    : "IESA — Industrial Engineering Students' Association · University of Ibadan";

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

  <p style="color:#e6edf3;font-size:16px;">Hi <strong>${guestName}</strong>,</p>
  <p style="color:#8b949e;line-height:1.6;">Your payment has been confirmed by the social director. Here are your event details and what's included in your ticket.</p>

  <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin:24px 0;">
    <p style="margin:0 0 12px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Event Details</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>📅</strong> ${eventDate}</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>⏰</strong> ${eventTime}</p>
    <p style="margin:6px 0;color:#e6edf3;"><strong>📍</strong> ${eventVenue}</p>
  </div>

  ${items.length > 0 ? `
  <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin:24px 0;">
    <p style="margin:0 0 12px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">What's Included</p>
    ${itemRows}
  </div>` : ''}

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
  <p style="color:#8b949e;font-size:12px;text-align:center;">${orgLine}</p>
</div>`;
}
