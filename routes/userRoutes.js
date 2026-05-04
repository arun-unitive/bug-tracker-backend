import express from 'express';
import { getAllUsers, deleteUser, getUserById, updateUser } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('Admin'), getAllUsers);
router.get('/:id', protect, authorize('Admin'), getUserById);
router.put('/:id', protect, authorize('Admin'), updateUser);
router.delete('/:id', protect, authorize('Admin'), deleteUser);

export default router;
