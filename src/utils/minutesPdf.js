const PDFDocument = require("pdfkit");

function generateMinutesPDF(res, minutes) {
  const doc = new PDFDocument({ 
    margin: 50,
    size: 'A4',
    info: {
      Title: minutes.title,
      Author: 'Department Executive System',
      Subject: 'Meeting Minutes',
      Keywords: 'meeting, minutes, department',
      CreationDate: new Date()
    }
  });

  // Set response headers
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="minutes-${minutes.id}-${minutes.date}.pdf"`
  );

  doc.pipe(res);

  // Header with logo
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor('#0d7c3d')
     .text('DEPARTMENT OF INDUSTRIAL & PRODUCTION ENGINEERING', { align: "center" });
  
  doc.fontSize(16)
     .fillColor('#0a5a2d')
     .text('Meeting Minutes', { align: "center" });
  
  doc.moveDown(2);

  // Meeting Details Section
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('MEETING DETAILS', { underline: true });
  
  doc.moveDown(0.5);
  
  doc.fontSize(11)
     .font('Helvetica')
     .text(`Title: ${minutes.title}`);
  doc.text(`Date: ${minutes.date}`);
  doc.text(`Time: ${minutes.time}`);
  doc.text(`Venue: ${minutes.venue}`);
  doc.text(`Session: ${minutes.session}`);
  doc.text(`Semester: ${minutes.semester}`);
  
  doc.moveDown();

  // Attendance Section
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .text('ATTENDANCE', { underline: true });
  
  doc.moveDown(0.5);
  
  if (minutes.attendance && minutes.attendance.length > 0) {
    minutes.attendance.forEach(attendee => {
      doc.fontSize(11)
         .font('Helvetica')
         .text(`• ${attendee.name} - ${attendee.role}`);
    });
  } else {
    doc.fontSize(11)
       .font('Helvetica-Italic')
       .text('No attendance recorded');
  }
  
  doc.moveDown();

  // Minutes Text Section
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .text('MINUTES OF MEETING', { underline: true });
  
  doc.moveDown(0.5);
  
  doc.fontSize(11)
     .font('Helvetica')
     .text(minutes.minutesText, {
       align: 'left',
       lineGap: 5
     });
  
  doc.moveDown();

  // Approval & Metadata Section
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .text('APPROVAL & METADATA', { underline: true });
  
  doc.moveDown(0.5);
  
  doc.fontSize(11)
     .font('Helvetica')
     .text(`Approval Status: ${minutes.approved ? 'APPROVED' : 'PENDING'}`);
  
  if (minutes.approved) {
    doc.text(`Approved By: User ID ${minutes.approvedBy}`);
    doc.text(`Approved At: ${new Date(minutes.approvedAt).toLocaleString()}`);
  }
  
  doc.text(`Created By: User ID ${minutes.createdBy}`);
  doc.text(`Created At: ${new Date(minutes.createdAt).toLocaleString()}`);
  
  if (minutes.recordingUrl) {
    doc.text(`Recording Available: Yes`);
  }

  // Footer
  doc.moveDown(3);
  doc.fontSize(10)
     .font('Helvetica-Oblique')
     .fillColor('gray')
     .text('Official Document - Department Executive System', { align: "center" });
  doc.text(`Document ID: MIN-${minutes.id} | Generated: ${new Date().toLocaleString()}`, { align: "center" });

  doc.end();
}

module.exports = generateMinutesPDF;