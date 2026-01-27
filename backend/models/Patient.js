const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true, // One patient ID = one patient record globally
    index: true
  },
  // Hospital ownership (required for access control, optional for owners)
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: false, // Optional to allow owners to create patients without hospital
    index: true // Index for efficient queries
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

// patientId is now unique globally, so we don't need the compound index
// Hospital index is already defined in the field definition (index: true)

// Update timestamp on save
patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
