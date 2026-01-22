const mongoose = require('mongoose');
const crypto = require('crypto');

const hospitalSchema = new mongoose.Schema({
  hospitalId: {
    type: String,
    unique: true,
    index: true
    // Not required - auto-generated in pre-validate hook
  },
  name: {
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One admin can only have one hospital
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

// Generate unique hospital ID before validation
hospitalSchema.pre('validate', async function(next) {
  if (!this.hospitalId) {
    let isUnique = false;
    let hospitalId;
    
    while (!isUnique) {
      // Generate HSP-XXXXXX format
      const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      hospitalId = `HSP-${randomPart}`;
      
      // Check if this ID already exists
      const existing = await this.constructor.findOne({ hospitalId });
      if (!existing) {
        isUnique = true;
      }
    }
    
    this.hospitalId = hospitalId;
  }
  next();
});

// Update timestamp on save
hospitalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Hospital', hospitalSchema);
