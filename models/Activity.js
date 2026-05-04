import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  action: {
    type: String, // E.g., 'Bug Created', 'Status Updated', 'Member Added'
    required: true,
  },
  details: {
    type: String,
    required: true,
  },
  bug: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bug',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
