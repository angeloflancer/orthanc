const express = require('express');
const router = express.Router();
const DicomStudy = require('../models/DicomStudy');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/accessControl');

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
    
    // Check if study already exists
    const existingStudy = await DicomStudy.findOne({ studyInstanceUid });
    if (existingStudy) {
      // Update existing study info
      existingStudy.orthancStudyId = orthancStudyId || existingStudy.orthancStudyId;
      existingStudy.seriesCount = seriesCount || existingStudy.seriesCount;
      existingStudy.instancesCount = instancesCount || existingStudy.instancesCount;
      existingStudy.modalitiesInStudy = modalitiesInStudy || existingStudy.modalitiesInStudy;
      await existingStudy.save();
      
      return res.json({
        success: true,
        message: 'Study already exists, updated info',
        study: existingStudy,
        isNew: false
      });
    }
    
    // Get hospital from middleware (set by checkFeatureAccess)
    const hospital = req.hospital;
    if (!hospital) {
      return res.status(403).json({ error: 'Hospital not found. You must be a member of a hospital to upload data.' });
    }
    
    // Get user info
    const user = await User.findById(req.user._id);
    
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
      hospital: hospital._id,
      uploadedBy: req.user._id,
      uploadedByName: user ? user.name : ''
    });
    
    // Check if patient already exists for this hospital, if not create one
    let patient = await Patient.findOne({ patientId, hospital: hospital._id });
    if (!patient) {
      patient = await Patient.create({
        patientId,
        hospital: hospital._id,
        patientName: patientName || '',
        patientBirthDate: patientBirthDate || '',
        patientSex: patientSex || '',
        dicomStudyCount: 1,
        wordFileCount: 0
      });
    } else {
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

// Get all DICOM studies
router.get('/', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Build query based on user role and hospital
    let query = {};
    
    if (user.role === 'owner') {
      // Owner can see all studies
      query = {};
    } else {
      // Admin and doctor can only see their hospital's studies
      const hospital = req.hospital;
      if (!hospital) {
        return res.status(403).json({ error: 'Hospital not found' });
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
        patientBirthDate: study.patientBirthDate,
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

module.exports = router;
