const mongoose = require('mongoose');

const hospitalSubscriptionSchema = new mongoose.Schema({
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    unique: true,
    index: true
  },
  planType: {
    type: String,
    enum: ['monthly', 'yearly', 'forever'],
    required: [true, 'Plan type is required']
  },
  expiresAt: {
    type: Date,
    default: null // null for forever plans
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

// Index for expiration queries
hospitalSubscriptionSchema.index({ expiresAt: 1 });

// Update timestamp on save
hospitalSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual to check if subscription is active
hospitalSubscriptionSchema.virtual('isActive').get(function() {
  if (this.planType === 'forever') {
    return true;
  }
  if (!this.expiresAt) {
    return true; // If no expiration set, consider active
  }
  return this.expiresAt > new Date();
});

// Method to get days until expiration
hospitalSubscriptionSchema.methods.getDaysUntilExpiration = function() {
  if (this.planType === 'forever' || !this.expiresAt) {
    return null;
  }
  const now = new Date();
  const diffTime = this.expiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Method to check if expiration warning should be shown (≤3 days)
hospitalSubscriptionSchema.methods.shouldShowWarning = function() {
  if (this.planType === 'forever' || !this.expiresAt) {
    return false;
  }
  const daysUntil = this.getDaysUntilExpiration();
  return daysUntil !== null && daysUntil <= 3 && daysUntil >= 0;
};

module.exports = mongoose.model('HospitalSubscription', hospitalSubscriptionSchema);
