// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\utils\taskExtractor.js
const User = require('../models/user.model');
const Task = require('../models/task.model');

exports.extractTasksFromMinutes = async (minutesText, minutesId, createdBy) => {
  // Simple regex patterns for action items
  const patterns = [
    /(?:Treasurer|treasurer).*?(?:to|will)\s+([^.!?]+)/gi,
    /(?:Secretary|secretary).*?(?:to|will)\s+([^.!?]+)/gi,
    /(?:PRO|P\.?R\.?O\.?).*?(?:to|will)\s+([^.!?]+)/gi,
    /ACTION:\s*(.+)/gi,
    /TODO:\s*(.+)/gi,
    /Assign(?:ed)? to (.+?):(.+)/gi
  ];

  const tasks = [];
  
  for (const pattern of patterns) {
    const matches = [...minutesText.matchAll(pattern)];
    for (const match of matches) {
      const actionText = match[1] || match[2];
      if (actionText) {
        // Determine assignee from text
        let assignedTo = null;
        let position = 'Executive Member';
        
        if (match[0].toLowerCase().includes('treasurer')) {
          position = 'Treasurer';
        } else if (match[0].toLowerCase().includes('secretary')) {
          position = 'Secretary';
        } else if (match[0].toLowerCase().includes('pro')) {
          position = 'PRO';
        } else if (match[1]?.toLowerCase().includes('treasurer')) {
          position = 'Treasurer';
        } else if (match[1]?.toLowerCase().includes('secretary')) {
          position = 'Secretary';
        }
        
        // Find user by position
        const user = await User.findOne({ 
          position: { $regex: new RegExp(position, 'i') },
          role: 'EXEC'
        });
        
        if (user) {
          tasks.push({
            title: `From Minutes: ${actionText.substring(0, 100)}${actionText.length > 100 ? '...' : ''}`,
            description: `Action item from meeting minutes:\n\n${actionText}\n\nLinked to minutes ID: ${minutesId}`,
            assignedTo: user._id,
            priority: 'MEDIUM',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
            source: 'minutes',
            sourceId: minutesId,
            createdBy
          });
        }
      }
    }
  }
  
  return tasks;
};

exports.createTasksFromExtraction = async (tasksData) => {
  const createdTasks = [];
  
  for (const taskData of tasksData) {
    const task = await Task.create({
      ...taskData,
      statusHistory: [{
        status: "PENDING",
        changedBy: taskData.createdBy,
        changedAt: new Date(),
      }],
    });
    
    // Populate task data
    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email position')
      .populate('createdBy', 'name email position');
    
    createdTasks.push(populatedTask);
  }
  
  return createdTasks;
};