const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');

/**
 * Get the hospital associated with a user
 * @param {Object} user - The user object
 * @returns {Object|null} Hospital object or null if user has no hospital
 */
function getUserHospital(user) {
  if (!user) return null;
  const userId = user.id || user._id;
  if (user.role === 'admin') {
    return hospitalRepo.findOne({ admin: userId });
  }
  if (user.role === 'doctor') {
    const membership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' }, { withHospital: true });
    return membership ? membership.hospital : null;
  }
  return null;
}

module.exports = {
  getUserHospital
};
