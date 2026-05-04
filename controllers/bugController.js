import Bug from '../models/Bug.js';
import Activity from '../models/Activity.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

// @desc    Get all bugs for a project
// @route   GET /api/bugs/project/:id
// @access  Private
export const getProjectBugs = async (req, res) => {
  try {
    // Admin can access any project's bugs
    if (req.user.role !== 'Admin') {
      // Check if user is a member of the project (for non-admin)
      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      const isMember = 
        project.developers.some(d => d.toString() === req.user._id.toString()) || 
        project.testers.some(t => t.toString() === req.user._id.toString());
      if (!isMember) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    const bugs = await Bug.find({ project: req.params.id })
      // Ensure profilePhoto is included for employee avatar rendering in the UI
      .populate('createdBy assignedTo', 'name email role profilePhoto')
      .populate('project', 'name');
    res.json(bugs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all bugs (Admin)
// @route   GET /api/bugs
// @access  Private/Admin
export const getAllBugs = async (req, res) => {
  try {
    const bugs = await Bug.find()
      .populate('createdBy assignedTo resolvedBy', 'name email role profilePhoto')
      .populate('project', 'name')
      .sort({ createdAt: -1 });
    res.json(bugs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create bug (Tester)
// @route   POST /api/bugs
// @access  Private/Tester/Admin
export const createBug = async (req, res) => {
  const { title, description, evidence, priority, project, assignedTo, applicationType, menu } = req.body;

  try {
    const bug = await Bug.create({
      title,
      description,
      evidence,
      priority,
      project,
      applicationType,
      menu,
      createdBy: req.user._id,
      assignedTo: assignedTo && assignedTo.trim() ? assignedTo : undefined,
    });

    if (bug) {
      // Create activity log
      await Activity.create({
        user: req.user._id,
        project,
        bug: bug._id,
        action: 'Bug Created',
        details: `Bug "${title}" was created by ${req.user.name}`,
      });

      res.status(201).json(bug);
    } else {
      res.status(400).json({ message: 'Invalid bug data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update bug (Tester/Admin)
// @route   PUT /api/bugs/:id
// @access  Private/Tester/Admin
export const updateBug = async (req, res) => {
  const { title, description, evidence, priority, project, assignedTo, applicationType, menu } = req.body;

  try {
    const bug = await Bug.findById(req.params.id);

    if (!bug) {
      return res.status(404).json({ message: 'Bug not found' });
    }

    // Authorization: testers can only edit their own created bugs.
    if (req.user.role === 'Tester') {
      const createdById = bug.createdBy?._id ? bug.createdBy._id : bug.createdBy;
      if (createdById.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update editable fields (status is controlled separately).
    bug.title = title ?? bug.title;
    bug.description = description ?? bug.description;
    bug.evidence = evidence ?? bug.evidence;
    bug.priority = priority ?? bug.priority;
    bug.project = project ?? bug.project;
    bug.assignedTo = assignedTo && assignedTo.trim() ? assignedTo : undefined;
    bug.applicationType = applicationType ?? bug.applicationType;
    bug.menu = menu ?? bug.menu;

    await bug.save();

    // Create activity log
    await Activity.create({
      user: req.user._id,
      project: bug.project,
      bug: bug._id,
      action: 'Bug Updated',
      details: `Bug "${bug.title}" was updated by ${req.user.name}`,
    });

    res.json(bug);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bugs for the current user (developer: assigned, tester: reported)
// @route   GET /api/bugs/my
// @access  Private
export const getMyBugs = async (req, res) => {
  try {
    // Developers see bugs assigned to them OR unassigned bugs in their projects
    // Testers see bugs they created.
    // Admin can see all bugs.
    let query = {};
    if (req.user.role === 'Admin') {
      // Admin sees everything
      query = {};
    } else if (req.user.role === 'Developer') {
      // Get all projects the developer is part of
      const Project = (await import('../models/Project.js')).default;
      const devProjects = await Project.find({ developers: req.user._id }, '_id');
      const projectIds = devProjects.map(p => p._id);
      // Bugs that are either assigned to them OR unassigned and in their projects
      query = {
        $or: [
          { assignedTo: req.user._id },
          { project: { $in: projectIds }, assignedTo: { $exists: false } },
          { project: { $in: projectIds }, assignedTo: null }
        ]
      };
    } else if (req.user.role === 'Tester') {
      query = { createdBy: req.user._id };
    }

    const bugs = await Bug.find(query)
      // Ensure profilePhoto is included for employee avatar rendering
      .populate('createdBy assignedTo resolvedBy', 'name email role profilePhoto')
      .populate('project', 'name')
      .sort({ createdAt: -1 });
    res.json(bugs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bug by ID
// @route   GET /api/bugs/:id
// @access  Private
export const getBugById = async (req, res) => {
  try {
    const bug = await Bug.findById(req.params.id)
      // Ensure profilePhoto is included for employee avatar rendering
      .populate('createdBy assignedTo resolvedBy', 'name email role profilePhoto')
      .populate('project', 'name')
      .populate('comments.user', 'name role email profilePhoto');

    if (!bug) {
      return res.status(404).json({ message: 'Bug not found' });
    }

    // Role-based access:
    // - Developers can view bugs assigned to them OR unassigned bugs in their projects
    // - Testers can only view bugs they reported/created
    // - Admin can view all
    const createdById = bug.createdBy?._id ? bug.createdBy._id : bug.createdBy;
    const assignedToId = bug.assignedTo?._id ? bug.assignedTo._id : bug.assignedTo;

    if (req.user.role === 'Developer') {
      // Check if dev is assigned OR bug is unassigned and dev is in project
      const isAssigned = assignedToId && assignedToId.toString() === req.user._id.toString();
      const isUnassignedInProject = !assignedToId;
      // Check if dev is in project
      const Project = (await import('../models/Project.js')).default;
      const project = await Project.findById(bug.project._id || bug.project);
      const isInProject = project?.developers?.some(d => d.toString() === req.user._id.toString());
      
      if (!isAssigned && !(isUnassignedInProject && isInProject)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'Tester') {
      if (!createdById || createdById.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(bug);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get bug statistics (Admin)
// @route   GET /api/bugs/stats
// @access  Private/Admin
export const getBugStats = async (req, res) => {
  try {
    const totalBugs = await Bug.countDocuments();
    const openBugs = await Bug.countDocuments({ status: 'Open' });
    const inProgressBugs = await Bug.countDocuments({ status: 'In Progress' });
    const resolvedBugs = await Bug.countDocuments({ status: 'Resolved' });
    const closedBugs = await Bug.countDocuments({ status: 'Closed' });
    
    const criticalBugs = await Bug.countDocuments({ priority: 'Critical' });
    const highBugs = await Bug.countDocuments({ priority: 'High' });

    res.json({
      total: totalBugs,
      open: openBugs,
      inProgress: inProgressBugs,
      resolved: resolvedBugs,
      closed: closedBugs,
      active: openBugs + inProgressBugs,
      critical: criticalBugs,
      high: highBugs
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update bug status
// @route   PUT /api/bugs/:id/status
// @access  Private
export const updateBugStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const bug = await Bug.findById(req.params.id);

    if (!bug) {
      return res.status(404).json({ message: 'Bug not found' });
    }

    const role = req.user.role;
    const createdById = bug.createdBy?._id ? bug.createdBy._id : bug.createdBy;
    const assignedToId = bug.assignedTo?._id ? bug.assignedTo._id : bug.assignedTo;

    // Role rules:
    // - Developer: can set status to `In Progress` or `Resolved` (assigned bugs OR unassigned bugs in their projects)
    // - Tester: can set status to `Closed` (their reported/created bugs only, and only when resolved)
    // - Admin: can update any status
    if (role === 'Developer') {
      // Check if dev is assigned OR bug is unassigned and dev is in project
      const isAssigned = assignedToId && assignedToId.toString() === req.user._id.toString();
      const isUnassignedInProject = !assignedToId;
      // Check if dev is in project
      const Project = (await import('../models/Project.js')).default;
      const project = await Project.findById(bug.project._id || bug.project);
      const isInProject = project?.developers?.some(d => d.toString() === req.user._id.toString());
      
      if (!isAssigned && !(isUnassignedInProject && isInProject)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // Prevent reopening/updates after the bug is closed.
      if (bug.status === 'Closed') {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (status === 'Open' || status === 'Closed') {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (status !== 'In Progress' && status !== 'Resolved') {
        return res.status(403).json({ message: 'Invalid status transition' });
      }
    } else if (role === 'Tester') {
      if (!createdById || createdById.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (status !== 'Closed') {
        return res.status(403).json({ message: 'Only Testers can close bugs' });
      }
      // Only allow closing after it is resolved.
      if (bug.status !== 'Resolved' && bug.status !== 'Closed') {
        return res.status(403).json({ message: 'Bug must be resolved before closing' });
      }
    } else if (role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldStatus = bug.status;
    bug.status = status;

    // Only set `resolvedBy/resolvedAt` when transitioning to `Resolved`.
    // When a Tester closes the bug, we should keep the original developer info.
    if (status === 'Resolved' && oldStatus !== 'Resolved') {
      bug.resolvedBy = req.user._id;
      bug.resolvedAt = Date.now();
    } else if (status !== 'Resolved') {
      // If status is neither Resolved nor anything else, clear.
      // (We intentionally do NOT clear on Closed to preserve resolved-by info.)
      if (status !== 'Closed') {
        bug.resolvedBy = undefined;
        bug.resolvedAt = undefined;
      }
    }

    await bug.save();

    // Create activity log
    await Activity.create({
      user: req.user._id,
      project: bug.project,
      bug: bug._id,
      action: 'Status Updated',
      details: `Bug status updated from ${oldStatus} to ${status} by ${req.user.name}`,
    });

    res.json(bug);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add comment to bug
// @route   POST /api/bugs/:id/comment
// @access  Private
export const addBugComment = async (req, res) => {
  const { text, attachment } = req.body;

  try {
    const bug = await Bug.findById(req.params.id);

    if (!bug) {
      return res.status(404).json({ message: 'Bug not found' });
    }

    const comment = {
      user: req.user._id,
      text,
      attachment,
    };

    bug.comments.push(comment);
    await bug.save();

    // Create activity log
    await Activity.create({
      user: req.user._id,
      project: bug.project,
      bug: bug._id,
      action: 'Comment Added',
      details: `${req.user.name} commented on bug: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    });

    res.json(bug);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk upload bugs from Excel
// @route   POST /api/bugs/bulk
// @access  Private/Tester/Admin
export const bulkUploadBugs = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const { project } = req.body;

    if (!project) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Project ID is required' });
    }

    // Fetch project and populate developers
    const projectData = await Project.findById(project).populate('developers', '_id name email');
    if (!projectData) {
      fs.unlinkSync(filePath);
      return res.status(404).json({ message: 'Project not found' });
    }

    const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
    const errors = [];
    const bugs = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel rows start at 1, header is 1, data starts at 2

      // Validate required fields - check both lowercase, TitleCase, and spaced names
      const title = row.title || row.Title || row.BugTitle || row['Title'];
      const description = row.description || row.Description || row['Description'];
      const priority = (row.priority || row.Priority || row['Priority'] || 'Medium').toString().trim();
      const applicationType = row.applicationType || row.ApplicationType || row['Application Type'];
      const menu = row.menu || row.Menu || row['Menu'];
      const assignedDeveloperStr = (row.assignedDeveloper || row.AssignedDeveloper || row['Assigned Developer'] || '').toString().trim();

      if (!title) {
        errors.push(`Row ${rowNumber}: Title is required`);
        continue;
      }

      // Validate priority
      if (!validPriorities.includes(priority)) {
        errors.push(`Row ${rowNumber}: Invalid priority "${priority}". Valid values are: ${validPriorities.join(', ')}`);
        continue;
      }

      // Find assigned developer
      let assignedTo = undefined;
      if (assignedDeveloperStr) {
        // Try to match by email or name
        const dev = projectData.developers?.find(
          (d) => 
            d.email.toLowerCase() === assignedDeveloperStr.toLowerCase() || 
            d.name.toLowerCase() === assignedDeveloperStr.toLowerCase()
        );
        if (dev) {
          assignedTo = dev._id;
        } else {
          errors.push(`Row ${rowNumber}: Assigned Developer "${assignedDeveloperStr}" not found in project developers`);
        }
      }

      // Create the bug
      const bug = await Bug.create({
        title,
        description,
        priority,
        project,
        applicationType,
        menu,
        assignedTo,
        createdBy: req.user._id,
      });
      bugs.push(bug);

      await Activity.create({
        user: req.user._id,
        project,
        bug: bug._id,
        action: 'Bug Created',
        details: `Bug "${bug.title}" was created by ${req.user.name} (bulk upload)`,
      });
    }

    fs.unlinkSync(filePath);

    if (errors.length > 0) {
      return res.status(400).json({ 
        message: 'Some rows failed validation', 
        errors,
        uploadedCount: bugs.length,
        bugs
      });
    }

    res.status(201).json({ message: 'Bugs uploaded successfully', count: bugs.length, bugs });
  } catch (error) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete bug
// @route   DELETE /api/bugs/:id
// @access  Private/Tester/Admin
export const deleteBug = async (req, res) => {
  try {
    const bug = await Bug.findById(req.params.id);
    
    if (!bug) {
      return res.status(404).json({ message: 'Bug not found' });
    }

    // Authorization: testers can only delete their own created bugs, admins can delete any
    if (req.user.role === 'Tester') {
      const createdById = bug.createdBy?._id ? bug.createdBy._id : bug.createdBy;
      if (createdById.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete evidence file if exists
    if (bug.evidence) {
      const evidencePath = path.join(process.cwd(), bug.evidence);
      if (fs.existsSync(evidencePath)) {
        fs.unlinkSync(evidencePath);
      }
    }

    // Delete the bug
    await Bug.findByIdAndDelete(req.params.id);

    // Delete related activities
    await Activity.deleteMany({ bug: req.params.id });

    res.json({ message: 'Bug deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
