const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const WordFile = require('../models/WordFile');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/wordfiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.ms-word.document.macroEnabled.12'
    ];
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.toLowerCase().endsWith('.docx') ||
        file.originalname.toLowerCase().endsWith('.doc')) {
      cb(null, true);
    } else {
      cb(new Error('Only Word documents (.doc, .docx) are allowed'));
    }
  }
});

// Upload Word file
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    const { patientId, patientName } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!patientId || !patientName) {
      // Delete uploaded file if validation fails
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Patient ID and Patient Name are required' });
    }
    
    const user = await User.findById(req.user._id);
    
    const wordFile = await WordFile.create({
      fileName: req.file.filename,
      originalFileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      patientId: patientId.trim(),
      patientName: patientName.trim(),
      uploadedBy: req.user._id,
      uploadedByName: user.name
    });
    
    res.status(201).json({
      success: true,
      wordFile: {
        id: wordFile._id,
        fileName: wordFile.fileName,
        originalFileName: wordFile.originalFileName,
        fileSize: wordFile.fileSize,
        patientId: wordFile.patientId,
        patientName: wordFile.patientName,
        uploadedByName: wordFile.uploadedByName,
        uploadStatus: wordFile.uploadStatus,
        uploadedAt: wordFile.uploadedAt
      }
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Word file upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all Word files
router.get('/', protect, async (req, res) => {
  try {
    const wordFiles = await WordFile.find()
      .sort({ uploadedAt: -1 })
      .select('-filePath')
      .lean();
    
    res.json({
      success: true,
      wordFiles: wordFiles.map(file => ({
        id: file._id,
        fileName: file.fileName,
        originalFileName: file.originalFileName,
        fileSize: file.fileSize,
        patientId: file.patientId,
        patientName: file.patientName,
        uploadedByName: file.uploadedByName,
        uploadStatus: file.uploadStatus,
        uploadedAt: file.uploadedAt
      }))
    });
  } catch (error) {
    console.error('Get word files error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single Word file
router.get('/:id', protect, async (req, res) => {
  try {
    const wordFile = await WordFile.findById(req.params.id);
    
    if (!wordFile) {
      return res.status(404).json({ error: 'Word file not found' });
    }
    
    res.json({
      success: true,
      wordFile: {
        id: wordFile._id,
        fileName: wordFile.fileName,
        originalFileName: wordFile.originalFileName,
        fileSize: wordFile.fileSize,
        patientId: wordFile.patientId,
        patientName: wordFile.patientName,
        uploadedByName: wordFile.uploadedByName,
        uploadStatus: wordFile.uploadStatus,
        uploadedAt: wordFile.uploadedAt
      }
    });
  } catch (error) {
    console.error('Get word file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download/View Word file
router.get('/:id/download', protect, async (req, res) => {
  try {
    const wordFile = await WordFile.findById(req.params.id);
    
    if (!wordFile) {
      return res.status(404).json({ error: 'Word file not found' });
    }
    
    if (!fs.existsSync(wordFile.filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    res.setHeader('Content-Type', wordFile.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(wordFile.originalFileName)}"`);
    res.sendFile(path.resolve(wordFile.filePath));
  } catch (error) {
    console.error('Download word file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete Word file
router.delete('/:id', protect, async (req, res) => {
  try {
    const wordFile = await WordFile.findById(req.params.id);
    
    if (!wordFile) {
      return res.status(404).json({ error: 'Word file not found' });
    }
    
    // Delete file from filesystem
    if (fs.existsSync(wordFile.filePath)) {
      fs.unlinkSync(wordFile.filePath);
    }
    
    // Delete from database
    await WordFile.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Word file deleted successfully'
    });
  } catch (error) {
    console.error('Delete word file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
