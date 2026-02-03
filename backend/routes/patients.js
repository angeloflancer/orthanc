const express = require('express');
const router = express.Router();
const patientRepo = require('../db/patientRepo');
const dicomStudyRepo = require('../db/dicomStudyRepo');
const wordFileRepo = require('../db/wordFileRepo');
const userRepo = require('../db/userRepo');
const { protect } = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/accessControl');

function getRequestUser(req) {
  if (req.user.role === 'owner') return req.user;
  const user = userRepo.findById(req.user.id || req.user._id);
  if (!user) return null;
  const { password, ...safe } = user;
  safe.id = user.id;
  safe._id = user.id;
  return safe;
}

// Get all patients (paginated)
router.get('/', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const patientQuery = {};
    if (req.query.patientId && req.query.patientId.trim()) patientQuery.patientId = req.query.patientId.trim();
    if (req.query.patientName && req.query.patientName.trim()) patientQuery.patientName = req.query.patientName.trim();
    if (req.query.patientSex && req.query.patientSex.trim()) patientQuery.patientSex = req.query.patientSex.trim();
    if (req.query.birthDateFrom) patientQuery.patientBirthDateFrom = req.query.birthDateFrom;
    if (req.query.birthDateTo) patientQuery.patientBirthDateTo = req.query.birthDateTo;
    const total = patientRepo.countDocuments(patientQuery);
    const patients = patientRepo.find(patientQuery, { limit, skip });
    res.json({
      success: true,
      patients: patients.map(p => ({
        id: p.id,
        patientId: p.patientId,
        patientName: p.patientName,
        patientBirthDate: p.patientBirthDate,
        patientSex: p.patientSex,
        otherPatientIds: p.otherPatientIds,
        dicomStudyCount: p.dicomStudyCount || 0,
        wordFileCount: p.wordFileCount || 0,
        lastDocumentUpload: null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get patient by patientId (DICOM Patient ID) - must come before /:id
router.get('/by-patient-id/:patientId', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const patient = patientRepo.findOne({ patientId: req.params.patientId });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const hospital = req.hospital;
    const userId = req.user.id || req.user._id;
    if (user.role !== 'owner') {
      if (!hospital) return res.status(404).json({ error: 'Patient not found' });
      const hasStudy = dicomStudyRepo.countDocuments({ patientId: req.params.patientId, hospital: hospital.id }) > 0;
      const hasWordFile = wordFileRepo.countDocuments({ patientId: req.params.patientId, hospital: hospital.id }) > 0;
      if (user.role === 'doctor') {
        const hasOwnStudy = dicomStudyRepo.countDocuments({ patientId: req.params.patientId, hospital: hospital.id, uploadedBy: userId }) > 0;
        const hasOwnWordFile = wordFileRepo.countDocuments({ patientId: req.params.patientId, hospital: hospital.id, uploadedBy: userId }) > 0;
        if (!hasOwnStudy && !hasOwnWordFile) return res.status(404).json({ error: 'Patient not found' });
      } else if (!hasStudy && !hasWordFile) {
        return res.status(404).json({ error: 'Patient not found' });
      }
    }
    let dicomCount = patient.dicomStudyCount || 0;
    let wordFileCount = patient.wordFileCount || 0;
    if (user.role === 'doctor') {
      dicomCount = dicomStudyRepo.countDocuments({ patientId: patient.patientId, hospital: patient.hospital, uploadedBy: userId });
      wordFileCount = wordFileRepo.countDocuments({ patientId: patient.patientId, hospital: patient.hospital, uploadedBy: userId });
    }
    res.json({
      success: true,
      patient: {
        id: patient.id,
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
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const query = { patientId: req.params.patientId };
    if (user.role !== 'owner' && req.hospital) {
      query.hospital = req.hospital.id;
      if (user.role === 'doctor') query.uploadedBy = req.user.id || req.user._id;
    }
    if (user.role !== 'owner' && !req.hospital) return res.json({ success: true, studies: [] });
    const studies = dicomStudyRepo.find(query, { limit: 500 });
    res.json({
      success: true,
      studies: studies.map(s => ({
        id: s.id,
        studyInstanceUid: s.studyInstanceUid,
        orthancStudyId: s.orthancStudyId,
        patientId: s.patientId,
        patientName: s.patientName,
        studyDate: s.studyDate,
        studyDescription: s.studyDescription,
        accessionNumber: s.accessionNumber,
        modalitiesInStudy: s.modalitiesInStudy,
        seriesCount: s.seriesCount,
        instancesCount: s.instancesCount,
        uploadedByName: s.uploadedByName,
        uploadedAt: s.uploadedAt
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

// Get single patient by ID - must be last to avoid route conflicts
router.get('/:id', protect, checkFeatureAccess(), async (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const patient = patientRepo.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    const hospital = req.hospital;
    const userId = req.user.id || req.user._id;
    if (user.role !== 'owner') {
      if (!hospital) return res.status(404).json({ error: 'Patient not found' });
      const hasStudy = dicomStudyRepo.countDocuments({ patientId: patient.patientId, hospital: hospital.id }) > 0;
      const hasWordFile = wordFileRepo.countDocuments({ patientId: patient.patientId, hospital: hospital.id }) > 0;
      if (user.role === 'doctor') {
        const hasOwnStudy = dicomStudyRepo.countDocuments({ patientId: patient.patientId, hospital: hospital.id, uploadedBy: userId }) > 0;
        const hasOwnWordFile = wordFileRepo.countDocuments({ patientId: patient.patientId, hospital: hospital.id, uploadedBy: userId }) > 0;
        if (!hasOwnStudy && !hasOwnWordFile) return res.status(404).json({ error: 'Patient not found' });
      } else if (!hasStudy && !hasWordFile) {
        return res.status(404).json({ error: 'Patient not found' });
      }
    }
    let dicomCount = patient.dicomStudyCount || 0;
    let wordFileCount = patient.wordFileCount || 0;
    if (user.role === 'doctor') {
      dicomCount = dicomStudyRepo.countDocuments({ patientId: patient.patientId, hospital: patient.hospital, uploadedBy: userId });
      wordFileCount = wordFileRepo.countDocuments({ patientId: patient.patientId, hospital: patient.hospital, uploadedBy: userId });
    }
    res.json({
      success: true,
      patient: {
        id: patient.id,
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
