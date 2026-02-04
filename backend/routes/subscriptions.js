const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const { protect } = require('../middleware/auth');
const { requireOwner } = require('../middleware/roleAuth');
const subscriptionService = require('../utils/subscriptionService');

/**
 * Check if subscription expires in 3 days or less
 * GET /api/subscriptions/check-expiration
 * This route must come BEFORE /:hospitalId to avoid route conflicts
 */
router.get('/check-expiration', protect, async (req, res) => {
  try {
    let hospital = null;
    
    // Get hospital based on user role
    if (req.user.role === 'admin') {
      hospital = await Hospital.findOne({ admin: req.user._id });
    } else if (req.user.role === 'doctor') {
      const HospitalMember = require('../models/HospitalMember');
      const membership = await HospitalMember.findOne({
        user: req.user._id,
        status: 'accepted'
      }).populate('hospital');
      if (membership) {
        hospital = membership.hospital;
      }
    }
    
    if (!hospital) {
      return res.json({
        success: true,
        hasWarning: false,
        message: 'No hospital found'
      });
    }
    
    // Use subscription service (handles decryption)
    const subscription = await subscriptionService.loadSubscription(hospital._id);
    
    if (!subscription) {
      return res.json({
        success: true,
        hasWarning: false,
        message: 'No subscription found'
      });
    }
    
    res.json({
      success: true,
      hasWarning: subscription.shouldShowWarning,
      daysUntilExpiration: subscription.daysUntilExpiration,
      planType: subscription.planType,
      expiresAt: subscription.expiresAt,
      isActive: subscription.isActive,
      message: subscription.shouldShowWarning 
        ? `There are ${subscription.daysUntilExpiration} days left until the deadline. Please contact the administrator to extend the deadline.`
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
      return res.status(400).json({ 
        error: 'Invalid plan type. Must be monthly, yearly, or forever.' 
      });
    }
    
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Calculate expiration date
    let expiresAt = null;
    if (planType === 'monthly') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else if (planType === 'yearly') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);
    }
    // forever plans have expiresAt = null
    
    // Use subscription service to save (handles encryption)
    const subscription = await subscriptionService.saveSubscription(
      hospital._id,
      planType,
      expiresAt
    );
    
    res.json({
      success: true,
      message: 'Subscription created/updated successfully',
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        expiresAt: subscription.expiresAt,
        isActive: subscription.isActive,
        daysUntilExpiration: subscription.daysUntilExpiration,
        shouldShowWarning: subscription.shouldShowWarning
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
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Check if user has permission to view this subscription
    // Owner can view any, admin can view their own, doctor can view their hospital's
    if (req.user.role === 'owner') {
      // Owner can view any
    } else if (req.user.role === 'admin') {
      if (!hospital.admin.equals(req.user._id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (req.user.role === 'doctor') {
      const HospitalMember = require('../models/HospitalMember');
      const membership = await HospitalMember.findOne({
        user: req.user._id,
        hospital: hospital._id,
        status: 'accepted'
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Use subscription service (handles decryption)
    const subscription = await subscriptionService.loadSubscription(hospital._id);
    
    if (!subscription) {
      return res.json({
        success: true,
        subscription: null,
        message: 'No subscription found for this hospital'
      });
    }
    
    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        expiresAt: subscription.expiresAt,
        isActive: subscription.isActive,
        daysUntilExpiration: subscription.daysUntilExpiration,
        shouldShowWarning: subscription.shouldShowWarning,
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
