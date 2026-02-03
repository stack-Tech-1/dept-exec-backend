// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\goal.controller.js
const Goal = require("../models/goal.model");
const Task = require("../models/task.model");
const User = require("../models/user.model");
const { sendEmail } = require("../utils/mailer");
const { addNotification } = require("../utils/notifications");

exports.createGoal = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { 
      title, 
      description, 
      category, 
      targetDate, 
      priority, 
      department,
      assignedTo,
      kpis,
      budget,
      milestones,
      tags
    } = req.body;

    if (!title || !targetDate) {
      return res.status(400).json({ message: "Title and target date are required" });
    }

    // Create goal
    const goal = await Goal.create({
      title,
      description: description || "",
      category: category || "administrative",
      targetDate: new Date(targetDate),
      priority: priority || "medium",
      department: department || "IPE Department",
      assignedTo: assignedTo || [],
      kpis: kpis || [],
      budget: budget || { allocated: 0, spent: 0, currency: "NGN" },
      milestones: milestones || [],
      tags: tags || [],
      createdBy: req.user.id,
    });

    // Notify assigned users
    if (assignedTo && assignedTo.length > 0) {
      const assignedUsers = await User.find({ _id: { $in: assignedTo } });
      
      for (const user of assignedUsers) {
        await sendEmail({
          to: user.email,
          subject: `🎯 New Goal Assigned: ${title}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #0d7c3d; padding: 20px; text-align: center; color: white;">
              <h2>New Goal Assigned</h2>
            </div>
            <div style="padding: 20px; background: white;">
              <p>Hello <strong>${user.position} ${user.name}</strong>,</p>
              <p>You have been assigned to a new department goal:</p>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3 style="margin-top: 0;">${title}</h3>
                <p><strong>Description:</strong> ${description || 'No description provided'}</p>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Target Date:</strong> ${new Date(targetDate).toLocaleDateString()}</p>
                <p><strong>Priority:</strong> <span style="color: ${
                  priority === 'critical' ? '#dc3545' : 
                  priority === 'high' ? '#fd7e14' :
                  priority === 'medium' ? '#ffc107' : '#28a745'
                }">${priority.toUpperCase()}</span></p>
                <p><strong>Assigned by:</strong> ${req.user.name} (${req.user.position})</p>
              </div>
              
              <p>Please log in to the system to view goal details and contribute tasks.</p>
              <p><em>– Department Executive System</em></p>
            </div>
          </div>
          `,
        });

        addNotification(
          user._id,
          `New goal assigned: ${title}`
        );
      }
    }

    const populatedGoal = await Goal.findById(goal._id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position');

    res.status(201).json(populatedGoal);

  } catch (error) {
    console.error("Create goal error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllGoals = async (req, res) => {
  try {
    let filter = { isArchived: false };
    
    // Exec can only see goals they're assigned to
    if (req.user.role === "EXEC") {
      filter.assignedTo = req.user.id;
    }

    const { category, status, priority } = req.query;
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const goals = await Goal.find(filter)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position')
      .populate('tasks.taskId', 'title status dueDate')
      .sort({ priority: -1, targetDate: 1 });

    res.json(goals);
  } catch (error) {
    console.error("Get goals error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position')
      .populate('tasks.taskId', 'title status dueDate priority assignedTo')
      .populate('dependencies.goalId', 'title status progress');

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // Check permissions
    const isAssigned = goal.assignedTo.some(
      user => user._id.toString() === req.user.id
    );
    
    if (req.user.role !== "ADMIN" && !isAssigned) {
      return res.status(403).json({
        message: "You can only view goals assigned to you",
      });
    }

    res.json(goal);
  } catch (error) {
    console.error("Get goal by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goalId = req.params.id;
    const goal = await Goal.findById(goalId);

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // Check permissions
    const isAssigned = goal.assignedTo.some(
      user => user.toString() === req.user.id
    );
    
    if (req.user.role !== "ADMIN" && !isAssigned) {
      return res.status(403).json({
        message: "You can only update goals assigned to you",
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title', 'description', 'progress', 'status', 'notes',
      'milestones', 'kpis', 'budget.spent'
    ];
    
    // Admins can update more fields
    if (req.user.role === "ADMIN") {
      allowedUpdates.push(
        'category', 'targetDate', 'priority', 'assignedTo',
        'budget.allocated', 'dependencies', 'tags'
      );
    }

    for (const field in req.body) {
      if (allowedUpdates.includes(field)) {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          if (goal[parent]) {
            goal[parent][child] = req.body[field];
          }
        } else {
          goal[field] = req.body[field];
        }
      }
    }

    // Recalculate progress if tasks were updated
    if (req.body.tasks) {
      await goal.calculateProgress();
    }

    await goal.save();

    const populatedGoal = await Goal.findById(goal._id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position')
      .populate('tasks.taskId', 'title status dueDate');

    res.json(populatedGoal);

  } catch (error) {
    console.error("Update goal error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.linkTaskToGoal = async (req, res) => {
  try {
    const { taskId, weight } = req.body;
    const goalId = req.params.id;

    const goal = await Goal.findById(goalId);
    const task = await Task.findById(taskId);

    if (!goal || !task) {
      return res.status(404).json({ message: "Goal or task not found" });
    }

    // Check permissions
    const isAssigned = goal.assignedTo.some(
      user => user.toString() === req.user.id
    );
    
    if (req.user.role !== "ADMIN" && !isAssigned) {
      return res.status(403).json({
        message: "You can only link tasks to goals assigned to you",
      });
    }

    // Add task to goal
    goal.addTask(taskId, task.title, weight || 1);
    await goal.calculateProgress();
    await goal.save();

    // Update task with goal reference
    task.goalId = goalId;
    await task.save();

    const populatedGoal = await Goal.findById(goal._id)
      .populate('assignedTo', 'name email position')
      .populate('tasks.taskId', 'title status dueDate');

    res.json(populatedGoal);

  } catch (error) {
    console.error("Link task to goal error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getGoalStatistics = async (req, res) => {
  try {
    let filter = { isArchived: false };
    
    if (req.user.role === "EXEC") {
      filter.assignedTo = req.user.id;
    }

    const totalGoals = await Goal.countDocuments(filter);
    const completedGoals = await Goal.countDocuments({ ...filter, status: "completed" });
    const inProgressGoals = await Goal.countDocuments({ ...filter, status: "in-progress" });
    const atRiskGoals = await Goal.countDocuments({ ...filter, status: "at-risk" });
    const behindScheduleGoals = await Goal.countDocuments({ ...filter, status: "behind-schedule" });

    // Average progress
    const goals = await Goal.find(filter);
    const totalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
    const averageProgress = totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0;

    // Goals by category
    const byCategory = await Goal.aggregate([
      { $match: filter },
      { $group: { _id: "$category", count: { $sum: 1 }, avgProgress: { $avg: "$progress" } } }
    ]);

    // Goals by priority
    const byPriority = await Goal.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } }
    ]);

    // Upcoming deadlines (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const upcomingDeadlines = await Goal.countDocuments({
      ...filter,
      targetDate: { $lte: thirtyDaysFromNow, $gte: new Date() },
      status: { $ne: "completed" }
    });

    res.json({
      totalGoals,
      completedGoals,
      inProgressGoals,
      atRiskGoals,
      behindScheduleGoals,
      averageProgress,
      upcomingDeadlines,
      byCategory: byCategory.reduce((acc, curr) => {
        acc[curr._id] = { count: curr.count, avgProgress: Math.round(curr.avgProgress) };
        return acc;
      }, {}),
      byPriority: byPriority.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error("Get goal statistics error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.archiveGoal = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    goal.isArchived = true;
    await goal.save();

    res.json({ 
      message: "Goal archived successfully",
      goalId: req.params.id
    });

  } catch (error) {
    console.error("Archive goal error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};