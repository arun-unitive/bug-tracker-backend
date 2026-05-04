import express from 'express';
import xlsx from 'xlsx';
import { getProjectBugs, createBug, updateBugStatus, updateBug, addBugComment, getBugById, getBugStats, getMyBugs, bulkUploadBugs, getAllBugs, deleteBug } from '../controllers/bugController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

router.get('/', protect, authorize('Admin'), getAllBugs);
router.get('/stats', protect, authorize('Admin'), getBugStats);
router.get('/my', protect, getMyBugs);
router.get('/project/:id', protect, getProjectBugs);
router.get('/:id', protect, getBugById);
router.get('/template/download', protect, authorize('Tester', 'Admin'), (req, res) => {
  const data = [
    {
      'Application Type': 'Mobile App',
      'Menu': 'Dashboard',
      'Priority': 'Medium',
      'Title': 'Example Bug Title',
      'Description': 'Detailed description of the bug and steps to reproduce',
      'Assigned Developer': 'john.doe@example.com'
    }
  ];
  
  const worksheet = xlsx.utils.json_to_sheet(data);
  
  // Make headers bold
  const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[xlsx.utils.encode_cell({ c: C, r: 0 })];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }
  
  // Add data validation for priority column (column C)
  worksheet['!dataValidations'] = {};
  
  // Apply data validation to all rows in column C (priority)
  for (let r = 2; r <= 1000; r++) {
    const cellRef = `C${r}`;
    worksheet['!dataValidations'][cellRef] = {
      type: 'list',
      allowBlank: false,
      formula1: '"Low,Medium,High,Critical"',
      showDropDown: true
    };
  }
  
  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 30 }, // Title
    { wch: 60 }, // Description
    { wch: 15 }, // Priority
    { wch: 25 }, // ApplicationType
    { wch: 25 }, // Menu
    { wch: 30 }  // AssignedDeveloper
  ];
  
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Bugs');
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=bug_upload_template.xlsx');
  
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.send(buffer);
});
router.post('/', protect, authorize('Tester', 'Admin'), createBug);
router.post('/bulk', protect, authorize('Tester', 'Admin'), upload.single('file'), bulkUploadBugs);
router.put('/:id/status', protect, updateBugStatus);
router.put('/:id', protect, updateBug);
router.delete('/:id', protect, deleteBug);
router.post('/:id/comment', protect, addBugComment);

// Evidence upload route
router.post('/upload', protect, upload.single('evidence'), (req, res) => {
  if (req.file) {
    res.json({
      message: 'File uploaded successfully',
      filePath: `/uploads/${req.file.filename}`,
    });
  } else {
    res.status(400).json({ message: 'No file uploaded' });
  }
});

export default router;
