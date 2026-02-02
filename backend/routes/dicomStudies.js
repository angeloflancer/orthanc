const express = require('express');
const router = express.Router();
const DicomStudy = require('../models/DicomStudy');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/accessControl');

/** Get request user: for owner use req.user (not in DB); for others load from DB. */
async function getRequestUser(req) {
  if (req.user.role === 'owner') return req.user;
  return User.findById(req.user._id).select('-password');
}

// Save DICOM study info after upload
router.post('/save', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const { studyInfo } = req.body;
    
    if (!studyInfo) {
      return res.status(400).json({ error: 'Study info is required' });
    }
    
    const {
      studyInstanceUid,
      orthancStudyId,
      patientId,
      patientName,
      patientBirthDate,
      patientSex,
      studyDate,
      studyTime,
      studyDescription,
      accessionNumber,
      referringPhysicianName,
      modalitiesInStudy,
      seriesCount,
      instancesCount
    } = studyInfo;
    
    if (!studyInstanceUid) {
      return res.status(400).json({ error: 'Study Instance UID is required' });
    }
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }
    
    // Get user info first (owner is not in DB)
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if study already exists
    const existingStudy = await DicomStudy.findOne({ studyInstanceUid });
    if (existingStudy) {
      // Update existing study info
      existingStudy.orthancStudyId = orthancStudyId || existingStudy.orthancStudyId;
      existingStudy.seriesCount = seriesCount || existingStudy.seriesCount;
      existingStudy.instancesCount = instancesCount || existingStudy.instancesCount;
      existingStudy.modalitiesInStudy = modalitiesInStudy || existingStudy.modalitiesInStudy;
      // Update uploadedByName if it's empty (for existing studies uploaded by owners)
      if (!existingStudy.uploadedByName && user.name) {
        existingStudy.uploadedByName = user.name;
      }
      await existingStudy.save();
      
      return res.json({
        success: true,
        message: 'Study already exists, updated info',
        study: existingStudy,
        isNew: false
      });
    }
    
    // Get hospital from middleware (set by checkFeatureAccess)
    // Owners don't have a hospital but can still upload
    const hospital = req.hospital;
    if (!hospital && user.role !== 'owner') {
      return res.status(403).json({ error: 'Hospital not found. You must be a member of a hospital to upload data.' });
    }
    
    // Create new DICOM study record
    const dicomStudy = await DicomStudy.create({
      studyInstanceUid,
      orthancStudyId: orthancStudyId || '',
      patientId,
      patientName: patientName || '',
      patientBirthDate: patientBirthDate || '',
      patientSex: patientSex || '',
      studyDate: studyDate || '',
      studyTime: studyTime || '',
      studyDescription: studyDescription || '',
      accessionNumber: accessionNumber || '',
      referringPhysicianName: referringPhysicianName || '',
      modalitiesInStudy: modalitiesInStudy || '',
      seriesCount: seriesCount || 0,
      instancesCount: instancesCount || 0,
      hospital: hospital ? hospital._id : null, // Allow null for owners
      uploadedBy: req.user._id || undefined,
      uploadedByName: user.name || req.user.name || ''
    });
    
    // Check if patient already exists by patientId (one patient ID = one patient record)
    // If exists, use the existing patient; if not, create a new one
    let patient = await Patient.findOne({ patientId });
    if (!patient) {
      // Create new patient record
      const patientHospital = hospital ? hospital._id : null;
      patient = await Patient.create({
        patientId,
        hospital: patientHospital, // null for owners
        patientName: patientName || '',
        patientBirthDate: patientBirthDate || '',
        patientSex: patientSex || '',
        dicomStudyCount: 1,
        wordFileCount: 0
      });
    } else {
      // Patient already exists - update counts and info, but don't create duplicate
      // Increment DICOM study count
      patient.dicomStudyCount += 1;
      // Update patient info if more complete
      if (!patient.patientName && patientName) {
        patient.patientName = patientName;
      }
      if (!patient.patientBirthDate && patientBirthDate) {
        patient.patientBirthDate = patientBirthDate;
      }
      if (!patient.patientSex && patientSex) {
        patient.patientSex = patientSex;
      }
      // Update hospital if patient doesn't have one and we have one
      if (!patient.hospital && hospital) {
        patient.hospital = hospital._id;
      }
      await patient.save();
    }
    
    res.status(201).json({
      success: true,
      message: 'DICOM study saved successfully',
      study: {
        id: dicomStudy._id,
        studyInstanceUid: dicomStudy.studyInstanceUid,
        orthancStudyId: dicomStudy.orthancStudyId,
        patientId: dicomStudy.patientId,
        patientName: dicomStudy.patientName,
        studyDate: dicomStudy.studyDate,
        studyDescription: dicomStudy.studyDescription,
        uploadedAt: dicomStudy.uploadedAt
      },
      patient: {
        id: patient._id,
        patientId: patient.patientId,
        patientName: patient.patientName
      },
      isNew: true
    });
  } catch (error) {
    console.error('Save DICOM study error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all DICOM studies (paginated)
router.get('/', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    const total = await DicomStudy.countDocuments(query);

    const studies = await DicomStudy.find(query)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      studies: studies.map(study => ({
        id: study._id,
        studyInstanceUid: study.studyInstanceUid,
        orthancStudyId: study.orthancStudyId,
        patientId: study.patientId,
        patientName: study.patientName,
        patientBirthDate: study.patientBirthDate,
        studyDate: study.studyDate,
        studyDescription: study.studyDescription,
        accessionNumber: study.accessionNumber,
        modalitiesInStudy: study.modalitiesInStudy,
        seriesCount: study.seriesCount,
        instancesCount: study.instancesCount,
        uploadedByName: study.uploadedByName,
        uploadedAt: study.uploadedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Get DICOM studies error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if study exists by Study Instance UID
router.get('/exists/:studyInstanceUid', protect, async (req, res) => {
  try {
    const study = await DicomStudy.findOne({ studyInstanceUid: req.params.studyInstanceUid });
    res.json({
      success: true,
      exists: !!study,
      study: study ? {
        id: study._id,
        studyInstanceUid: study.studyInstanceUid,
        orthancStudyId: study.orthancStudyId
      } : null
    });
  } catch (error) {
    console.error('Check study exists error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete DICOM study
router.delete('/:orthancStudyId', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Prevent doctors from deleting DICOM studies
    if (user.role === 'doctor') {
      return res.status(403).json({ error: 'Doctors are not allowed to delete DICOM studies' });
    }
    
    const { orthancStudyId } = req.params;
    
    // Find the study in our database
    const dicomStudy = await DicomStudy.findOne({ orthancStudyId });
    
    if (!dicomStudy) {
      return res.status(404).json({ error: 'DICOM study not found in database' });
    }
    
    // Owner and admin can delete any study; doctors cannot delete (handled above)
    // No hospital check - admin can delete any study
    
    // Delete from Orthanc
    const axios = require('axios');
    const TARGET_SERVICE = process.env.TARGET_SERVICE || 'http://localhost:8042';
    
    try {
      await axios.delete(`${TARGET_SERVICE}/studies/${orthancStudyId}`);
    } catch (err) {
      console.error(`Error deleting study ${orthancStudyId} from Orthanc:`, err.message);
      // Continue with database deletion even if Orthanc deletion fails
    }
    
    // Decrement patient DICOM study count
    const patient = await Patient.findOne({ 
      patientId: dicomStudy.patientId, 
      hospital: dicomStudy.hospital || null 
    });
    if (patient) {
      patient.dicomStudyCount = Math.max(0, patient.dicomStudyCount - 1);
      await patient.save();
    }
    
    // Delete from database
    await DicomStudy.findByIdAndDelete(dicomStudy._id);
    
    res.json({
      success: true,
      message: 'DICOM study deleted successfully'
    });
  } catch (error) {
    console.error('Delete DICOM study error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
