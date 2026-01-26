const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const DicomStudy = require('../models/DicomStudy');
const WordFile = require('../models/WordFile');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const { protect } = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/accessControl');

// Helper function to get allowed user IDs based on role (same as word files)
async function getAllowedUserIds(user) {
  if (!user) return [];
  
  if (user.role === 'owner') {
    // Owner can access all data - return null to indicate no filtering
    return null;
  }
  
  if (user.role === 'admin') {
    // Admin can access their own data + all accepted hospital members' data
    const hospital = await Hospital.findOne({ admin: user._id });
    
    if (!hospital) {
      // Admin without hospital can only see their own data
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
  
  // Doctor can only access their own data
  return [user._id];
}

// Get all patients
router.get('/', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get allowed user IDs based on role
    const allowedUserIds = await getAllowedUserIds(user);
    
    // Get all patients
    const allPatients = await Patient.find()
      .sort({ updatedAt: -1 })
      .lean();
    
    // Calculate role-based counts for each patient
    const patientsWithCounts = await Promise.all(
      allPatients.map(async (patient) => {
        // Calculate DICOM study count based on user role
        let dicomStudyQuery = { patientId: patient.patientId };
        if (allowedUserIds !== null) {
          dicomStudyQuery.uploadedBy = { $in: allowedUserIds };
        }
        const dicomStudyCount = await DicomStudy.countDocuments(dicomStudyQuery);
        
        // Calculate word file count based on user role
        let wordFileQuery = { patientId: patient.patientId };
        if (allowedUserIds !== null) {
          wordFileQuery.uploadedBy = { $in: allowedUserIds };
        }
        const wordFileCount = await WordFile.countDocuments(wordFileQuery);
        
        // Calculate last document upload date based on role (most recent word file)
        let lastDocumentUpload = null;
        if (wordFileCount > 0) {
          const lastWordFile = await WordFile.findOne(wordFileQuery)
            .sort({ uploadedAt: -1 })
            .select('uploadedAt')
            .lean();
          if (lastWordFile) {
            lastDocumentUpload = lastWordFile.uploadedAt;
          }
        }
        
        // Only include patients that have at least one study or file the user can access
        if (dicomStudyCount === 0 && wordFileCount === 0) {
          return null;
        }
        
        return {
          id: patient._id,
          patientId: patient.patientId,
          patientName: patient.patientName,
          patientBirthDate: patient.patientBirthDate,
          patientSex: patient.patientSex,
          otherPatientIds: patient.otherPatientIds,
          dicomStudyCount: dicomStudyCount,
          wordFileCount: wordFileCount,
          lastDocumentUpload: lastDocumentUpload,
          createdAt: patient.createdAt,
          updatedAt: patient.updatedAt
        };
      })
    );
    
    // Filter out null values (patients with no accessible data)
    const patients = patientsWithCounts.filter(p => p !== null);
    
    res.json({
      success: true,
      patients
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get patient by patientId (DICOM Patient ID) - must come before /:id
router.get('/by-patient-id/:patientId', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get allowed user IDs based on role
    const allowedUserIds = await getAllowedUserIds(user);
    
    // Calculate role-based counts
    let dicomStudyQuery = { patientId: patient.patientId };
    if (allowedUserIds !== null) {
      dicomStudyQuery.uploadedBy = { $in: allowedUserIds };
    }
    const dicomStudyCount = await DicomStudy.countDocuments(dicomStudyQuery);
    
    let wordFileQuery = { patientId: patient.patientId };
    if (allowedUserIds !== null) {
      wordFileQuery.uploadedBy = { $in: allowedUserIds };
    }
    const wordFileCount = await WordFile.countDocuments(wordFileQuery);
    
    // Calculate last document upload date based on role
    let lastDocumentUpload = null;
    if (wordFileCount > 0) {
      const lastWordFile = await WordFile.findOne(wordFileQuery)
        .sort({ uploadedAt: -1 })
        .select('uploadedAt')
        .lean();
      if (lastWordFile) {
        lastDocumentUpload = lastWordFile.uploadedAt;
      }
    }
    
    // Check if user has access to any data for this patient
    if (dicomStudyCount === 0 && wordFileCount === 0) {
      return res.status(403).json({ error: 'Access denied - no data available for this patient' });
    }
    
    res.json({
      success: true,
      patient: {
        id: patient._id,
        patientId: patient.patientId,
        patientName: patient.patientName,
        patientBirthDate: patient.patientBirthDate,
        patientSex: patient.patientSex,
        otherPatientIds: patient.otherPatientIds,
        dicomStudyCount: dicomStudyCount,
        wordFileCount: wordFileCount,
        lastDocumentUpload: lastDocumentUpload,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      }
    });
  } catch (error) {
    console.error('Get patient by ID error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get DICOM studies for a patient
router.get('/:patientId/dicom-studies', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get allowed user IDs based on role
    const allowedUserIds = await getAllowedUserIds(user);
    
    // Build query based on patient ID and allowed user IDs
    let query = { patientId: req.params.patientId };
    if (allowedUserIds !== null) {
      query.uploadedBy = { $in: allowedUserIds };
    }
    
    const studies = await DicomStudy.find(query)
      .sort({ uploadedAt: -1 })
      .lean();
    
    res.json({
      success: true,
      studies: studies.map(study => ({
        id: study._id,
        studyInstanceUid: study.studyInstanceUid,
        orthancStudyId: study.orthancStudyId,
        patientId: study.patientId,
        patientName: study.patientName,
        studyDate: study.studyDate,
        studyDescription: study.studyDescription,
        accessionNumber: study.accessionNumber,
        modalitiesInStudy: study.modalitiesInStudy,
        seriesCount: study.seriesCount,
        instancesCount: study.instancesCount,
        uploadedByName: study.uploadedByName,
        uploadedAt: study.uploadedAt
      }))
    });
  } catch (error) {
    console.error('Get patient DICOM studies error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Word files for a patient - must come before /:id
router.get('/:patientId/word-files', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get allowed user IDs based on role
    const allowedUserIds = await getAllowedUserIds(user);
    
    // Build query based on patient ID and allowed user IDs
    let query = { patientId: req.params.patientId };
    if (allowedUserIds !== null) {
      query.uploadedBy = { $in: allowedUserIds };
    }
    
    const wordFiles = await WordFile.find(query)
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
        uploadedAt: file.uploadedAt
      }))
    });
  } catch (error) {
    console.error('Get patient Word files error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single patient by MongoDB ID - must be last to avoid route conflicts
router.get('/:id', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get allowed user IDs based on role
    const allowedUserIds = await getAllowedUserIds(user);
    
    // Calculate role-based counts
    let dicomStudyQuery = { patientId: patient.patientId };
    if (allowedUserIds !== null) {
      dicomStudyQuery.uploadedBy = { $in: allowedUserIds };
    }
    const dicomStudyCount = await DicomStudy.countDocuments(dicomStudyQuery);
    
    let wordFileQuery = { patientId: patient.patientId };
    if (allowedUserIds !== null) {
      wordFileQuery.uploadedBy = { $in: allowedUserIds };
    }
    const wordFileCount = await WordFile.countDocuments(wordFileQuery);
    
    // Calculate last document upload date based on role
    let lastDocumentUpload = null;
    if (wordFileCount > 0) {
      const lastWordFile = await WordFile.findOne(wordFileQuery)
        .sort({ uploadedAt: -1 })
        .select('uploadedAt')
        .lean();
      if (lastWordFile) {
        lastDocumentUpload = lastWordFile.uploadedAt;
      }
    }
    
    // Check if user has access to any data for this patient
    if (dicomStudyCount === 0 && wordFileCount === 0) {
      return res.status(403).json({ error: 'Access denied - no data available for this patient' });
    }
    
    res.json({
      success: true,
      patient: {
        id: patient._id,
        patientId: patient.patientId,
        patientName: patient.patientName,
        patientBirthDate: patient.patientBirthDate,
        patientSex: patient.patientSex,
        otherPatientIds: patient.otherPatientIds,
        dicomStudyCount: dicomStudyCount,
        wordFileCount: wordFileCount,
        lastDocumentUpload: lastDocumentUpload,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      }
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
