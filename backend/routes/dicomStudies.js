const express = require('express');
const router = express.Router();
const dicomStudyRepo = require('../db/dicomStudyRepo');
const patientRepo = require('../db/patientRepo');
const userRepo = require('../db/userRepo');
const { protect } = require('../middleware/auth');
const { checkFeatureAccess } = require('../middleware/accessControl');
const orthancClient = require('../utils/orthancClient');

function getRequestUser(req) {
  if (req.user.role === 'owner') return req.user;
  const user = userRepo.findById(req.user.id || req.user._id);
  if (!user) return null;
  const { password, ...safe } = user;
  safe.id = user.id;
  safe._id = user.id;
  return safe;
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
    
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const existingStudy = dicomStudyRepo.findOne({ studyInstanceUid });
    if (existingStudy) {
      const updates = {
        orthancStudyId: orthancStudyId || existingStudy.orthancStudyId,
        seriesCount: seriesCount ?? existingStudy.seriesCount,
        instancesCount: instancesCount ?? existingStudy.instancesCount,
        modalitiesInStudy: modalitiesInStudy || existingStudy.modalitiesInStudy
      };
      if (!existingStudy.uploadedByName && user.name) updates.uploadedByName = user.name;
      dicomStudyRepo.update(existingStudy.id, updates);
      const updated = dicomStudyRepo.findById(existingStudy.id);
      return res.json({ success: true, message: 'Study already exists, updated info', study: updated, isNew: false });
    }

    const hospital = req.hospital;
    if (!hospital && user.role !== 'owner') {
      return res.status(403).json({ error: 'Hospital not found. You must be a member of a hospital to upload data.' });
    }

    const dicomStudy = dicomStudyRepo.create({
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
      hospital: hospital ? hospital.id : null,
      uploadedBy: req.user.id || req.user._id || null,
      uploadedByName: user.name || req.user.name || ''
    });

    let patient = patientRepo.findOne({ patientId });
    if (!patient) {
      patient = patientRepo.create({
        patientId,
        hospital: hospital ? hospital.id : null,
        patientName: patientName || '',
        patientBirthDate: patientBirthDate || '',
        patientSex: patientSex || '',
        dicomStudyCount: 1,
        wordFileCount: 0
      });
    } else {
      const updates = {
        dicomStudyCount: (patient.dicomStudyCount || 0) + 1
      };
      if (!patient.patientName && patientName) updates.patientName = patientName;
      if (!patient.patientBirthDate && patientBirthDate) updates.patientBirthDate = patientBirthDate;
      if (!patient.patientSex && patientSex) updates.patientSex = patientSex;
      if (!patient.hospital && hospital) updates.hospital = hospital.id;
      patientRepo.update(patient.id, updates);
      patient = patientRepo.findById(patient.id);
    }

    res.status(201).json({
      success: true,
      message: 'DICOM study saved successfully',
      study: {
        id: dicomStudy.id,
        studyInstanceUid: dicomStudy.studyInstanceUid,
        orthancStudyId: dicomStudy.orthancStudyId,
        patientId: dicomStudy.patientId,
        patientName: dicomStudy.patientName,
        studyDate: dicomStudy.studyDate,
        studyDescription: dicomStudy.studyDescription,
        uploadedAt: dicomStudy.uploadedAt
      },
      patient: { id: patient.id, patientId: patient.patientId, patientName: patient.patientName },
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
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const query = {};
    const total = dicomStudyRepo.countDocuments(query);
    const studies = dicomStudyRepo.find(query, { limit, skip });
    res.json({
      success: true,
      studies: studies.map(s => ({
        id: s.id,
        studyInstanceUid: s.studyInstanceUid,
        orthancStudyId: s.orthancStudyId,
        patientId: s.patientId,
        patientName: s.patientName,
        patientBirthDate: s.patientBirthDate,
        studyDate: s.studyDate,
        studyDescription: s.studyDescription,
        accessionNumber: s.accessionNumber,
        modalitiesInStudy: s.modalitiesInStudy,
        seriesCount: s.seriesCount,
        instancesCount: s.instancesCount,
        uploadedByName: s.uploadedByName,
        uploadedAt: s.uploadedAt
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
    });
  } catch (error) {
    console.error('Get DICOM studies error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check if study exists by Study Instance UID
router.get('/exists/:studyInstanceUid', protect, async (req, res) => {
  try {
    const study = dicomStudyRepo.findOne({ studyInstanceUid: req.params.studyInstanceUid });
    res.json({
      success: true,
      exists: !!study,
      study: study ? {
        id: study.id,
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
    const user = getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.role === 'doctor') {
      return res.status(403).json({ error: 'Doctors are not allowed to delete DICOM studies' });
    }
    const { orthancStudyId } = req.params;
    const dicomStudy = dicomStudyRepo.findOne({ orthancStudyId });
    if (!dicomStudy) return res.status(404).json({ error: 'DICOM study not found in database' });
    try {
      await orthancClient.delete(`/studies/${orthancStudyId}`);
    } catch (err) {
      console.error(`Error deleting study ${orthancStudyId} from Orthanc:`, err.message);
    }
    const patient = patientRepo.findOne({ patientId: dicomStudy.patientId, hospital: dicomStudy.hospital });
    if (patient) {
      patientRepo.update(patient.id, { dicomStudyCount: Math.max(0, (patient.dicomStudyCount || 0) - 1) });
    }
    dicomStudyRepo.deleteById(dicomStudy.id);
    res.json({ success: true, message: 'DICOM study deleted successfully' });
  } catch (error) {
    console.error('Delete DICOM study error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
