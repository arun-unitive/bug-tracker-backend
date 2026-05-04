import mongoose from 'mongoose';

const milestoneSchema = new mongoose.Schema({
  title: String,
  description: String,
  dueDate: Date,
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending',
  }
});

const todoSchema = new mongoose.Schema({
  task: String,
  completed: {
    type: Boolean,
    default: false,
  }
});

const menuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});

const applicationTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  menus: [menuSchema],
});

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['file', 'link'],
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a project name'],
    unique: true,
  },
  // Optional project avatar/logo shown in the UI
  projectPhoto: {
    type: String,
  },
  description: {
    type: String,
    required: [true, 'Please provide a project description'],
  },
  startDate: Date,
  endDate: Date,
  milestones: [milestoneSchema],
  todos: [todoSchema],
  applicationTypes: [applicationTypeSchema],
  documents: [documentSchema],
  developers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  testers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['Planning', 'Active', 'Completed', 'On Hold'],
    default: 'Planning',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

const Project = mongoose.model('Project', projectSchema);

export default Project;
