const mongoose = require('mongoose');

/**
 * Single-document model for clock tamper detection.
 * Store in collection 'licenseguards' with _id: 'clock'.
 * - lastSeenTime: high-water mark of the latest time the server has seen
 * - clockTamperedAt: set when backward clock is detected; when present, all subscriptions are treated as expired
 */
const licenseGuardSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'clock'
  },
  lastSeenTime: {
    type: Date,
    required: true
  },
  clockTamperedAt: {
    type: Date,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true,
  collection: 'licenseguards'
});

licenseGuardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LicenseGuard', licenseGuardSchema);
