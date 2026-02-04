// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\search.controller.js
const Task = require('../models/task.model');
const Minutes = require('../models/minutes.model');
const Meeting = require('../models/meeting.model');
const User = require('../models/user.model');

exports.globalSearch = async (req, res) => {
  try {
    const { q: query, limit = 10, offset = 0, types = 'all' } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        message: "Search query must be at least 2 characters" 
      });
    }

    const searchTypes = types === 'all' 
      ? ['tasks', 'minutes', 'meetings', 'users']
      : types.split(',');

    const results = [];
    const searchPromises = [];

    // Search Tasks
    if (searchTypes.includes('tasks')) {
      searchPromises.push(
        Task.find({
          $text: { $search: query },
          ...(userRole === 'EXEC' ? { assignedTo: userId } : {})
        })
        .select('title description status priority dueDate assignedTo')
        .populate('assignedTo', 'name position')
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .then(tasks => tasks.map(task => ({
          type: 'task',
          id: task._id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assignedTo: task.assignedTo?.name,
          url: `/dashboard/tasks/${task._id}`
        })))
      );
    }

    // Search Minutes
    if (searchTypes.includes('minutes')) {
      searchPromises.push(
        Minutes.find({
          $text: { $search: query },
          ...(userRole === 'EXEC' ? { approved: true } : {})
        })
        .select('title minutesText date approved session semester')
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .then(minutes => minutes.map(min => ({
          type: 'minutes',
          id: min._id,
          title: min.title,
          description: min.minutesText.substring(0, 200) + (min.minutesText.length > 200 ? '...' : ''),
          date: min.date,
          approved: min.approved,
          session: min.session,
          url: `/dashboard/minutes/${min._id}`
        })))
      );
    }

    // Search Meetings
    if (searchTypes.includes('meetings')) {
      searchPromises.push(
        Meeting.find({
          $text: { $search: query },
          'attendees.userId': userId
        })
        .select('title agenda date time venue meetingType')
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .then(meetings => meetings.map(meeting => ({
          type: 'meeting',
          id: meeting._id,
          title: meeting.title,
          description: meeting.agenda?.substring(0, 200) || '',
          date: meeting.date,
          time: meeting.time,
          venue: meeting.venue,
          meetingType: meeting.meetingType,
          url: `/dashboard/meetings/${meeting._id}`
        })))
      );
    }

    // Search Users (Admin only)
    if (searchTypes.includes('users') && userRole === 'ADMIN') {
      searchPromises.push(
        User.find({
          $text: { $search: query },
          _id: { $ne: userId } // Exclude current user
        })
        .select('name email position department role isActive')
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .then(users => users.map(user => ({
          type: 'user',
          id: user._id,
          title: user.name,
          description: `${user.position} - ${user.department}`,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          url: `/dashboard/users/${user._id}`
        })))
      );
    }

    const allResults = await Promise.all(searchPromises);
    results.push(...allResults.flat());

    // Sort by relevance (simple implementation)
    results.sort((a, b) => {
      const aScore = a.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      const bScore = b.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
      return bScore - aScore;
    });

    res.json({
      query,
      total: results.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      types: searchTypes,
      results
    });

  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};