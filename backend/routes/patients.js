const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const DicomStudy = require('../models/DicomStudy');
const WordFile = require('../models/WordFile');
const { protect } = require('../middleware/auth');

// Get all patients
router.get('/', protect, async (req, res) => {
  try {
    const patients = await Patient.find()
      .sort({ updatedAt: -1 })
      .lean();
    
    res.json({
      success: true,
      patients: patients.map(patient => ({
        id: patient._id,
        patientId: patient.patientId,
        patientName: patient.patientName,
        patientBirthDate: patient.patientBirthDate,
        patientSex: patient.patientSex,
        otherPatientIds: patient.otherPatientIds,
        dicomStudyCount: patient.dicomStudyCount,
        wordFileCount: patient.wordFileCount,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      }))
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single patient
router.get('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
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
        dicomStudyCount: patient.dicomStudyCount,
        wordFileCount: patient.wordFileCount,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt
      }
    });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get patient by patientId (DICOM Patient ID)
router.get('/by-patient-id/:patientId', protect, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId });
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
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
        dicomStudyCount: patient.dicomStudyCount,
        wordFileCount: patient.wordFileCount,
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
router.get('/:patientId/dicom-studies', protect, async (req, res) => {
  try {
    const studies = await DicomStudy.find({ patientId: req.params.patientId })
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

// Get Word files for a patient
router.get('/:patientId/word-files', protect, async (req, res) => {
  try {
    const wordFiles = await WordFile.find({ patientId: req.params.patientId })
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

module.exports = router;
