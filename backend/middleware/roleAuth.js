const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');

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
      // Find the hospital where this user is the admin
      const hospital = await Hospital.findOne({ admin: req.user._id });
      
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
      const membership = await HospitalMember.findOne({ 
        user: req.user._id,
        status: 'accepted'
      }).populate('hospital');
      
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
    // Owner can access all data
    return null;
  }
  
  if (user.role === 'admin') {
    // Admin can access their own data + all accepted hospital members' data
    const hospital = await Hospital.findOne({ admin: user._id });
    
    if (!hospital) {
      // Admin without hospital can only see their own data
      return [user._id];
    }
    
    // Get all accepted members of the hospital
    const members = await HospitalMember.find({ 
      hospital: hospital._id,
      status: 'accepted'
    }).select('user');
    
    const memberIds = members.map(m => m.user);
    
    // Include admin's own ID
    if (!memberIds.some(id => id.equals(user._id))) {
      memberIds.push(user._id);
    }
    
    return memberIds;
  }
  
  // Doctor can only access their own data
  return [user._id];
};
