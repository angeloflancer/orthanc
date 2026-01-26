const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');

/**
 * Get the hospital associated with a user
 * @param {Object} user - The user object
 * @returns {Promise<Object|null>} Hospital object or null if user has no hospital
 */
async function getUserHospital(user) {
  if (!user) return null;
  
  if (user.role === 'admin') {
    return await Hospital.findOne({ admin: user._id });
  } else if (user.role === 'doctor') {
    const membership = await HospitalMember.findOne({ 
      user: user._id, 
      status: 'accepted' 
    }).populate('hospital');
    return membership ? membership.hospital : null;
  }
  
  return null;
}

module.exports = {
  getUserHospital
};
