import express from 'express';
import { loginUser, getUserProfile, registerUser } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/register', protect, authorize('Admin'), registerUser);

export default router;
