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

/** Get request user: for owner use req.user (not in DB); for others load from DB. */
async function getRequestUser(req) {
  if (req.user.role === 'owner') return req.user;
  return User.findById(req.user._id).select('-password');
}


// Helper function to get user's hospital ID for filtering
// Returns null for owner (all access), hospital._id for admin/doctor, or null if no hospital
async function getUserHospitalId(user) {
  if (!user) return null;
  
  if (user.role === 'owner') {
    // Owner can access all data - return null to indicate no filtering
    return null;
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

// Get all patients
router.get('/', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Build query based on studies/files from user's hospital
    // Since patientId is unique globally, we find patients by their IDs from studies/files
    let patientIds = [];
    
    if (user.role !== 'owner') {
      const hospital = req.hospital;
      if (!hospital) {
        return res.json({ success: true, patients: [] });
      }
      
      if (user.role === 'doctor') {
        // Doctors can only see patients from their own studies/files
        const doctorStudies = await DicomStudy.find({ 
          hospital: hospital._id,
          uploadedBy: req.user._id
        }).select('patientId').lean();
        
        const doctorWordFiles = await WordFile.find({ 
          hospital: hospital._id,
          uploadedBy: req.user._id
        }).select('patientId').lean();
        
        patientIds = [...new Set([
          ...doctorStudies.map(s => s.patientId),
          ...doctorWordFiles.map(f => f.patientId)
        ])];
      } else {
        // Admins can see all patients with studies/files from their hospital
        const hospitalStudies = await DicomStudy.find({ 
          hospital: hospital._id
        }).select('patientId').lean();
        
        const hospitalWordFiles = await WordFile.find({ 
          hospital: hospital._id
        }).select('patientId').lean();
        
        patientIds = [...new Set([
          ...hospitalStudies.map(s => s.patientId),
          ...hospitalWordFiles.map(f => f.patientId)
        ])];
      }
      
      if (patientIds.length === 0) {
        return res.json({ success: true, patients: [] });
      }
    }
    
    // Get patients - all for owner, or filtered by patientIds for others
    let patientQuery = {};
    if (patientIds.length > 0) {
      patientQuery.patientId = { $in: patientIds };
    }
    
    const patients = await Patient.find(patientQuery)
      .sort({ updatedAt: -1 })
      .lean();
    
    // Calculate counts based on user's access
    let patientsWithCounts = await Promise.all(patients.map(async (patient) => {
      let dicomCount = patient.dicomStudyCount || 0;
      let wordFileCount = patient.wordFileCount || 0;
      
      if (user.role !== 'owner') {
        const hospital = req.hospital;
        // Recalculate counts based on user's hospital access
        if (user.role === 'doctor') {
          dicomCount = await DicomStudy.countDocuments({
            patientId: patient.patientId,
            hospital: hospital._id,
            uploadedBy: req.user._id
          });
          wordFileCount = await WordFile.countDocuments({
            patientId: patient.patientId,
            hospital: hospital._id,
            uploadedBy: req.user._id
          });
        } else {
          dicomCount = await DicomStudy.countDocuments({
            patientId: patient.patientId,
            hospital: hospital._id
          });
          wordFileCount = await WordFile.countDocuments({
            patientId: patient.patientId,
            hospital: hospital._id
          });
        }
      }
      
      return {
        ...patient,
        dicomStudyCount: dicomCount,
        wordFileCount: wordFileCount
      };
    }));
    
    // Return patients with their counts
    res.json({
      success: true,
      patients: patientsWithCounts.map(patient => ({
        id: patient._id,
        patientId: patient.patientId,
        patientName: patient.patientName,
        patientBirthDate: patient.patientBirthDate,
        patientSex: patient.patientSex,
        otherPatientIds: patient.otherPatientIds,
        dicomStudyCount: patient.dicomStudyCount || 0,
        wordFileCount: patient.wordFileCount || 0,
        lastDocumentUpload: null, // Can be calculated if needed
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      }))
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get patient by patientId (DICOM Patient ID) - must come before /:id
router.get('/by-patient-id/:patientId', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Find patient by patientId only (one patient ID = one patient record)
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Apply access control based on hospital
    if (user.role !== 'owner') {
      const hospital = req.hospital;
      if (!hospital) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      // Check if patient has studies/files from this hospital
      const hasStudy = await DicomStudy.exists({
        patientId: req.params.patientId,
        hospital: hospital._id
      });
      const hasWordFile = await WordFile.exists({
        patientId: req.params.patientId,
        hospital: hospital._id
      });
      
      // For doctors, also check if they uploaded the studies/files
      if (user.role === 'doctor') {
        const hasOwnStudy = await DicomStudy.exists({
          patientId: req.params.patientId,
          hospital: hospital._id,
          uploadedBy: req.user._id
        });
        const hasOwnWordFile = await WordFile.exists({
          patientId: req.params.patientId,
          hospital: hospital._id,
          uploadedBy: req.user._id
        });
        
        if (!hasOwnStudy && !hasOwnWordFile) {
          return res.status(404).json({ error: 'Patient not found' });
        }
      } else if (!hasStudy && !hasWordFile) {
        // Admin can see patient if hospital has any studies/files for this patient
        return res.status(404).json({ error: 'Patient not found' });
      }
    }
    
    // Calculate counts based on role
    let dicomCount = patient.dicomStudyCount || 0;
    let wordFileCount = patient.wordFileCount || 0;
    
    if (user.role === 'doctor') {
      dicomCount = await DicomStudy.countDocuments({
        patientId: patient.patientId,
        hospital: patient.hospital,
        uploadedBy: req.user._id
      });
      wordFileCount = await WordFile.countDocuments({
        patientId: patient.patientId,
        hospital: patient.hospital,
        uploadedBy: req.user._id
      });
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
        dicomStudyCount: dicomCount,
        wordFileCount: wordFileCount,
        lastDocumentUpload: null,
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
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Build query based on patient ID and hospital
    let query = { patientId: req.params.patientId };
    if (user.role !== 'owner') {
      const hospital = req.hospital;
      if (!hospital) {
        return res.json({ success: true, studies: [] });
      }
      query.hospital = hospital._id;
      
      // Doctors can only see their own data
      if (user.role === 'doctor') {
        query.uploadedBy = req.user._id;
      }
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
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Build query based on patient ID and hospital
    let query = { patientId: req.params.patientId };
    if (user.role !== 'owner') {
      const hospital = req.hospital;
      if (!hospital) {
        return res.json({ success: true, wordFiles: [] });
      }
      query.hospital = hospital._id;
      
      // Doctors can only see their own data
      if (user.role === 'doctor') {
        query.uploadedBy = req.user._id;
      }
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
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Build query - check hospital access
    // Find patient by MongoDB ID
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Apply access control based on hospital
    if (user.role !== 'owner') {
      const hospital = req.hospital;
      if (!hospital) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      // Check if patient has studies/files from this hospital
      const hasStudy = await DicomStudy.exists({
        patientId: patient.patientId,
        hospital: hospital._id
      });
      const hasWordFile = await WordFile.exists({
        patientId: patient.patientId,
        hospital: hospital._id
      });
      
      // For doctors, also check if they uploaded the studies/files
      if (user.role === 'doctor') {
        const hasOwnStudy = await DicomStudy.exists({
          patientId: patient.patientId,
          hospital: hospital._id,
          uploadedBy: req.user._id
        });
        const hasOwnWordFile = await WordFile.exists({
          patientId: patient.patientId,
          hospital: hospital._id,
          uploadedBy: req.user._id
        });
        
        if (!hasOwnStudy && !hasOwnWordFile) {
          return res.status(404).json({ error: 'Patient not found' });
        }
      } else if (!hasStudy && !hasWordFile) {
        // Admin can see patient if hospital has any studies/files for this patient
        return res.status(404).json({ error: 'Patient not found' });
      }
    }
    
    // Calculate counts based on role
    let dicomCount = patient.dicomStudyCount || 0;
    let wordFileCount = patient.wordFileCount || 0;
    
    if (user.role === 'doctor') {
      dicomCount = await DicomStudy.countDocuments({
        patientId: patient.patientId,
        hospital: patient.hospital,
        uploadedBy: req.user._id
      });
      wordFileCount = await WordFile.countDocuments({
        patientId: patient.patientId,
        hospital: patient.hospital,
        uploadedBy: req.user._id
      });
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
        dicomStudyCount: dicomCount,
        wordFileCount: wordFileCount,
        lastDocumentUpload: null,
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
