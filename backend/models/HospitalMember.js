const mongoose = require('mongoose');

const hospitalMemberSchema = new mongoose.Schema({
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'pending_invitation', 'accepted', 'kicked', 'blocked', 'cancelled'],
    default: 'pending'
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null if user requested to join
  },
  joinedAt: {
    type: Date,
    default: null // Set when status becomes 'accepted'
  },
  statusChangedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure a user can only have one membership record per hospital
hospitalMemberSchema.index({ hospital: 1, user: 1 }, { unique: true });

// Validate that both hospital and user are set before saving
hospitalMemberSchema.pre('save', function(next) {
  if (!this.hospital || !this.user) {
    return next(new Error('Hospital and user are required'));
  }
  next();
});

// Update statusChangedAt when status changes
hospitalMemberSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusChangedAt = Date.now();
    
    // Set joinedAt when status becomes accepted
    if (this.status === 'accepted' && !this.joinedAt) {
      this.joinedAt = Date.now();
    }
  }
  next();
});

module.exports = mongoose.model('HospitalMember', hospitalMemberSchema);
