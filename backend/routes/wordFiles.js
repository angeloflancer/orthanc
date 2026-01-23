const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const WordFile = require('../models/WordFile');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const { protect } = require('../middleware/auth');

// Get upload directory from environment variable or use default
const uploadsDir = process.env.WORD_FILES_UPLOAD_PATH 
  ? path.resolve(process.env.WORD_FILES_UPLOAD_PATH)
  : path.join(__dirname, '../uploads/wordfiles');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log('Word files upload directory:', uploadsDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Preserve file extension (handles UTF-8 filenames correctly)
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
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
    
    // Fix Arabic filename encoding issue
    // Multer may receive filename incorrectly encoded. We need to properly decode it.
    let originalFileName = req.file.originalname;
    
    try {
      // Method 1: Check if filename is incorrectly encoded (latin1 instead of utf8)
      // This happens when UTF-8 bytes are interpreted as latin1
      const decodedFromLatin1 = Buffer.from(originalFileName, 'latin1').toString('utf8');
      
      // Check if decoded version is different and doesn't contain replacement characters
      if (decodedFromLatin1 !== originalFileName && !decodedFromLatin1.includes('\uFFFD')) {
        // Validate: decoded string should have valid UTF-8 characters
        // Check if it contains Arabic characters (common range)
        const hasArabicChars = /[\u0600-\u06FF]/.test(decodedFromLatin1);
        const hasValidChars = /^[\u0000-\uFFFF]*$/.test(decodedFromLatin1);
        
        if (hasValidChars && (hasArabicChars || decodedFromLatin1.length > 0)) {
          originalFileName = decodedFromLatin1;
        }
      }
      
      // Method 2: Check Content-Disposition header for properly encoded filename
      // Modern browsers send filename*=UTF-8''encoded-name
      const contentDisposition = req.headers['content-disposition'] || '';
      
      // Look for RFC 5987 encoded filename (filename*=UTF-8''...)
      const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
      if (utf8FilenameMatch) {
        try {
          const decoded = decodeURIComponent(utf8FilenameMatch[1]);
          if (decoded && decoded.length > 0) {
            originalFileName = decoded;
          }
        } catch (e) {
          // If URI decoding fails, continue with other methods
        }
      }
      
      // Method 3: Check for quoted filename in Content-Disposition
      const quotedMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (quotedMatch) {
        const quotedName = quotedMatch[1];
        // Use quoted name if it's different and doesn't look corrupted
        if (quotedName !== originalFileName && !/[ÃÂ]/.test(quotedName)) {
          originalFileName = quotedName;
        }
      }
    } catch (e) {
      // If all decoding attempts fail, use original name
      console.warn('Filename encoding fix failed, using original:', e.message);
    }
    
    const wordFile = await WordFile.create({
      fileName: req.file.filename,
      originalFileName: originalFileName,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      patientId: patientId.trim(),
      patientName: patientName.trim(),
      uploadedBy: req.user._id,
      uploadedByName: user.name
    });
    
    // Update or create patient record
    let patient = await Patient.findOne({ patientId: patientId.trim() });
    if (!patient) {
      patient = await Patient.create({
        patientId: patientId.trim(),
        patientName: patientName.trim(),
        dicomStudyCount: 0,
        wordFileCount: 1
      });
    } else {
      patient.wordFileCount += 1;
      // Update patient name if not set
      if (!patient.patientName && patientName) {
        patient.patientName = patientName.trim();
      }
      await patient.save();
    }
    
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

// Helper function to get allowed user IDs for word files based on role
async function getAllowedWordFileUserIds(user) {
  if (!user) return [];
  
  if (user.role === 'owner') {
    // Owner can access all documents - return null to indicate no filtering
    return null;
  }
  
  if (user.role === 'admin') {
    // Admin can access their own documents + all accepted hospital members' documents
    const hospital = await Hospital.findOne({ admin: user._id });
    
    if (!hospital) {
      // Admin without hospital can only see their own documents
      return [user._id];
    }
    
    // Get all accepted members of the hospital
    const members = await HospitalMember.find({ 
      hospital: hospital._id,
      status: 'accepted'
    }).select('user');
    
    const memberIds = members.map(m => m.user);
    // Include admin's own ID
    if (!memberIds.some(id => id.equals(user._id))) {
      memberIds.push(user._id);
    }
    
    return memberIds;
  }
  
  // Doctor can only access their own documents
  return [user._id];
}

// Get all Word files
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get allowed user IDs based on role
    const allowedUserIds = await getAllowedWordFileUserIds(user);
    
    // Build query based on allowed user IDs
    let query = {};
    if (allowedUserIds !== null) {
      // Filter by allowed user IDs
      query.uploadedBy = { $in: allowedUserIds };
    }
    // If allowedUserIds is null (owner), query remains empty (all documents)
    
    const wordFiles = await WordFile.find(query)
      .sort({ uploadedAt: -1 })
      .select('-filePath')
      .populate('uploadedBy', 'name role')
      .lean();
    
    // Helper function to get hospital name for a user
    const getHospitalNameForUser = async (user) => {
      if (!user) return '';
      
      try {
        if (user.role === 'admin') {
          const hospital = await Hospital.findOne({ admin: user._id });
          return hospital ? hospital.name : '';
        } else if (user.role === 'doctor') {
          const member = await HospitalMember.findOne({ user: user._id, status: 'accepted' })
            .populate('hospital');
          return member && member.hospital ? member.hospital.name : '';
        }
        return '';
      } catch (err) {
        console.error(`Error getting hospital name for user ${user._id}:`, err.message);
        return '';
      }
    };
    
    // Enrich word files with hospital name
    const enrichedWordFiles = await Promise.all(wordFiles.map(async (file) => {
      const hospitalName = file.uploadedBy ? await getHospitalNameForUser(file.uploadedBy) : '';
      return {
        id: file._id,
        fileName: file.fileName,
        originalFileName: file.originalFileName,
        fileSize: file.fileSize,
        patientId: file.patientId,
        patientName: file.patientName,
        hospitalName: hospitalName,
        uploadedByName: file.uploadedByName,
        uploadStatus: file.uploadStatus,
        uploadedAt: file.uploadedAt
      };
    }));
    
    res.json({
      success: true,
      wordFiles: enrichedWordFiles
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
    
    // Check if user has permission to access this file
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const allowedUserIds = await getAllowedWordFileUserIds(user);
    
    // Check permission
    if (allowedUserIds !== null && !allowedUserIds.some(id => id.equals(wordFile.uploadedBy))) {
      return res.status(403).json({ error: 'Access denied' });
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
    
    // Check if user has permission to access this file
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const allowedUserIds = await getAllowedWordFileUserIds(user);
    
    // Check permission
    if (allowedUserIds !== null && !allowedUserIds.some(id => id.equals(wordFile.uploadedBy))) {
      return res.status(403).json({ error: 'Access denied' });
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
    
    // Check if user has permission to delete this file
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const allowedUserIds = await getAllowedWordFileUserIds(user);
    
    // Check permission
    if (allowedUserIds !== null && !allowedUserIds.some(id => id.equals(wordFile.uploadedBy))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete file from filesystem
    if (fs.existsSync(wordFile.filePath)) {
      fs.unlinkSync(wordFile.filePath);
    }
    
    // Decrement patient word file count
    const patient = await Patient.findOne({ patientId: wordFile.patientId });
    if (patient) {
      patient.wordFileCount = Math.max(0, patient.wordFileCount - 1);
      await patient.save();
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
