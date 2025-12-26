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
          if (task.assignedTo && task.assignedTo.email) {
            await sendEmail({
              to: task.assignedTo.email,
              subject: `⚠️ Task Marked Overdue: ${task.title}`,
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #f59e0b, #d97706); padding: 20px; text-align: center; color: white;">
                  <h2>Task Overdue Notice</h2>
                </div>
                <div style="padding: 20px; background: white;">
                  <p>Hello <strong>${task.assignedTo.name}</strong>,</p>
                  <p>One of your tasks has been marked as <strong style="color: #dc2626;">OVERDUE</strong>:</p>
                  
                  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0;">
                    <h3 style="margin-top: 0; color: #92400e;">${task.title}</h3>
                    <p><strong>Description:</strong> ${task.description || 'No description provided'}</p>
                    <p><strong>Due Date:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
                    <p><strong>Priority:</strong> ${task.priority}</p>
                    <p><strong>Assigned By:</strong> ${task.createdBy?.name || 'System'}</p>
                  </div>
                  
                  <p>Please log in to update the task status or request an extension.</p>
                  <p><em>– Department Executive System</em></p>
                </div>
              </div>
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