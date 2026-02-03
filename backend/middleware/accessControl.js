const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');
const hospitalSubscriptionRepo = require('../db/hospitalSubscriptionRepo');

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
      const userId = req.user.id || req.user._id;
      if (req.user.role === 'admin') {
        const hospital = hospitalRepo.findOne({ admin: userId });
        if (!hospital) {
          return res.status(403).json({
            error: 'Access denied. No hospital found. Please contact the owner to set up your hospital subscription.'
          });
        }
        const subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
        if (!subscription) {
          return res.status(403).json({
            error: 'Access denied. Hospital subscription not found. Please contact the owner to set up your hospital subscription.'
          });
        }
        if (!hospitalSubscriptionRepo.isActive(subscription)) {
          return res.status(403).json({
            error: 'Access denied. Hospital subscription has expired. Please contact the owner to extend the subscription.'
          });
        }
        req.subscription = subscription;
        req.hospital = hospital;
        return next();
      }

      if (req.user.role === 'doctor') {
        const membership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' }, { withHospital: true });
        if (!membership || !membership.hospital) {
          return res.status(403).json({
            error: 'Access denied. You must be a member of a hospital to access this feature.'
          });
        }
        const subscription = hospitalSubscriptionRepo.findOne({ hospital: membership.hospital.id });
        if (!subscription) {
          return res.status(403).json({
            error: 'Access denied. Hospital subscription not found. Please contact the administrator.'
          });
        }
        if (!hospitalSubscriptionRepo.isActive(subscription)) {
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

    if (req.user.role === 'doctor') {
      try {
        const userId = req.user.id || req.user._id;
        const membership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' }, { withHospital: true });
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
      const userId = req.user.id || req.user._id;
      if (req.user.role === 'admin') {
        const hospital = hospitalRepo.findOne({ admin: userId });
        if (!hospital) {
          return res.status(403).json({
            error: 'Access denied. Contact the owner to set up your hospital subscription.'
          });
        }
        const subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
        if (!subscription || !hospitalSubscriptionRepo.isActive(subscription)) {
          return res.status(403).json({
            error: 'Access denied. Contact the owner to extend the subscription.'
          });
        }
        req.subscription = subscription;
        req.hospital = hospital;
        return next();
      }

      if (req.user.role === 'doctor') {
        const membership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' }, { withHospital: true });
        if (!membership) {
          return res.status(403).json({
            error: 'Access denied. You can\'t use this before join the hospital.'
          });
        }
        const subscription = hospitalSubscriptionRepo.findOne({ hospital: membership.hospital.id });
        if (!subscription || !hospitalSubscriptionRepo.isActive(subscription)) {
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
