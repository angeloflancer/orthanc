const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    index: true
    // Removed unique: true - now unique per hospital
  },
  // Hospital ownership (required for access control)
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientBirthDate: {
    type: String,
    default: ''
  },
  patientSex: {
    type: String,
    default: ''
  },
  otherPatientIds: {
    type: String,
    default: ''
  },
  // Track sources of patient info (hospital-specific)
  dicomStudyCount: {
    type: Number,
    default: 0
  },
  wordFileCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index: patientId + hospital (same patient ID can exist in different hospitals)
patientSchema.index({ patientId: 1, hospital: 1 }, { unique: true });

// Update timestamp on save
patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
