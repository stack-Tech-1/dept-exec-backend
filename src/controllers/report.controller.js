// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\report.controller.js
const Task = require("../models/task.model");
const Meeting = require("../models/meeting.model");
const Goal = require("../models/goal.model");
const User = require("../models/user.model");

exports.getTaskReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    
    // Apply date filter if provided
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Exec can only see their own tasks
    if (req.user.role === "EXEC") {
      filter.assignedTo = req.user.id;
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position');

    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === "COMPLETED").length;
    const overdueTasks = tasks.filter(t => t.status === "OVERDUE").length;
    const pendingTasks = tasks.filter(t => t.status === "PENDING").length;
    const inProgressTasks = tasks.filter(t => t.status === "IN_PROGRESS").length;
    
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Group by priority
    const byPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    // Group by status
    const byStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    // Group by assignee
    const assigneeMap = new Map();
    tasks.forEach(task => {
      if (task.assignedTo) {
        const assigneeId = task.assignedTo._id.toString();
        if (!assigneeMap.has(assigneeId)) {
          assigneeMap.set(assigneeId, {
            assigneeId,
            assigneeName: task.assignedTo.name,
            assigneePosition: task.assignedTo.position,
            totalTasks: 0,
            completedTasks: 0,
            overdueTasks: 0,
          });
        }
        
        const stats = assigneeMap.get(assigneeId);
        stats.totalTasks++;
        if (task.status === "COMPLETED") stats.completedTasks++;
        if (task.status === "OVERDUE") stats.overdueTasks++;
      }
    });

    const byAssignee = Array.from(assigneeMap.values()).map(stats => ({
      ...stats,
      completionRate: stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0,
    }));

    // Calculate average completion time for completed tasks
    const completedTasksWithTime = tasks.filter(t => 
      t.status === "COMPLETED" && t.completedAt && t.createdAt
    );
    
    const totalCompletionTime = completedTasksWithTime.reduce((sum, task) => {
      const completionTime = (task.completedAt - task.createdAt) / (1000 * 60 * 60 * 24); // in days
      return sum + completionTime;
    }, 0);
    
    const averageCompletionTime = completedTasksWithTime.length > 0 
      ? totalCompletionTime / completedTasksWithTime.length 
      : 0;

    // Weekly trend (last 8 weeks)
    const weeklyTrend = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekTasks = tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate >= weekStart && taskDate <= weekEnd;
      });
      
      const weekCompleted = weekTasks.filter(t => t.status === "COMPLETED").length;
      
      weeklyTrend.push({
        week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
        created: weekTasks.length,
        completed: weekCompleted,
      });
    }

    res.json({
      total: totalTasks,
      completed: completedTasks,
      overdue: overdueTasks,
      pending: pendingTasks,
      inProgress: inProgressTasks,
      completionRate: Math.round(completionRate),
      byPriority,
      byStatus,
      byAssignee,
      averageCompletionTime: Math.round(averageCompletionTime * 10) / 10,
      weeklyTrend,
    });

  } catch (error) {
    console.error("Get task report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getMeetingReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};
    
    // Apply date filter if provided
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const meetings = await Meeting.find(filter)
      .populate('createdBy', 'name email position')
      .populate('attendees.userId', 'name email position');

    // Calculate statistics
    const total = meetings.length;
    const now = new Date();
    
    const upcoming = meetings.filter(m => {
      const meetingDate = new Date(`${m.date.toISOString().split('T')[0]}T${m.time}`);
      return meetingDate > now;
    }).length;
    
    const past = total - upcoming;

    // Group by meeting type
    const byType = meetings.reduce((acc, meeting) => {
      acc[meeting.meetingType] = (acc[meeting.meetingType] || 0) + 1;
      return acc;
    }, {});

    // Calculate attendance rate
    let totalAttendees = 0;
    let totalAttended = 0;
    meetings.forEach(meeting => {
      meeting.attendees.forEach(attendee => {
        totalAttendees++;
        if (attendee.status === "attending") {
          totalAttended++;
        }
      });
    });
    
    const attendanceRate = totalAttendees > 0 ? (totalAttended / totalAttendees) * 100 : 0;

    // Monthly breakdown
    const monthlyData = {};
    meetings.forEach(meeting => {
      const month = `${meeting.date.getFullYear()}-${String(meeting.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[month]) {
        monthlyData[month] = {
          count: 0,
          attendance: 0,
          totalAttendees: 0,
        };
      }
      
      monthlyData[month].count++;
      meeting.attendees.forEach(attendee => {
        monthlyData[month].totalAttendees++;
        if (attendee.status === "attending") {
          monthlyData[month].attendance++;
        }
      });
    });

    const byMonth = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      count: data.count,
      attendance: data.totalAttendees > 0 ? Math.round((data.attendance / data.totalAttendees) * 100) : 0,
    })).sort((a, b) => a.month.localeCompare(b.month));

    // RSVP statistics
    const rsvpStats = {
      attending: 0,
      notAttending: 0,
      maybe: 0,
      pending: 0,
    };

    meetings.forEach(meeting => {
      meeting.attendees.forEach(attendee => {
        if (attendee.status in rsvpStats) {
          rsvpStats[attendee.status]++;
        }
      });
    });

    res.json({
      total,
      upcoming,
      past,
      byType,
      attendanceRate: Math.round(attendanceRate),
      byMonth,
      rsvpStats,
    });

  } catch (error) {
    console.error("Get meeting report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getGoalReport = async (req, res) => {
  try {
    let filter = { isArchived: false };
    
    // Exec can only see goals they're assigned to
    if (req.user.role === "EXEC") {
      filter.assignedTo = req.user.id;
    }

    const goals = await Goal.find(filter)
      .populate('assignedTo', 'name email position')
      .populate('tasks.taskId');

    // Calculate statistics
    const totalGoals = goals.length;
    const completedGoals = goals.filter(g => g.status === "completed").length;
    const inProgressGoals = goals.filter(g => g.status === "in-progress").length;
    const atRiskGoals = goals.filter(g => g.status === "at-risk").length;
    
    const totalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
    const averageProgress = totalGoals > 0 ? Math.round(totalProgress / totalGoals) : 0;

    // Group by category
    const byCategory = {};
    goals.forEach(goal => {
      if (!byCategory[goal.category]) {
        byCategory[goal.category] = {
          count: 0,
          totalProgress: 0,
        };
      }
      byCategory[goal.category].count++;
      byCategory[goal.category].totalProgress += goal.progress;
    });

    // Calculate average progress per category
    Object.keys(byCategory).forEach(category => {
      byCategory[category].avgProgress = Math.round(
        byCategory[category].totalProgress / byCategory[category].count
      );
      delete byCategory[category].totalProgress;
    });

    // Group by priority
    const byPriority = goals.reduce((acc, goal) => {
      acc[goal.priority] = (acc[goal.priority] || 0) + 1;
      return acc;
    }, {});

    // Upcoming deadlines (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const upcomingDeadlines = goals.filter(goal => {
      return goal.targetDate <= thirtyDaysFromNow && 
             goal.targetDate >= new Date() &&
             goal.status !== "completed";
    }).length;

    // Budget utilization
    const budgetUtilization = {
      totalAllocated: 0,
      totalSpent: 0,
    };

    goals.forEach(goal => {
      budgetUtilization.totalAllocated += goal.budget?.allocated || 0;
      budgetUtilization.totalSpent += goal.budget?.spent || 0;
    });

    const utilizationRate = budgetUtilization.totalAllocated > 0 
      ? (budgetUtilization.totalSpent / budgetUtilization.totalAllocated) * 100 
      : 0;

    res.json({
      total: totalGoals,
      completed: completedGoals,
      inProgress: inProgressGoals,
      atRisk: atRiskGoals,
      averageProgress,
      byCategory,
      byPriority,
      upcomingDeadlines,
      budgetUtilization: {
        ...budgetUtilization,
        utilizationRate: Math.round(utilizationRate),
      },
    });

  } catch (error) {
    console.error("Get goal report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserPerformance = async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUserId = userId || req.user.id;

    // Check permissions
    if (req.user.role !== "ADMIN" && req.user.id !== targetUserId) {
      return res.status(403).json({ 
        message: "You can only view your own performance report" 
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's tasks
    const tasks = await Task.find({ assignedTo: targetUserId })
      .populate('assignedTo', 'name email position');

    // Get user's meetings (where they are an attendee)
    const meetings = await Meeting.find({
      "attendees.userId": targetUserId
    });

    // Get user's goals
    const goals = await Goal.find({
      assignedTo: targetUserId,
      isArchived: false,
    });

    // Task statistics
    const taskStats = {
      assigned: tasks.length,
      completed: tasks.filter(t => t.status === "COMPLETED").length,
      overdue: tasks.filter(t => t.status === "OVERDUE").length,
    };
    
    taskStats.completionRate = taskStats.assigned > 0 
      ? (taskStats.completed / taskStats.assigned) * 100 
      : 0;

    // Calculate average completion time
    const completedTasks = tasks.filter(t => 
      t.status === "COMPLETED" && t.completedAt && t.createdAt
    );
    
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      const completionTime = (task.completedAt - task.createdAt) / (1000 * 60 * 60 * 24);
      return sum + completionTime;
    }, 0);
    
    taskStats.averageCompletionTime = completedTasks.length > 0 
      ? totalCompletionTime / completedTasks.length 
      : 0;

    // Meeting statistics
    const meetingStats = {
      invited: meetings.length,
      attended: meetings.filter(m => {
        const userAttendance = m.attendees.find(a => 
          a.userId.toString() === targetUserId
        );
        return userAttendance?.status === "attending";
      }).length,
    };
    
    meetingStats.attendanceRate = meetingStats.invited > 0 
      ? (meetingStats.attended / meetingStats.invited) * 100 
      : 0;
    
    // Punctuality (simplified - assume attended meetings were on time)
    meetingStats.punctuality = meetingStats.attended > 0 ? 85 : 0; // Placeholder

    // Goal statistics
    const goalStats = {
      assigned: goals.length,
      completed: goals.filter(g => g.status === "completed").length,
    };
    
    const totalGoalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
    goalStats.averageProgress = goals.length > 0 
      ? totalGoalProgress / goals.length 
      : 0;
    
    // Count tasks contributed to goals
    goalStats.contributions = tasks.filter(t => t.goalId).length;

    // Calculate overall score (weighted average)
    const weights = {
      taskCompletion: 0.4,
      meetingAttendance: 0.3,
      goalProgress: 0.3,
    };
    
    const overallScore = 
      (taskStats.completionRate * weights.taskCompletion) +
      (meetingStats.attendanceRate * weights.meetingAttendance) +
      (goalStats.averageProgress * weights.goalProgress);

    const performance = {
      userId: user._id,
      userName: user.name,
      userPosition: user.position,
      taskStats: {
        ...taskStats,
        completionRate: Math.round(taskStats.completionRate),
        averageCompletionTime: Math.round(taskStats.averageCompletionTime * 10) / 10,
      },
      meetingStats: {
        ...meetingStats,
        attendanceRate: Math.round(meetingStats.attendanceRate),
        punctuality: Math.round(meetingStats.punctuality),
      },
      goalStats: {
        ...goalStats,
        averageProgress: Math.round(goalStats.averageProgress),
      },
      overallScore: Math.round(overallScore),
    };

    res.json(performance);

  } catch (error) {
    console.error("Get user performance error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getDepartmentReport = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }

    const { period = 'month' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    // Get all reports
    const [taskReport, meetingReport, goalReport, allUsers] = await Promise.all([
      this.getTaskReportData(startDate, now),
      this.getMeetingReportData(startDate, now),
      this.getGoalReportData(),
      User.find({ isActive: true, role: "EXEC" }),
    ]);

    // Get top performers
    const userPerformances = await Promise.all(
      allUsers.map(user => this.getUserPerformanceData(user._id))
    );

    const topPerformers = userPerformances
      .filter(p => p.overallScore > 0)
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 5);

    // Calculate department health
    const departmentHealth = this.calculateDepartmentHealth(
      taskReport.completionRate,
      meetingReport.attendanceRate,
      goalReport.averageProgress
    );

    // Overall productivity score
    const overallProductivity = Math.round(
      (taskReport.completionRate * 0.4) +
      (meetingReport.attendanceRate * 0.3) +
      (goalReport.averageProgress * 0.3)
    );

    // Identify areas of improvement
    const areasOfImprovement = [];
    if (taskReport.completionRate < 70) areasOfImprovement.push("Task completion rates");
    if (meetingReport.attendanceRate < 80) areasOfImprovement.push("Meeting attendance");
    if (goalReport.averageProgress < 50) areasOfImprovement.push("Goal progress");
    if (taskReport.overdue > 5) areasOfImprovement.push("Overdue tasks");

    // Generate recommendations
    const recommendations = this.generateRecommendations(areasOfImprovement);

    const departmentReport = {
      period: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      summary: {
        totalTasks: taskReport.total,
        totalMeetings: meetingReport.total,
        totalGoals: goalReport.total,
        overallProductivity,
        departmentHealth,
      },
      taskReport,
      meetingReport,
      goalReport,
      topPerformers,
      areasOfImprovement,
      recommendations,
    };

    res.json(departmentReport);

  } catch (error) {
    console.error("Get department report error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper methods
exports.getTaskReportData = async (startDate, endDate) => {
  const tasks = await Task.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = tasks.filter(t => t.status === "COMPLETED").length;
  const total = tasks.length;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    overdue: tasks.filter(t => t.status === "OVERDUE").length,
    completionRate: Math.round(completionRate),
  };
};

exports.getMeetingReportData = async (startDate, endDate) => {
  const meetings = await Meeting.find({
    date: { $gte: startDate, $lte: endDate }
  }).populate('attendees.userId');

  let totalAttendees = 0;
  let totalAttended = 0;
  
  meetings.forEach(meeting => {
    meeting.attendees.forEach(attendee => {
      totalAttendees++;
      if (attendee.status === "attending") {
        totalAttended++;
      }
    });
  });

  const attendanceRate = totalAttendees > 0 ? (totalAttended / totalAttendees) * 100 : 0;

  return {
    total: meetings.length,
    attendanceRate: Math.round(attendanceRate),
  };
};

exports.getGoalReportData = async () => {
  const goals = await Goal.find({ isArchived: false });
  
  const totalProgress = goals.reduce((sum, goal) => sum + goal.progress, 0);
  const averageProgress = goals.length > 0 ? totalProgress / goals.length : 0;

  return {
    total: goals.length,
    averageProgress: Math.round(averageProgress),
  };
};

exports.getUserPerformanceData = async (userId) => {
  const [tasks, meetings, goals] = await Promise.all([
    Task.find({ assignedTo: userId }),
    Meeting.find({ "attendees.userId": userId }),
    Goal.find({ assignedTo: userId, isArchived: false }),
  ]);

  const taskCompletionRate = tasks.length > 0 
    ? (tasks.filter(t => t.status === "COMPLETED").length / tasks.length) * 100 
    : 0;
  
  const meetingAttendanceRate = meetings.length > 0 
    ? (meetings.filter(m => {
        const attendance = m.attendees.find(a => a.userId.toString() === userId);
        return attendance?.status === "attending";
      }).length / meetings.length) * 100 
    : 0;
  
  const goalAvgProgress = goals.length > 0 
    ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length 
    : 0;

  const overallScore = Math.round(
    (taskCompletionRate * 0.4) +
    (meetingAttendanceRate * 0.3) +
    (goalAvgProgress * 0.3)
  );

  const user = await User.findById(userId);

  return {
    userId: user._id,
    userName: user.name,
    userPosition: user.position,
    overallScore,
  };
};

exports.calculateDepartmentHealth = (taskCompletion, meetingAttendance, goalProgress) => {
  const score = (taskCompletion + meetingAttendance + goalProgress) / 3;
  
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  return "poor";
};

exports.generateRecommendations = (areas) => {
  const recommendations = [];
  
  if (areas.includes("Task completion rates")) {
    recommendations.push(
      "Implement weekly task review meetings",
      "Set up automated reminders for approaching deadlines",
      "Consider reassigning overloaded team members"
    );
  }
  
  if (areas.includes("Meeting attendance")) {
    recommendations.push(
      "Schedule meetings at more convenient times",
      "Send meeting reminders 24 hours in advance",
      "Make meeting agendas more specific and actionable"
    );
  }
  
  if (areas.includes("Goal progress")) {
    recommendations.push(
      "Break down large goals into smaller milestones",
      "Assign clear ownership for each goal component",
      "Review goal progress in monthly executive meetings"
    );
  }
  
  if (areas.includes("Overdue tasks")) {
    recommendations.push(
      "Implement stricter deadline enforcement",
      "Create an escalation process for delayed tasks",
      "Review task estimation accuracy"
    );
  }

  // Default recommendations if no specific areas
  if (recommendations.length === 0) {
    recommendations.push(
      "Continue current practices - department performance is good",
      "Consider implementing peer recognition program",
      "Explore automation opportunities for routine tasks"
    );
  }

  return recommendations.slice(0, 3); // Return top 3 recommendations
};

// Add this method to C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\report.controller.js

exports.exportReport = async (req, res) => {
    try {
      if (req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admins only" });
      }
  
      const { type } = req.params;
      const { format = 'pdf' } = req.query;
  
      if (!['tasks', 'meetings', 'goals', 'department'].includes(type)) {
        return res.status(400).json({ 
          message: "Invalid report type. Must be one of: tasks, meetings, goals, department" 
        });
      }
  
      if (!['pdf', 'csv'].includes(format)) {
        return res.status(400).json({ 
          message: "Invalid format. Must be one of: pdf, csv" 
        });
      }
  
      // For now, we'll implement CSV export as a simple example
      // In a real application, you'd use libraries like pdfkit for PDF or exceljs for Excel
      let data;
      let filename;
      let contentType;
  
      switch (type) {
        case 'tasks':
          data = await this.getTaskReportData(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());
          filename = `tasks-report-${new Date().toISOString().split('T')[0]}`;
          break;
        
        case 'meetings':
          data = await this.getMeetingReportData(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date());
          filename = `meetings-report-${new Date().toISOString().split('T')[0]}`;
          break;
        
        case 'goals':
          data = await this.getGoalReportData();
          filename = `goals-report-${new Date().toISOString().split('T')[0]}`;
          break;
        
        case 'department':
          data = await this.getDepartmentReportData();
          filename = `department-report-${new Date().toISOString().split('T')[0]}`;
          break;
      }
  
      if (format === 'csv') {
        // Convert data to CSV format (simplified example)
        const csvData = this.convertToCSV(data);
        contentType = 'text/csv';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send(csvData);
      } else {
        // For PDF, you would generate using pdfkit or similar
        // This is a placeholder - implement PDF generation as needed
        contentType = 'application/pdf';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        return res.json({ 
          message: "PDF export would be generated here",
          data,
          filename: `${filename}.pdf`
        });
      }
  
    } catch (error) {
      console.error("Export report error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
  
  // Helper method to convert data to CSV (simplified)
  exports.convertToCSV = (data) => {
    if (Array.isArray(data)) {
      // Handle array data
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
      );
      return [headers, ...rows].join('\n');
    } else {
      // Handle object data
      const rows = [];
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) {
          rows.push(`${key},${JSON.stringify(value)}`);
        } else {
          rows.push(`${key},${value}`);
        }
      }
      return rows.join('\n');
    }
  };
  
  // Helper method for department report data
  exports.getDepartmentReportData = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    const [taskReport, meetingReport, goalReport] = await Promise.all([
      this.getTaskReportData(thirtyDaysAgo, now),
      this.getMeetingReportData(thirtyDaysAgo, now),
      this.getGoalReportData()
    ]);
  
    return {
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString()
      },
      taskReport,
      meetingReport,
      goalReport,
      generatedAt: new Date().toISOString()
    };
  };