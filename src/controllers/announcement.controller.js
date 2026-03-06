const Announcement = require('../models/announcement.model');
const Member = require('../models/member.model');
const User = require('../models/user.model');
const { sendEmail } = require('../utils/mailer');
const { addNotification } = require('../utils/notifications');

exports.sendAnnouncement = async (req, res) => {
  try {
    const { title, body, audience = 'ALL', priority = 'normal' } = req.body;

    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'Title and body are required' });
    }

    // Create announcement record immediately
    const announcement = await Announcement.create({
      title, body, audience, priority,
      sentBy: req.user.id,
      status: 'SENDING'
    });

    // Respond immediately — don't make the client wait for all emails
    res.status(201).json({
      message: 'Announcement is being sent',
      announcement
    });

    // --- Send in background ---
    let emailRecipients = []; // { name, email }
    let execRecipients = [];  // User docs for in-portal notifications

    const isLevel = audience.startsWith('LEVEL_');
    const level = isLevel ? audience.replace('LEVEL_', '') : null;

    // Collect member emails
    if (audience === 'ALL' || audience === 'MEMBERS_ONLY' || isLevel) {
      const filter = { isActive: true };
      if (level) filter.level = level;
      const members = await Member.find(filter).select('name email level');
      const withEmail = members.filter(m => m.email);
      emailRecipients.push(...withEmail.map(m => ({ name: m.name, email: m.email })));
    }

    // Collect exec user emails
    if (audience === 'ALL' || audience === 'EXEC_ONLY') {
      execRecipients = await User.find({ isActive: true }).select('name email _id');
      emailRecipients.push(...execRecipients.map(u => ({ name: u.name, email: u.email })));
    }

    // Deduplicate by email
    const seen = new Set();
    const uniqueRecipients = emailRecipients.filter(r => {
      if (!r.email || seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send emails in batches of 10 to avoid overwhelming the mail server
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueRecipients.length; i += BATCH_SIZE) {
      const batch = uniqueRecipients.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(recipient =>
          sendEmail({
            to: recipient.email,
            subject: `${priority === 'urgent' ? '🚨 URGENT: ' : '📢 '}${title} — IESA`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #0d7c3d; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 20px;">
                    ${priority === 'urgent' ? '🚨 ' : '📢 '}${title}
                  </h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">
                    IESA — Industrial Engineering Students' Association
                  </p>
                </div>
                <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                  <p style="color: #374151; white-space: pre-wrap; line-height: 1.6;">${body}</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This message was sent by the IESA Executive to ${audience === 'ALL' ? 'all members' : audience.toLowerCase().replace('_', ' ')}.
                  </p>
                </div>
              </div>
            `
          })
          .then(() => emailsSent++)
          .catch(() => emailsFailed++)
        )
      );
      // Small delay between batches
      if (i + BATCH_SIZE < uniqueRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Send in-portal notifications to exec users
    let notificationsSent = 0;
    for (const execUser of execRecipients) {
      try {
        await addNotification(
          execUser._id,
          `📢 ${title}`,
          'info',
          { announcementId: announcement._id },
          `/dashboard/announcements`,
          priority === 'urgent' ? 'high' : 'medium'
        );
        notificationsSent++;
      } catch (e) {
        console.error('Notification failed for', execUser.email);
      }
    }

    // Update announcement with final stats
    await Announcement.findByIdAndUpdate(announcement._id, {
      recipientCount: uniqueRecipients.length,
      emailsSent,
      emailsFailed,
      notificationsSent,
      status: emailsFailed === uniqueRecipients.length && uniqueRecipients.length > 0 ? 'FAILED' : 'SENT'
    });

    console.log(`✅ Announcement sent: "${title}" → ${emailsSent} emails, ${notificationsSent} notifications`);

  } catch (error) {
    console.error('Send announcement error:', error);
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [announcements, total] = await Promise.all([
      Announcement.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sentBy', 'name position'),
      Announcement.countDocuments()
    ]);
    res.json({ announcements, total });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('sentBy', 'name position');
    if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
    res.json(announcement);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
