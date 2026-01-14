const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true,
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
  // Track sources of patient info
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

// Update timestamp on save
patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Patient', patientSchema);
