const express = require('express');
const router = express.Router();
const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');
const hospitalSubscriptionRepo = require('../db/hospitalSubscriptionRepo');
const { protect } = require('../middleware/auth');
const { requireOwner } = require('../middleware/roleAuth');

/**
 * Check if subscription expires in 3 days or less
 * GET /api/subscriptions/check-expiration
 * This route must come BEFORE /:hospitalId to avoid route conflicts
 */
router.get('/check-expiration', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let hospital = null;
    if (req.user.role === 'admin') {
      hospital = hospitalRepo.findOne({ admin: userId });
    } else if (req.user.role === 'doctor') {
      const membership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' }, { withHospital: true });
      if (membership) hospital = membership.hospital;
    }
    if (!hospital) return res.json({ success: true, hasWarning: false, message: 'No hospital found' });
    const subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    if (!subscription) return res.json({ success: true, hasWarning: false, message: 'No subscription found' });
    const shouldShowWarning = hospitalSubscriptionRepo.shouldShowWarning(subscription);
    const daysUntilExpiration = hospitalSubscriptionRepo.getDaysUntilExpiration(subscription);
    res.json({
      success: true,
      hasWarning: shouldShowWarning,
      daysUntilExpiration,
      planType: subscription.planType,
      expiresAt: subscription.expiresAt,
      isActive: hospitalSubscriptionRepo.isActive(subscription),
      message: shouldShowWarning
        ? `There are ${daysUntilExpiration} days left until the deadline. Please contact the administrator to extend the deadline.`
        : null
    });
  } catch (error) {
    console.error('Check expiration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Create or update hospital subscription (Owner only)
 * POST /api/subscriptions/:hospitalId
 */
router.post('/:hospitalId', protect, requireOwner(), async (req, res) => {
  try {
    const { planType } = req.body;
    if (!planType || !['monthly', 'yearly', 'forever'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type. Must be monthly, yearly, or forever.' });
    }
    const hospitalId = req.params.hospitalId;
    const hospital = /^\d+$/.test(hospitalId) ? hospitalRepo.findById(Number(hospitalId)) : hospitalRepo.findOne({ hospitalId });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    let expiresAt = null;
    if (planType === 'monthly') expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    else if (planType === 'yearly') expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
    let subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    if (subscription) {
      hospitalSubscriptionRepo.update(subscription.hospital, { planType, expiresAt });
    } else {
      hospitalSubscriptionRepo.create({ hospital: hospital.id, planType, expiresAt });
    }
    subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    res.json({
      success: true,
      message: 'Subscription created/updated successfully',
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        expiresAt: subscription.expiresAt,
        isActive: hospitalSubscriptionRepo.isActive(subscription),
        daysUntilExpiration: hospitalSubscriptionRepo.getDaysUntilExpiration(subscription),
        shouldShowWarning: hospitalSubscriptionRepo.shouldShowWarning(subscription)
      }
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get hospital subscription details
 * GET /api/subscriptions/:hospitalId
 */
router.get('/:hospitalId', protect, async (req, res) => {
  try {
    const id = req.params.hospitalId;
    const hospital = /^\d+$/.test(id) ? hospitalRepo.findById(Number(id)) : hospitalRepo.findOne({ hospitalId: id });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const userId = req.user.id || req.user._id;
    if (req.user.role === 'admin') {
      if (hospital.admin !== userId) return res.status(403).json({ error: 'Access denied' });
    } else if (req.user.role === 'doctor') {
      const membership = hospitalMemberRepo.findOne({ user: userId, hospital: hospital.id, status: 'accepted' });
      if (!membership) return res.status(403).json({ error: 'Access denied' });
    } else if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    if (!subscription) return res.json({ success: true, subscription: null, message: 'No subscription found for this hospital' });
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        expiresAt: subscription.expiresAt,
        isActive: hospitalSubscriptionRepo.isActive(subscription),
        daysUntilExpiration: hospitalSubscriptionRepo.getDaysUntilExpiration(subscription),
        shouldShowWarning: hospitalSubscriptionRepo.shouldShowWarning(subscription),
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
