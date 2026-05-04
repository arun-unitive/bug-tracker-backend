import express from 'express';
import { getProjectActivities, getAllActivities, getMyActivities } from '../controllers/activityController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/my', protect, getMyActivities);
router.get('/project/:id', protect, getProjectActivities);
router.get('/', protect, authorize('Admin'), getAllActivities);

export default router;
