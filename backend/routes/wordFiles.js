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
const { checkFeatureAccess } = require('../middleware/accessControl');

/** Get request user: for owner use req.user (not in DB); for others load from DB. */
async function getRequestUser(req) {
  if (req.user.role === 'owner') return req.user;
  return User.findById(req.user._id).select('-password');
}

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
router.post('/upload', protect, checkFeatureAccess(), upload.single('file'), async (req, res) => {
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
    
    // Get user info first (owner is not in DB)
    const user = await getRequestUser(req);
    if (!user) {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(401).json({ error: 'User not found' });
    }

    // Get hospital from middleware (set by checkFeatureAccess)
    // Owners don't have a hospital but can still upload
    const hospital = req.hospital;
    if (!hospital && user.role !== 'owner') {
      // Delete uploaded file if no hospital (except for owners)
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'Hospital not found. You must be a member of a hospital to upload data.' });
    }
    
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
      hospital: hospital ? hospital._id : null, // Allow null for owners
      uploadedBy: req.user._id || undefined,
      uploadedByName: user.name || req.user.name
    });
    
    // Check if patient already exists by patientId (one patient ID = one patient record)
    // If exists, use the existing patient; if not, create a new one
    let patient = await Patient.findOne({ patientId: patientId.trim() });
    if (!patient) {
      // Create new patient record
      const patientHospital = hospital ? hospital._id : null;
      patient = await Patient.create({
        patientId: patientId.trim(),
        hospital: patientHospital, // null for owners
        patientName: patientName.trim(),
        dicomStudyCount: 0,
        wordFileCount: 1
      });
    } else {
      // Patient already exists - update counts and info, but don't create duplicate
      patient.wordFileCount += 1;
      // Update patient name if not set
      if (!patient.patientName && patientName) {
        patient.patientName = patientName.trim();
      }
      // Update hospital if patient doesn't have one and we have one
      if (!patient.hospital && hospital) {
        patient.hospital = hospital._id;
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

// Helper function to get user's hospital ID for filtering
// Returns null for owner (all access), hospital._id for admin/doctor, or null if no hospital
async function getUserHospitalId(user) {
  if (!user) return null;
  
  if (user.role === 'owner') {
    return null; // Owner can access all data
  }
  
  if (user.role === 'admin') {
    const hospital = await Hospital.findOne({ admin: user._id });
    return hospital ? hospital._id : null;
  }
  
  if (user.role === 'doctor') {
    const membership = await HospitalMember.findOne({ 
      user: user._id,
      status: 'accepted'
    });
    return membership ? membership.hospital : null;
  }
  
  return null;
}

// Get all Word files (paginated)
router.get('/', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // All roles can see all documents - no role filtering
    const query = {};

    if (req.query.fileName && req.query.fileName.trim()) {
      query.$or = [
        { fileName: { $regex: req.query.fileName.trim(), $options: 'i' } },
        { originalFileName: { $regex: req.query.fileName.trim(), $options: 'i' } }
      ];
    }
    if (req.query.patientId && req.query.patientId.trim()) {
      query.patientId = { $regex: req.query.patientId.trim(), $options: 'i' };
    }
    if (req.query.patientName && req.query.patientName.trim()) {
      query.patientName = { $regex: req.query.patientName.trim(), $options: 'i' };
    }
    if (req.query.uploadedBy && req.query.uploadedBy.trim()) {
      query.uploadedByName = { $regex: req.query.uploadedBy.trim(), $options: 'i' };
    }
    if (req.query.uploadedAtFrom || req.query.uploadedAtTo) {
      query.uploadedAt = {};
      if (req.query.uploadedAtFrom) query.uploadedAt.$gte = new Date(req.query.uploadedAtFrom);
      if (req.query.uploadedAtTo) query.uploadedAt.$lte = new Date(req.query.uploadedAtTo);
    }
    if (req.query.hospital && req.query.hospital.trim()) {
      const hospitals = await Hospital.find({ name: { $regex: req.query.hospital.trim(), $options: 'i' } }).select('_id').lean();
      const hospitalIds = hospitals.map(h => h._id);
      if (hospitalIds.length) query.hospital = { $in: hospitalIds };
      else query._id = { $in: [] }; // no hospital name match -> no results
    }

    const total = await WordFile.countDocuments(query);

    const wordFiles = await WordFile.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-filePath')
      .populate('hospital', 'name')
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
        hospitalName: file.hospital ? file.hospital.name : '',
        uploadedByName: file.uploadedByName,
        uploadStatus: file.uploadStatus,
        uploadedAt: file.uploadedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Get word files error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single Word file
router.get('/:id', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const wordFile = await WordFile.findById(req.params.id);
    
    if (!wordFile) {
      return res.status(404).json({ error: 'Word file not found' });
    }
    
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    // All roles (owner, admin, doctor) can access any file

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
router.get('/:id/download', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const wordFile = await WordFile.findById(req.params.id);

    if (!wordFile) {
      return res.status(404).json({ error: 'Word file not found' });
    }

    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    // All roles (owner, admin, doctor) can download any file
    
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
router.delete('/:id', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const wordFile = await WordFile.findById(req.params.id);

    if (!wordFile) {
      return res.status(404).json({ error: 'Word file not found' });
    }

    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    // Prevent doctors from deleting documents (admin and owner can delete any)
    if (user.role === 'doctor') {
      return res.status(403).json({ error: 'Doctors are not allowed to delete documents' });
    }
    // Owner and admin can delete any file
    
    // Delete file from filesystem
    if (fs.existsSync(wordFile.filePath)) {
      fs.unlinkSync(wordFile.filePath);
    }
    
    // Decrement patient word file count (hospital-specific, or null for owners)
    const patient = await Patient.findOne({ 
      patientId: wordFile.patientId, 
      hospital: wordFile.hospital || null 
    });
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