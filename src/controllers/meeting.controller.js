// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\meeting.controller.js
const Meeting = require("../models/meeting.model");
const User = require("../models/user.model");
const { sendEmail } = require("../utils/mailer");
const { addNotification } = require("../utils/notifications");

exports.createMeeting = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { title, date, time, venue, agenda, zoomLink, meetingType, rsvpDeadline, session, semester } = req.body;

    if (!title || !date || !time || !venue) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate meeting type
    if (!["zoom", "physical", "hybrid"].includes(meetingType)) {
      return res.status(400).json({ message: "Invalid meeting type" });
    }

    // Create meeting
    const meeting = await Meeting.create({
      title,
      date: new Date(date),
      time,
      venue,
      agenda: agenda || "",
      zoomLink: meetingType === "zoom" || meetingType === "hybrid" ? zoomLink || "" : "",
      meetingType,
      rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
      session: session || "2024/2025",
      semester: semester || "First Semester",
      createdBy: req.user.id,
    });

    // Get all executives to add as attendees
    const executives = await User.find({ role: "EXEC", isActive: true });
    
    // Add all executives as attendees
    for (const exec of executives) {
      meeting.addAttendee(exec._id, exec.name, exec.position);
    }
    
    await meeting.save();

    // Send email notifications to all executives
    for (const exec of executives) {
      await sendEmail({
        to: exec.email,
        subject: `📅 New Meeting Scheduled: ${title}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0d7c3d; padding: 20px; text-align: center; color: white;">
            <h2>New Meeting Scheduled</h2>
          </div>
          <div style="padding: 20px; background: white;">
            <p>Hello <strong>${exec.position} ${exec.name}</strong>,</p>
            <p>A new meeting has been scheduled:</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3 style="margin-top: 0;">${title}</h3>
              <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${time}</p>
              <p><strong>Venue:</strong> ${venue}</p>
              <p><strong>Type:</strong> ${meetingType.charAt(0).toUpperCase() + meetingType.slice(1)}</p>
              ${agenda ? `<p><strong>Agenda:</strong><br>${agenda.replace(/\n/g, '<br>')}</p>` : ''}
              ${rsvpDeadline ? `<p><strong>RSVP Deadline:</strong> ${new Date(rsvpDeadline).toLocaleString()}</p>` : ''}
              <p><strong>Scheduled by:</strong> ${req.user.name} (${req.user.position})</p>
            </div>
            
            <p>Please log in to the system to RSVP and see more details.</p>
            <p><em>– Department Executive System</em></p>
          </div>
        </div>
        `,
      });

      // In-app notification
      addNotification(
        exec._id,
        `New meeting scheduled: ${title} on ${new Date(date).toLocaleDateString()}`
      );
    }

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('createdBy', 'name email position')
      .populate('attendees.userId', 'name email position');

    res.status(201).json(populatedMeeting);

  } catch (error) {
    console.error("Create meeting error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate('createdBy', 'name email position')
      .populate('attendees.userId', 'name email position')
      .sort({ date: 1, time: 1 });

    res.json(meetings);
  } catch (error) {
    console.error("Get meetings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUpcomingMeetings = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const now = new Date();

    const meetings = await Meeting.find({
      $or: [
        { date: { $gt: now } },
        { 
          date: { 
            $eq: new Date(now.toISOString().split('T')[0]) 
          },
          time: { $gt: now.toTimeString().split(' ')[0] }
        }
      ]
    })
      .populate('createdBy', 'name email position')
      .populate('attendees.userId', 'name email position')
      .sort({ date: 1, time: 1 })
      .limit(limit);

    res.json(meetings);
  } catch (error) {
    console.error("Get upcoming meetings error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// Add these methods to your existing meeting.controller.js

exports.getMeetingById = async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id)
        .populate('createdBy', 'name email position')
        .populate('attendees.userId', 'name email position')
        .populate('minutesId');
  
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
  
      // Check if user is an attendee or admin
      const isAttendee = meeting.attendees.some(
        attendee => attendee.userId._id.toString() === req.user.id
      );
      
      if (req.user.role !== "ADMIN" && !isAttendee) {
        return res.status(403).json({
          message: "You can only view meetings you're invited to",
        });
      }
  
      res.json(meeting);
    } catch (error) {
      console.error("Get meeting by ID error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  
  exports.getUserMeetings = async (req, res) => {
    try {
      const userId = req.user.id;
      const now = new Date();
  
      // Get meetings where user is an attendee
      const meetings = await Meeting.find({
        "attendees.userId": userId
      })
        .populate('createdBy', 'name email position')
        .populate('attendees.userId', 'name email position')
        .sort({ date: 1, time: 1 });
  
      // Separate upcoming and past meetings
      const upcomingMeetings = meetings.filter(meeting => {
        const meetingDateTime = new Date(`${meeting.date.toISOString().split('T')[0]}T${meeting.time}`);
        return meetingDateTime > now;
      });
  
      const pastMeetings = meetings.filter(meeting => {
        const meetingDateTime = new Date(`${meeting.date.toISOString().split('T')[0]}T${meeting.time}`);
        return meetingDateTime <= now;
      });
  
      // Get user's RSVP status for each meeting
      const meetingsWithRSVP = meetings.map(meeting => {
        const userAttendance = meeting.attendees.find(
          attendee => attendee.userId._id.toString() === userId
        );
        
        return {
          ...meeting.toObject(),
          userRSVP: userAttendance ? userAttendance.status : 'pending'
        };
      });
  
      res.json({
        total: meetings.length,
        upcoming: upcomingMeetings.length,
        past: pastMeetings.length,
        meetings: meetingsWithRSVP,
        upcomingMeetings,
        pastMeetings
      });
  
    } catch (error) {
      console.error("Get user meetings error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  
  exports.updateMeeting = async (req, res) => {
    try {
      if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admins only" });
      }
  
      const { title, date, time, venue, agenda, zoomLink, meetingType, rsvpDeadline, session, semester } = req.body;
      const meetingId = req.params.id;
  
      const meeting = await Meeting.findById(meetingId);
  
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
  
      // Store original values for notification
      const originalValues = {
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        venue: meeting.venue
      };
  
      // Update fields if provided
      if (title !== undefined) meeting.title = title;
      if (date !== undefined) meeting.date = new Date(date);
      if (time !== undefined) meeting.time = time;
      if (venue !== undefined) meeting.venue = venue;
      if (agenda !== undefined) meeting.agenda = agenda;
      if (zoomLink !== undefined) meeting.zoomLink = zoomLink;
      if (meetingType !== undefined) meeting.meetingType = meetingType;
      if (rsvpDeadline !== undefined) meeting.rsvpDeadline = rsvpDeadline ? new Date(rsvpDeadline) : null;
      if (session !== undefined) meeting.session = session;
      if (semester !== undefined) meeting.semester = semester;
  
      // Check if important details changed
      const importantChanges = [];
      if (title !== undefined && title !== originalValues.title) importantChanges.push("title");
      if (date !== undefined && new Date(date).getTime() !== originalValues.date.getTime()) importantChanges.push("date");
      if (time !== undefined && time !== originalValues.time) importantChanges.push("time");
      if (venue !== undefined && venue !== originalValues.venue) importantChanges.push("venue");
  
      // If important changes, notify attendees
      if (importantChanges.length > 0) {
        const attendees = await User.find({
          _id: { $in: meeting.attendees.map(a => a.userId) }
        });
  
        for (const attendee of attendees) {
          await sendEmail({
            to: attendee.email,
            subject: `📝 Meeting Updated: ${meeting.title}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #0d7c3d; padding: 20px; text-align: center; color: white;">
                <h2>Meeting Updated</h2>
              </div>
              <div style="padding: 20px; background: white;">
                <p>Hello <strong>${attendee.position} ${attendee.name}</strong>,</p>
                <p>The following meeting has been updated:</p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <h3 style="margin-top: 0;">${meeting.title}</h3>
                  <p><strong>Changes made:</strong> ${importantChanges.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}</p>
                  <p><strong>New Date:</strong> ${meeting.date.toLocaleDateString()}</p>
                  <p><strong>New Time:</strong> ${meeting.time}</p>
                  <p><strong>New Venue:</strong> ${meeting.venue}</p>
                  <p><strong>Updated by:</strong> ${req.user.name} (${req.user.position})</p>
                </div>
                
                <p>Please log in to the system to see the updated details.</p>
                <p><em>– Department Executive System</em></p>
              </div>
            </div>
            `,
          });
  
          addNotification(
            attendee._id,
            `Meeting updated: ${meeting.title}`
          );
        }
      }
  
      await meeting.save();
  
      const populatedMeeting = await Meeting.findById(meeting._id)
        .populate('createdBy', 'name email position')
        .populate('attendees.userId', 'name email position')
        .populate('minutesId');
  
      res.json(populatedMeeting);
  
    } catch (error) {
      console.error("Update meeting error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  
  exports.deleteMeeting = async (req, res) => {
    try {
      if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admins only" });
      }
  
      const meeting = await Meeting.findById(req.params.id);
  
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
  
      // Notify attendees about meeting cancellation
      const attendees = await User.find({
        _id: { $in: meeting.attendees.map(a => a.userId) }
      });
  
      for (const attendee of attendees) {
        await sendEmail({
          to: attendee.email,
          subject: `❌ Meeting Cancelled: ${meeting.title}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #dc3545; padding: 20px; text-align: center; color: white;">
              <h2>Meeting Cancelled</h2>
            </div>
            <div style="padding: 20px; background: white;">
              <p>Hello <strong>${attendee.position} ${attendee.name}</strong>,</p>
              <p>The following meeting has been cancelled:</p>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0;">${meeting.title}</h3>
                <p><strong>Original Date:</strong> ${meeting.date.toLocaleDateString()}</p>
                <p><strong>Original Time:</strong> ${meeting.time}</p>
                <p><strong>Original Venue:</strong> ${meeting.venue}</p>
                <p><strong>Cancelled by:</strong> ${req.user.name} (${req.user.position})</p>
              </div>
              
              <p><em>– Department Executive System</em></p>
            </div>
          </div>
          `,
        });
  
        addNotification(
          attendee._id,
          `Meeting cancelled: ${meeting.title}`
        );
      }
  
      await meeting.deleteOne();
  
      console.log(`🗑️ Meeting deleted: ${meeting.title} by user ${req.user.id}`);
  
      res.json({ 
        message: "Meeting deleted successfully",
        meetingId: req.params.id
      });
  
    } catch (error) {
      console.error("Delete meeting error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };

  
exports.updateRSVP = async (req, res) => {
  try {
    const { status } = req.body;
    const meetingId = req.params.id;
    const userId = req.user.id;

    if (!["attending", "not_attending", "maybe"].includes(status)) {
      return res.status(400).json({ message: "Invalid RSVP status" });
    }

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check if RSVP deadline has passed
    if (meeting.rsvpDeadline && new Date() > meeting.rsvpDeadline) {
      return res.status(400).json({ message: "RSVP deadline has passed" });
    }

    // Update RSVP status
    meeting.updateRSVP(userId, status);
    await meeting.save();

    // Notify meeting creator
    if (meeting.createdBy.toString() !== userId) {
      const user = await User.findById(userId);
      addNotification(
        meeting.createdBy,
        `${user.name} (${user.position}) is ${status} the meeting: ${meeting.title}`
      );
    }

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('createdBy', 'name email position')
      .populate('attendees.userId', 'name email position');

    res.json(populatedMeeting);

  } catch (error) {
    console.error("Update RSVP error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getMeetingStatistics = async (req, res) => {
  try {
    const total = await Meeting.countDocuments();
    
    const now = new Date();
    const upcoming = await Meeting.countDocuments({
      $or: [
        { date: { $gt: now } },
        { 
          date: { 
            $eq: new Date(now.toISOString().split('T')[0]) 
          },
          time: { $gt: now.toTimeString().split(' ')[0] }
        }
      ]
    });

    const past = total - upcoming;

    // Count by meeting type
    const byType = await Meeting.aggregate([
      { $group: { _id: "$meetingType", count: { $sum: 1 } } }
    ]);

    // Calculate overall attendance rate
    const allMeetings = await Meeting.find().populate('attendees.userId');
    let totalAttendees = 0;
    let totalResponses = 0;

    allMeetings.forEach(meeting => {
      meeting.attendees.forEach(attendee => {
        totalAttendees++;
        if (attendee.status !== "pending") {
          totalResponses++;
        }
      });
    });

    const attendanceRate = totalAttendees > 0 ? (totalResponses / totalAttendees) * 100 : 0;

    res.json({
      total,
      upcoming,
      past,
      byType: byType.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      attendanceRate: Math.round(attendanceRate)
    });

  } catch (error) {
    console.error("Get statistics error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.linkMinutes = async (req, res) => {
  try {
    const { minutesId } = req.body;
    const meetingId = req.params.id;

    if (!minutesId) {
      return res.status(400).json({ message: "Minutes ID is required" });
    }

    const meeting = await Meeting.findById(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    // Check if user is admin or meeting creator
    if (req.user.role !== "ADMIN" && meeting.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized to link minutes" });
    }

    meeting.minutesId = minutesId;
    await meeting.save();

    const populatedMeeting = await Meeting.findById(meeting._id)
      .populate('createdBy', 'name email position')
      .populate('minutesId');

    res.json(populatedMeeting);

  } catch (error) {
    console.error("Link minutes error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};