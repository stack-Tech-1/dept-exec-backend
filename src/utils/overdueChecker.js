const { sendEmail } = require("./mailer");
const { addNotification } = require("./notifications");
const Task = require("../models/task.model"); 
const User = require("../models/user.model"); 

// ✅ UPDATED: Remove tasks parameter, fetch from DB directly
function startOverdueChecker() {
  console.log("⏰ Overdue task checker started");

  setInterval(async () => {
    try {
      const now = new Date();
      
      // ✅ UPDATED: Find overdue tasks in database
      const overdueTasks = await Task.find({
        status: { $in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { $lt: now }
      }).populate('assignedTo createdBy');

      for (const task of overdueTasks) {
        // Mark as overdue
        task.status = "OVERDUE";
        
        // Add audit trail
        task.statusHistory.push({
          status: "OVERDUE",
          changedBy: null, // system
          changedAt: new Date(),
        });

        await task.save();

        console.log(`⚠️ Task overdue: ${task.title}`);

        // Notify EXEC
        if (task.assignedTo) {
          // Email notification
          await sendEmail({
            to: task.assignedTo.email,
            subject: "⚠️ Task Overdue",
            text: `
Hello ${task.assignedTo.name},

The following task is now OVERDUE:

Task: ${task.title}
Due Date: ${task.dueDate.toDateString()}

Please take immediate action.

– Dept Exec System
`,
          });

          // In-app notification
          addNotification(
            task.assignedTo._id,
            `Task overdue: ${task.title}`
          );
        }

        // Notify ADMIN
        if (task.createdBy) {
          // Email notification
          await sendEmail({
            to: task.createdBy.email,
            subject: "⚠️ Task Marked as Overdue",
            text: `
Hello ${task.createdBy.name},

The following task has been marked as OVERDUE:

Task: ${task.title}
Assigned To: ${task.assignedTo?.name || "Unknown"}

– Dept Exec System
`,
          });

          // In-app notification
          addNotification(
            task.createdBy._id,
            `Task overdue: ${task.title} (assigned to ${task.assignedTo?.name})`
          );
        }
      }

      if (overdueTasks.length > 0) {
        console.log(`✅ Processed ${overdueTasks.length} overdue tasks`);
      }
    } catch (error) {
      console.error("❌ Overdue checker error:", error);
    }
  }, 60 * 1000); 
}

module.exports = startOverdueChecker;