// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\system.routes.js
const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const { sendEmail } = require("../utils/mailer");
const checkOverdue = require("../utils/overdueChecker");
const Task = require("../models/task.model"); // Import Task model
const User = require("../models/user.model"); // Import User model


// Test email endpoint (keep this as is)
router.post("/test-email", async (req, res) => {
  const { to = process.env.EMAIL_USER } = req.body;
  
  try {
    const result = await sendEmail({
      to,
      subject: "Test Email from Dept Exec System",
      text: `This is a test email sent at ${new Date().toISOString()}\n\nIf you receive this, email is working!`
    });
    
    if (result) {
      res.json({ 
        success: true, 
        message: "Test email sent successfully",
        messageId: result.messageId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: "Email sending failed (check server logs)" 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;