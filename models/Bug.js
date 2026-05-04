import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  attachment: {
    type: String, // Store file/image URL/Path
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

const bugSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a bug title'],
    trim: true,
  },
  description: {
    type: String,
  },
  evidence: {
    type: String, // Store image/file URL/Path
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium',
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open',
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  applicationType: {
    type: String,
  },
  menu: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Tester
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Developer
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Developer who resolved the bug
  },
  resolvedAt: {
    type: Date,
  },
  comments: [commentSchema],
}, {
  timestamps: true,
});

const Bug = mongoose.model('Bug', bugSchema);

export default Bug;
