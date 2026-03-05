//C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\controllers\user.controller.js
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // Exclude passwords and sensitive information
    const users = await User.find({}, '-password -resetToken -resetTokenExpiry')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching users' 
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id, '-password -resetToken -resetTokenExpiry');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Only allow admin or the user themselves to view details
    if (req.user.role !== 'ADMIN' && req.user.id !== user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this user' 
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching user' 
    });
  }
};

// Get current user profile
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id, '-password -resetToken -resetTokenExpiry');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching profile' 
    });
  }
};

// Update current user profile
exports.updateCurrentUser = async (req, res) => {
  try {
    const { name, bio, phone, department } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Update allowed fields
    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;

    await user.save();

    const userWithoutPassword = await User.findById(user._id)
      .select('-password -resetToken -resetTokenExpiry');

    res.json(userWithoutPassword);

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error updating profile" 
    });
  }
};


// Update user (Admin or user themselves)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, department, position } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Authorization check: Only admin or the user themselves can update
    if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this user' 
      });
    }

    // Only admin can change role
    if (role && req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can change user role' 
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (department) updates.department = department;
    if (position) updates.position = position;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, select: '-password -resetToken -resetTokenExpiry' }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error updating user' 
    });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user is the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await User.countDocuments({ role: 'ADMIN', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last admin user'
        });
      }
    }

    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ message: 'Server error deactivating user' });
  }
};

// Reactivate user (Admin only) — returns updated User
exports.reactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isActive = true;
    await user.save();

    const updated = await User.findById(user._id).select('-password -resetToken -resetTokenExpiry');
    res.json(updated);
  } catch (error) {
    console.error('Error reactivating user:', error);
    res.status(500).json({ success: false, message: 'Server error reactivating user' });
  }
};

// Change password — accepts oldPassword (spec) or currentPassword (legacy)
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, currentPassword, newPassword } = req.body;
    const existingPassword = oldPassword || currentPassword;

    if (!existingPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    const match = await bcrypt.compare(existingPassword, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
};

// Get user statistics (Admin only)
exports.getUserStatistics = async (req, res) => {
  try {
    const [total, active, admins, execs, byPositionRaw] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'ADMIN' }),
      User.countDocuments({ role: 'EXEC' }),
      User.aggregate([{ $group: { _id: '$position', count: { $sum: 1 } } }])
    ]);

    const byPosition = byPositionRaw.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    res.json({ total, active, admins, execs, byPosition });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);

    const users = await User.find(
      { $text: { $search: query }, isActive: true },
      '-password -resetToken -resetTokenExpiry'
    ).limit(20);

    res.json(users);
  } catch (error) {
    // Fall back to regex search if text index unavailable
    try {
      const { query } = req.query;
      const regex = new RegExp(query, 'i');
      const users = await User.find(
        { $or: [{ name: regex }, { email: regex }, { position: regex }], isActive: true },
        '-password -resetToken -resetTokenExpiry'
      ).limit(20);
      res.json(users);
    } catch (fallbackError) {
      console.error('Search users error:', fallbackError);
      res.status(500).json({ message: 'Server error searching users' });
    }
  }
};