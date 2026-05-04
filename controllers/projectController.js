import Project from '../models/Project.js';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import fs from 'fs';
import path from 'path';

// @desc    Get all projects (Admin)
// @route   GET /api/projects
// @access  Private/Admin
export const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      // Include profilePhoto for employee avatar rendering across project/member views
      .populate('developers testers createdBy', 'name email role profilePhoto');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get assigned projects
// @route   GET /api/projects/my
// @access  Private
export const getMyProjects = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'Developer') {
      query = { developers: req.user._id };
    } else if (req.user.role === 'Tester') {
      query = { testers: req.user._id };
    } else if (req.user.role === 'Admin') {
      return getAllProjects(req, res);
    }

    const projects = await Project.find(query)
      .populate('developers testers createdBy', 'name email role profilePhoto');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create project (Admin)
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = async (req, res) => {
  const { name, description, startDate, endDate, milestones, todos, developers, testers, projectPhoto, applicationTypes } = req.body;

  try {
    const project = await Project.create({
      name,
      description,
      startDate,
      endDate,
      milestones,
      todos,
      applicationTypes,
      developers,
      testers,
      createdBy: req.user._id,
      projectPhoto: projectPhoto || undefined,
    });

    if (project) {
      // Create activity log
      await Activity.create({
        user: req.user._id,
        project: project._id,
        action: 'Project Created',
        details: `Project ${name} was created by ${req.user.name}`,
      });

      // Update user assignedProjects
      const allMembers = [...developers, ...testers];
      await User.updateMany(
        { _id: { $in: allMembers } },
        { $addToSet: { assignedProjects: project._id } }
      );

      res.status(201).json(project);
    } else {
      res.status(400).json({ message: 'Invalid project data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update project (Admin)
// @route   PUT /api/projects/:id
// @access  Private/Admin
export const updateProject = async (req, res) => {
  const { name, description, startDate, endDate, milestones, todos, developers, testers, status, projectPhoto, applicationTypes } = req.body;

  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    project.name = name || project.name;
    project.description = description || project.description;
    project.startDate = startDate || project.startDate;
    project.endDate = endDate || project.endDate;
    project.milestones = milestones || project.milestones;
    project.todos = todos || project.todos;
    project.applicationTypes = applicationTypes || project.applicationTypes;
    project.developers = developers || project.developers;
    project.testers = testers || project.testers;
    project.status = status || project.status;
    if (projectPhoto !== undefined) {
      // Allow clearing the photo if explicitly sent as empty string.
      project.projectPhoto = projectPhoto || undefined;
    }

    const updatedProject = await project.save();

    // Create activity log
    await Activity.create({
      user: req.user._id,
      project: updatedProject._id,
      action: 'Project Updated',
      details: `Project ${updatedProject.name} was updated by ${req.user.name}`,
    });

    // Update user assignedProjects
    const allMembers = [...(developers || []), ...(testers || [])];
    if (allMembers.length > 0) {
      await User.updateMany(
        { _id: { $in: allMembers } },
        { $addToSet: { assignedProjects: updatedProject._id } }
      );
    }

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('developers testers createdBy', 'name email role profilePhoto');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // RBAC: Check if user is member of project or admin
    const isMember = project.developers.some(dev => dev._id.toString() === req.user._id.toString()) ||
                     project.testers.some(tester => tester._id.toString() === req.user._id.toString()) ||
                     req.user.role === 'Admin';

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add document to project
// @route   POST /api/projects/:id/documents
// @access  Private/Admin
export const addProjectDocument = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied - Only admins can add documents' });
    }

    const { id } = req.params;
    const { name, type, url } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const newDocument = {
      name,
      type,
      url: req.file ? `/uploads/${req.file.filename}` : url,
      uploadedBy: req.user._id,
    };

    project.documents.push(newDocument);
    await project.save();

    await Activity.create({
      user: req.user._id,
      project: id,
      action: 'Document Added',
      details: `Document "${name}" was added to project ${project.name} by ${req.user.name}`,
    });

    res.status(201).json(project.documents[project.documents.length - 1]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete document from project
// @route   DELETE /api/projects/:id/documents/:docId
// @access  Private/Admin
export const deleteProjectDocument = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied - Only admins can delete documents' });
    }

    const { id, docId } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const document = project.documents.id(docId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // If it's a file, delete it from the uploads folder
    if (document.type === 'file' && document.url) {
      const filePath = path.join(process.cwd(), document.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove the document from the project
    project.documents.pull(docId);
    await project.save();

    await Activity.create({
      user: req.user._id,
      project: id,
      action: 'Document Deleted',
      details: `Document "${document.name}" was removed from project ${project.name} by ${req.user.name}`,
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
