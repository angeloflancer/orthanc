const mongoose = require('mongoose');

const dicomStudySchema = new mongoose.Schema({
  // Primary identifier - Study Instance UID from DICOM
  studyInstanceUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Orthanc internal ID
  orthancStudyId: {
    type: String,
    required: true,
    index: true
  },
  // Patient information (linked to Patient model)
  patientId: {
    type: String,
    required: true,
    index: true
  },
  patientName: {
    type: String,
    default: ''
  },
  patientBirthDate: {
    type: String,
    default: ''
  },
  patientSex: {
    type: String,
    default: ''
  },
  // Study information
  studyDate: {
    type: String,
    default: ''
  },
  studyTime: {
    type: String,
    default: ''
  },
  studyDescription: {
    type: String,
    default: ''
  },
  accessionNumber: {
    type: String,
    default: ''
  },
  referringPhysicianName: {
    type: String,
    default: ''
  },
  modalitiesInStudy: {
    type: String,
    default: ''
  },
  // Series and instances count
  seriesCount: {
    type: Number,
    default: 0
  },
  instancesCount: {
    type: Number,
    default: 0
  },
  // Upload tracking
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  uploadedByName: {
    type: String,
    default: ''
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
dicomStudySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DicomStudy', dicomStudySchema);
