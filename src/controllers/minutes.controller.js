//C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\minutes.controller.js
const generateMinutesPDF = require("../utils/minutesPdf");
const Minutes = require("../models/minutes.model");



// Add these methods to your minutes.controller.js

exports.getMinutesStatistics = async (req, res) => {
  try {
    const total = await Minutes.countDocuments();
    const approved = await Minutes.countDocuments({ approved: true });
    const pending = await Minutes.countDocuments({ approved: false });
    
    // Group by session
    const bySession = await Minutes.aggregate([
      { $group: { _id: "$session", count: { $sum: 1 } } }
    ]);
    
    // Group by semester
    const bySemester = await Minutes.aggregate([
      { $group: { _id: "$semester", count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      approved,
      pending,
      bySession: bySession.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      bySemester: bySemester.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error("Statistics error:", error);
    res.status(500).json({ message: "Error fetching statistics" });
  }
};

exports.deleteMinutes = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admins only" });
  }

  try {
    const record = await Minutes.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Minutes not found" });
    }

    // ✅ HARDENED: Prevent deletion of approved minutes
    if (record.approved) {
      return res.status(403).json({
        message: "Approved minutes cannot be deleted",
      });
    }

    // Delete recording file if exists
    if (record.recordingUrl && process.env.NODE_ENV !== 'production') {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', record.recordingUrl);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await record.deleteOne();
    console.log(`🗑️ Minutes deleted: ${record.title} by user ${req.user.id}`);

    res.json({ message: "Minutes deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Error deleting minutes" });
  }
};

exports.createMinutes = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admins only" });
  }

  const { title, date, time, venue, minutesText, attendance, session, semester } = req.body;

  if (!title || !date || !minutesText) {
    return res.status(400).json({ 
      message: "Title, date, and minutes text are required" 
    });
  }

  let attendanceArray = [];
  if (attendance) {
    try {
      attendanceArray = JSON.parse(attendance);
      attendanceArray = attendanceArray.map(person => 
        `${person.name} (${person.role})`
      );
    } catch (error) {
      return res.status(400).json({ 
        message: "Attendance must be valid JSON array" 
      });
    }
  }

  const record = await Minutes.create({
    title,
    date: new Date(date),
    time: time || "Not specified",
    venue: venue || "Not specified",
    minutesText,

    recordingUrl: req.file
      ? `/uploads/minutes/${req.file.filename}`
      : null,
    recordingFilename: req.file ? req.file.originalname : null,

    attendance: attendanceArray,
    session: session || "2024/2025",
    semester: semester || "First Semester",

    createdBy: req.user.id,
  });

  console.log(`📄 Meeting minutes created: ${title} by user ${req.user.id}`);
  
  res.status(201).json(record);
};

exports.getAllMinutes = async (req, res) => {
  const { session, semester } = req.query;

  const filter = {};
  
  // ✅ HARDENED: EXEC can only see approved minutes
  if (req.user.role === "EXEC") {
    filter.approved = true;
  }
  
  if (session) filter.session = session;
  if (semester) filter.semester = semester;

  const result = await Minutes.find(filter)
    .sort({ date: -1 })
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');

  res.json(result);
};

exports.getMinutesById = async (req, res) => {
  const record = await Minutes.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');

  if (!record) {
    return res.status(404).json({ message: "Meeting minutes not found" });
  }

  // ✅ HARDENED: EXEC can only view approved minutes
  if (req.user.role === "EXEC" && !record.approved) {
    return res.status(403).json({ 
      message: "You can only view approved minutes" 
    });
  }

  res.json(record);
};

exports.downloadMinutesPDF = async (req, res) => {
  const record = await Minutes.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');

  if (!record) {
    return res.status(404).json({ message: "Minutes not found" });
  }

  if (!record.approved) {
    return res.status(400).json({
      message: "Only approved minutes can be downloaded as PDF",
    });
  }

  // ✅ HARDENED: EXEC can only download approved minutes
  if (req.user.role === "EXEC" && !record.approved) {
    return res.status(403).json({ 
      message: "You can only download approved minutes" 
    });
  }

  try {
    generateMinutesPDF(res, record);
  } catch (error) {
    console.error("PDF generation failed:", error);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
};

exports.updateMinutes = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admins only" });
  }

  const record = await Minutes.findById(req.params.id);

  if (!record) {
    return res.status(404).json({ message: "Minutes not found" });
  }

  // ✅ HARDENED: Stronger immutability check
  if (record.approved) {
    return res.status(403).json({
      message: "Approved minutes are locked permanently",
    });
  }

  const { title, date, time, venue, minutesText, attendance, session, semester } = req.body;

  if (title !== undefined) record.title = title;
  if (date !== undefined) record.date = new Date(date);
  if (time !== undefined) record.time = time;
  if (venue !== undefined) record.venue = venue;
  if (minutesText !== undefined) record.minutesText = minutesText;
  if (session !== undefined) record.session = session;
  if (semester !== undefined) record.semester = semester;
  
  if (attendance !== undefined) {
    try {
      const attendanceArray = JSON.parse(attendance);
      record.attendance = attendanceArray.map(person => 
        `${person.name} (${person.role})`
      );
    } catch (error) {
      return res.status(400).json({ 
        message: "Attendance must be valid JSON array" 
      });
    }
  }

  await record.save();
  console.log(`📝 Minutes updated: ${record.title} by user ${req.user.id}`);
  
  res.json(record);
};

exports.approveMinutes = async (req, res) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admins only" });
  }

  const record = await Minutes.findById(req.params.id);

  if (!record) {
    return res.status(404).json({ message: "Minutes not found" });
  }

  if (record.approved) {
    return res.status(400).json({ 
      message: "Minutes already approved" 
    });
  }

  // ✅ HARDENED: Prevent self-approval (separation of duties)
  if (record.createdBy.toString() === req.user.id) {
    return res.status(403).json({
      message: "You cannot approve minutes you created",
    });
  }

  record.approved = true;
  record.approvedBy = req.user.id;
  record.approvedAt = new Date();
  
  await record.save();

  console.log(`✅ Minutes approved: ${record.title} by user ${req.user.id}`);
  
  res.json({
    message: "Minutes approved and locked",
    minutes: record,
  });
};