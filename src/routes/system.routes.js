const router = require("express").Router();
const { protect, adminOnly } = require("../middleware/auth.middleware");
const users = require("../utils/users");
const { sendEmail } = require("../utils/mailer");
const checkOverdue = require("../utils/overdueChecker");
const { tasks } = require("../controllers/task.controller");

router.post("/check-overdue", protect, adminOnly, async (req, res) => {
  const overdueTasks = checkOverdue(tasks);

  console.log(`Found ${overdueTasks.length} overdue tasks`);

  for (const task of overdueTasks) {
    const user = users[task.assignedTo];

    if (user) {
      await sendEmail({
        to: user.email,
        subject: "Overdue Task Reminder",
        text: `
Hello ${user.name},

Your task "${task.title}" is overdue.
Due Date: ${new Date(task.dueDate).toDateString()}
Current Status: ${task.status}

Please attend to it immediately.

– Dept Exec System
`,
      });
      console.log(`Sent overdue email to ${user.email} for task: ${task.title}`);
    }
  }

  res.json({ 
    message: "Overdue check completed",
    overdueCount: overdueTasks.length,
    notifiedUsers: overdueTasks.map(t => users[t.assignedTo]?.name).filter(Boolean)
  });
});




// Test email endpoint
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