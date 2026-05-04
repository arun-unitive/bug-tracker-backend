import User from '../models/User.js';
import Project from '../models/Project.js';
import Bug from '../models/Bug.js';
import Activity from '../models/Activity.js';

// @desc    Get all users (Admin)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID (Admin)
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (user) {
      // Get projects where user is assigned
      const projects = await Project.find({
        $or: [
          { developers: req.params.id },
          { testers: req.params.id },
          { createdBy: req.params.id }
        ]
      }).populate('createdBy', 'name email');

      // Get bugs created by or assigned to user
      const bugs = await Bug.find({
        $or: [
          { createdBy: req.params.id },
          { assignedTo: req.params.id }
        ]
      }).populate('project', 'name').populate('assignedTo', 'name');

      // Get recent activities for this user
      const activities = await Activity.find({ user: req.params.id })
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('project', 'name')
        .populate('bug', 'title');

      res.json({
        ...user._doc,
        projects,
        bugs,
        activities
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user (Admin)
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.role = req.body.role || user.role;
      user.profilePhoto = req.body.profilePhoto || user.profilePhoto;

      if (req.body.password) {
        user.password = req.body.password;
      }

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profilePhoto: updatedUser.profilePhoto,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user (Admin)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      if (user.role === 'Admin') {
        return res.status(400).json({ message: 'Cannot delete an Admin user' });
      }
      await user.deleteOne();
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
