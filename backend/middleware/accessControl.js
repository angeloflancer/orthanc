const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const HospitalSubscription = require('../models/HospitalSubscription');

/**
 * Middleware to check if hospital has active subscription
 * Attaches subscription info to req.subscription
 */
exports.requireActiveSubscription = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    // Owner always has access
    if (req.user.role === 'owner') {
      return next();
    }

    try {
      // For admin, check their hospital's subscription
      if (req.user.role === 'admin') {
        const hospital = await Hospital.findOne({ admin: req.user._id });
        if (!hospital) {
          return res.status(403).json({ 
            error: 'Access denied. No hospital found. Please contact the owner to set up your hospital subscription.' 
          });
        }

        const subscription = await HospitalSubscription.findOne({ hospital: hospital._id });
        if (!subscription) {
          return res.status(403).json({ 
            error: 'Access denied. Hospital subscription not found. Please contact the owner to set up your hospital subscription.' 
          });
        }

        if (!subscription.isActive) {
          return res.status(403).json({ 
            error: 'Access denied. Hospital subscription has expired. Please contact the owner to extend the subscription.' 
          });
        }

        req.subscription = subscription;
        req.hospital = hospital;
        return next();
      }

      // For doctor, check their hospital's subscription through membership
      if (req.user.role === 'doctor') {
        const membership = await HospitalMember.findOne({ 
          user: req.user._id,
          status: 'accepted'
        }).populate('hospital');

        if (!membership || !membership.hospital) {
          return res.status(403).json({ 
            error: 'Access denied. You must be a member of a hospital to access this feature.' 
          });
        }

        const subscription = await HospitalSubscription.findOne({ 
          hospital: membership.hospital._id 
        });

        if (!subscription) {
          return res.status(403).json({ 
            error: 'Access denied. Hospital subscription not found. Please contact the administrator.' 
          });
        }

        if (!subscription.isActive) {
          return res.status(403).json({ 
            error: 'Access denied. Hospital is currently suspended. Please wait for the administrator to renew the subscription.' 
          });
        }

        req.subscription = subscription;
        req.hospital = membership.hospital;
        req.membership = membership;
        return next();
      }

      // Default deny
      return res.status(403).json({ error: 'Access denied.' });
    } catch (error) {
      console.error('Subscription check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

/**
 * Middleware to check if doctor is an accepted hospital member
 * Attaches membership to req.membership
 */
exports.requireHospitalMembership = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    // Owner and admin always have access (they don't need membership)
    if (req.user.role === 'owner' || req.user.role === 'admin') {
      return next();
    }

    // Doctor must be an accepted member
    if (req.user.role === 'doctor') {
      try {
        const membership = await HospitalMember.findOne({ 
          user: req.user._id,
          status: 'accepted'
        }).populate('hospital');

        if (!membership) {
          return res.status(403).json({ 
            error: 'Access denied. You can\'t use this before join the hospital. Please join a hospital first.' 
          });
        }

        req.membership = membership;
        req.hospital = membership.hospital;
        return next();
      } catch (error) {
        console.error('Membership check error:', error);
        res.status(500).json({ error: 'Server error' });
      }
    }

    return res.status(403).json({ error: 'Access denied.' });
  };
};

/**
 * Combined middleware to check feature access
 * Checks both membership (for doctors) and subscription (for admins)
 */
exports.checkFeatureAccess = () => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    // Owner always has access
    if (req.user.role === 'owner') {
      return next();
    }

    try {
      // For admin, check subscription
      if (req.user.role === 'admin') {
        const hospital = await Hospital.findOne({ admin: req.user._id });
        if (!hospital) {
          return res.status(403).json({ 
            error: 'Access denied. Contact the owner to set up your hospital subscription.' 
          });
        }

        const subscription = await HospitalSubscription.findOne({ hospital: hospital._id });
        if (!subscription || !subscription.isActive) {
          return res.status(403).json({ 
            error: 'Access denied. Contact the owner to extend the subscription.' 
          });
        }

        req.subscription = subscription;
        req.hospital = hospital;
        return next();
      }

      // For doctor, check membership and subscription
      if (req.user.role === 'doctor') {
        const membership = await HospitalMember.findOne({ 
          user: req.user._id,
          status: 'accepted'
        }).populate('hospital');

        if (!membership) {
          return res.status(403).json({ 
            error: 'Access denied. You can\'t use this before join the hospital.' 
          });
        }

        const subscription = await HospitalSubscription.findOne({ 
          hospital: membership.hospital._id 
        });

        if (!subscription || !subscription.isActive) {
          return res.status(403).json({ 
            error: 'Access denied. Hospital is currently suspended, wait for the administrator to renew.' 
          });
        }

        req.membership = membership;
        req.hospital = membership.hospital;
        req.subscription = subscription;
        return next();
      }

      return res.status(403).json({ error: 'Access denied.' });
    } catch (error) {
      console.error('Feature access check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};
