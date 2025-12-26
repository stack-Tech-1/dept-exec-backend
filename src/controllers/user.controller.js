const User = require('../models/user.model');

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // Exclude passwords and sensitive information
    const users = await User.find({}, '-password -resetToken -resetTokenExpiry')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });
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

    res.json({ success: true, user });
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

    res.json({ success: true, user });
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
    const { name, department, position } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (department) updates.department = department;
    if (position) updates.position = position;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, select: '-password -resetToken -resetTokenExpiry' }
    );

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user 
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error updating profile' 
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

    res.json({ 
      success: true, 
      message: 'User updated successfully',
      user: updatedUser 
    });
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
      const adminCount = await User.countDocuments({ role: 'ADMIN' });
      if (adminCount <= 1) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot delete the last admin user' 
        });
      }
    }

    await User.findByIdAndDelete(userId);

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error deleting user' 
    });
  }
};