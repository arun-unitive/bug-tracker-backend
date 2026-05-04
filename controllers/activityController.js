import Activity from '../models/Activity.js';
import Project from '../models/Project.js';

// @desc    Get all activities for a project
// @route   GET /api/activities/project/:id
// @access  Private
export const getProjectActivities = async (req, res) => {
  try {
    const activities = await Activity.find({ project: req.params.id })
      // Ensure profilePhoto is included for employee avatar rendering
      .populate('user', 'name role email profilePhoto')
      .sort({ timestamp: -1 });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard activities (Admin)
// @route   GET /api/activities
// @access  Private/Admin
export const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      // Ensure profilePhoto is included for employee avatar rendering
      .populate('user', 'name role email profilePhoto')
      .populate('project', 'name')
      .sort({ timestamp: -1 })
      .limit(20);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get my recent activities
// @route   GET /api/activities/my
// @access  Private
export const getMyActivities = async (req, res) => {
  try {
    let query = {};

    if (req.user.role !== 'Admin') {
      const projects = await Project.find({
        $or: [{ developers: req.user._id }, { testers: req.user._id }, { createdBy: req.user._id }],
      }).select('_id');

      const projectIds = projects.map(p => p._id);
      query = { project: { $in: projectIds } };
    }

    const activities = await Activity.find(query)
      // Ensure profilePhoto is included for employee avatar rendering
      .populate('user', 'name profilePhoto')
      .populate('project', 'name')
      .sort({ timestamp: -1 })
      .limit(req.user.role === 'Admin' ? 20 : 10);
      
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
