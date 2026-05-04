import express from 'express';
import { getAllProjects, getMyProjects, createProject, getProjectById, updateProject, addProjectDocument, deleteProjectDocument } from '../controllers/projectController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

router.get('/', protect, authorize('Admin'), getAllProjects);
router.get('/my', protect, getMyProjects);
router.post('/', protect, authorize('Admin'), createProject);
router.put('/:id', protect, authorize('Admin'), updateProject);
// Project photo/logo upload
router.post('/upload', protect, authorize('Admin'), upload.single('photo'), (req, res) => {
  if (req.file) {
    res.json({
      message: 'File uploaded successfully',
      filePath: `/uploads/${req.file.filename}`,
    });
  } else {
    res.status(400).json({ message: 'No file uploaded' });
  }
});
// Project documents
router.post('/:id/documents', protect, upload.single('file'), addProjectDocument);
router.delete('/:id/documents/:docId', protect, deleteProjectDocument);
router.get('/:id', protect, getProjectById);

export default router;
