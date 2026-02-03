const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');

/**
 * Middleware to check if user has one of the required roles
 * @param  {...string} roles - Allowed roles
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user is owner
 */
exports.requireOwner = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    if (req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Access denied. Owner privileges required.' 
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user is admin or owner
 */
exports.requireAdmin = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.' 
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if user is admin of a hospital
 * Also attaches the hospital to req.hospital
 */
exports.requireHospitalAdmin = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.' 
      });
    }
    
    try {
      const userId = req.user.id || req.user._id;
      const hospital = hospitalRepo.findOne({ admin: userId });
      if (!hospital && req.user.role === 'admin') {
        return res.status(404).json({
          error: 'No hospital found. Please create a hospital first.'
        });
      }
      req.hospital = hospital;
      next();
    } catch (error) {
      console.error('Hospital admin check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

/**
 * Middleware to check if user is a member of a hospital (with accepted status)
 * Also attaches the membership to req.membership
 */
exports.requireHospitalMember = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    
    try {
      const userId = req.user.id || req.user._id;
      const membership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' }, { withHospital: true });
      req.membership = membership;
      req.hospital = membership ? membership.hospital : null;
      next();
    } catch (error) {
      console.error('Hospital member check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

/**
 * Get user IDs that a user can access based on their role
 * @param {Object} user - The user object
 * @returns {Promise<Array|null>} Array of user IDs or null (for owner - all access)
 */
exports.getAllowedUserIds = async (user) => {
  if (user.role === 'owner') {
    return null;
  }
  const userId = user.id || user._id;
  if (user.role === 'admin') {
    const hospital = hospitalRepo.findOne({ admin: userId });
    if (!hospital) {
      return [userId];
    }
    const { rows: members } = hospitalMemberRepo.find({ hospital: hospital.id }, { limit: 1000 });
    const memberIds = members.filter(m => m.status === 'accepted').map(m => m.user);
    if (!memberIds.includes(userId)) {
      memberIds.push(userId);
    }
    return memberIds;
  }
  return [userId];
};
