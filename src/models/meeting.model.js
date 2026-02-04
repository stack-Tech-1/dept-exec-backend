// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\models\meeting.model.js
const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Meeting title is required"],
    trim: true,
  },
  date: {
    type: Date,
    required: [true, "Meeting date is required"],
  },
  time: {
    type: String,
    required: [true, "Meeting time is required"],
  },
  venue: {
    type: String,
    required: [true, "Meeting venue is required"],
    trim: true,
  },
  agenda: {
    type: String,
    default: "",
  },
  zoomLink: {
    type: String,
    default: "",
  },
  meetingType: {
    type: String,
    enum: ["zoom", "physical", "hybrid"],
    default: "physical",
  },
  rsvpDeadline: {
    type: Date,
    default: null,
  },
  attendees: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: String,
    position: String,
    status: {
      type: String,
      enum: ["attending", "not_attending", "maybe", "pending"],
      default: "pending",
    },
    respondedAt: Date,
  }],
  minutesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Minutes",
    default: null,
  },
  session: {
    type: String,
    default: "2024/2025",
  },
  semester: {
    type: String,
    default: "First Semester",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
meetingSchema.index({ date: 1 });
meetingSchema.index({ createdBy: 1 });
meetingSchema.index({ "attendees.userId": 1 });
meetingSchema.index({ meetingType: 1 });
meetingSchema.index({ title: 'text', agenda: 'text', venue: 'text' }); // MOVED HERE - AFTER schema definition

// Virtual for checking if meeting is upcoming
meetingSchema.virtual("isUpcoming").get(function() {
  const now = new Date();
  const meetingDateTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.time}`);
  return meetingDateTime > now;
});

// Virtual for checking if meeting is past
meetingSchema.virtual("isPast").get(function() {
  const now = new Date();
  const meetingDateTime = new Date(`${this.date.toISOString().split('T')[0]}T${this.time}`);
  return meetingDateTime < now;
});

// Method to add attendee
meetingSchema.methods.addAttendee = function(userId, name, position) {
  const existing = this.attendees.find(a => a.userId.toString() === userId.toString());
  if (!existing) {
    this.attendees.push({
      userId,
      name,
      position,
      status: "pending",
    });
  }
  return this;
};

// Method to update RSVP status
meetingSchema.methods.updateRSVP = function(userId, status) {
  const attendee = this.attendees.find(a => a.userId.toString() === userId.toString());
  if (attendee) {
    attendee.status = status;
    attendee.respondedAt = new Date();
  }
  return this;
};

const Meeting = mongoose.model("Meeting", meetingSchema);
module.exports = Meeting;