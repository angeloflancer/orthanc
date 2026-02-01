const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const HospitalSubscription = require('../models/HospitalSubscription');
const { protect } = require('../middleware/auth');
const { requireOwner } = require('../middleware/roleAuth');

// Get all users (Owner only)
router.get('/', protect, requireOwner(), async (req, res) => {
  try {
    const { role, blocked, search, page = 1, limit = 20 } = req.query;
    
    const query = {};

    // Default to doctors only for User Management list; owner is not in DB
    if (role && ['doctor', 'admin'].includes(role)) {
      query.role = role;
    } else {
      query.role = 'doctor';
    }
    
    // Filter by blocked status
    if (blocked === 'true') {
      query.blocked = true;
    } else if (blocked === 'false') {
      query.blocked = false;
    }
    
    // Search by username, name, or email
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const total = await User.countDocuments(query);
    
    const users = await User.find(query)
      .select('-password -emailVerificationToken -emailVerificationTokenExpiry')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        username: u.username,
        email: u.email,
        name: u.name,
        role: u.role,
        blocked: u.blocked,
        blockedBy: u.blockedBy,
        blockedReason: u.blockedReason,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single user details (Owner only)
router.get('/:id', protect, requireOwner(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationToken -emailVerificationTokenExpiry');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get additional info based on role
    let additionalInfo = {};
    
    if (user.role === 'admin') {
      const hospital = await Hospital.findOne({ admin: user._id });
      if (hospital) {
        const memberCount = await HospitalMember.countDocuments({ 
          hospital: hospital._id,
          status: 'accepted'
        });
        additionalInfo.hospital = {
          id: hospital._id,
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          memberCount
        };
      }
    } else if (user.role === 'doctor') {
      const membership = await HospitalMember.findOne({ user: user._id })
        .populate('hospital', 'hospitalId name');
      if (membership) {
        additionalInfo.hospitalMembership = {
          hospitalId: membership.hospital.hospitalId,
          hospitalName: membership.hospital.name,
          status: membership.status
        };
      }
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        blocked: user.blocked,
        blockedBy: user.blockedBy,
        blockedReason: user.blockedReason,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        ...additionalInfo
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update own role - disabled; only owner can assign admin via Hospital Management
router.put('/me/role', protect, async (req, res) => {
  return res.status(403).json({
    error: 'Role changes are not allowed. Contact the owner to change your role.'
  });
});

// Block user (Owner only)
router.put('/:id/block', protect, requireOwner(), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Can't block owner
    if (user.role === 'owner') {
      return res.status(400).json({ error: 'Cannot block owner account' });
    }
    
    // Can't block self (owner has no _id in DB)
    if (req.user._id && user._id.equals(req.user._id)) {
      return res.status(400).json({ error: 'Cannot block your own account' });
    }
    
    if (user.blocked && user.blockedBy === 'owner') {
      return res.status(400).json({ error: 'User is already blocked' });
    }
    
    user.blocked = true;
    user.blockedBy = 'owner';
    user.blockedReason = reason || '';
    await user.save();
    
    res.json({
      success: true,
      message: 'User blocked successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        blocked: user.blocked
      }
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock user (Owner only)
router.put('/:id/unblock', protect, requireOwner(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.blocked) {
      return res.status(400).json({ error: 'User is not blocked' });
    }
    
    user.blocked = false;
    user.blockedBy = null;
    user.blockedReason = '';
    await user.save();
    
    res.json({
      success: true,
      message: 'User unblocked successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        blocked: user.blocked
      }
    });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user info (Owner only)
router.put('/:id', protect, requireOwner(), async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Can't modify owner
    if (user.role === 'owner') {
      return res.status(400).json({ error: 'Cannot modify owner account' });
    }
    
    // Update name
    if (name !== undefined) {
      user.name = name;
    }
    
    // Update username
    if (username !== undefined && username.toLowerCase() !== user.username) {
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }
      
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }
      
      const usernameExists = await User.findOne({ username: username.toLowerCase() });
      if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      
      user.username = username.toLowerCase();
    }
    
    // Update email
    if (email !== undefined && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      
      user.email = email;
      user.emailVerified = false; // Reset verification when email changes
    }
    
    // Update password
    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      user.password = password; // Will be hashed by pre-save hook
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors)[0].message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user statistics (Owner only)
router.get('/stats/overview', protect, requireOwner(), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const doctorCount = await User.countDocuments({ role: 'doctor' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    const ownerCount = await User.countDocuments({ role: 'owner' });
    const blockedCount = await User.countDocuments({ blocked: true });
    const hospitalCount = await Hospital.countDocuments();
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        doctorCount,
        adminCount,
        ownerCount,
        blockedCount,
        hospitalCount
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get hospital info for admin user (Owner only)
router.get('/:id/hospital-info', protect, requireOwner(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'admin') {
      return res.status(400).json({ error: 'User is not an admin' });
    }
    
    const hospital = await Hospital.findOne({ admin: user._id });
    
    if (!hospital) {
      return res.json({
        success: true,
        hospital: null,
        message: 'Admin does not have a hospital'
      });
    }
    
    // Get member count
    const memberCount = await HospitalMember.countDocuments({ 
      hospital: hospital._id,
      status: 'accepted'
    });
    
    // Get subscription info
    const HospitalSubscription = require('../models/HospitalSubscription');
    const subscription = await HospitalSubscription.findOne({ hospital: hospital._id });
    
    // Get DICOM study count (all studies for this hospital)
    const DicomStudy = require('../models/DicomStudy');
    const dicomCount = await DicomStudy.countDocuments({
      hospital: hospital._id
    });
    
    // Get document count (all word files for this hospital)
    const WordFile = require('../models/WordFile');
    const documentCount = await WordFile.countDocuments({
      hospital: hospital._id
    });
    
    res.json({
      success: true,
      hospital: {
        id: hospital._id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        memberCount,
        dicomCount,
        documentCount,
        subscription: subscription ? {
          planType: subscription.planType,
          expiresAt: subscription.expiresAt,
          isActive: subscription.isActive,
          daysUntilExpiration: subscription.getDaysUntilExpiration(),
          shouldShowWarning: subscription.shouldShowWarning()
        } : null
      }
    });
  } catch (error) {
    console.error('Get hospital info error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Expire hospital subscription (Owner only)
router.post('/:id/expire-hospital', protect, requireOwner(), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'admin') {
      return res.status(400).json({ error: 'User is not an admin' });
    }
    
    const hospital = await Hospital.findOne({ admin: user._id });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Admin does not have a hospital' });
    }
    
    const HospitalSubscription = require('../models/HospitalSubscription');
    const subscription = await HospitalSubscription.findOne({ hospital: hospital._id });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found for this hospital' });
    }
    
    // Set expiration to past date (1 day ago)
    subscription.expiresAt = new Date();
    subscription.expiresAt.setDate(subscription.expiresAt.getDate() - 1);
    await subscription.save();
    
    res.json({
      success: true,
      message: 'Hospital subscription expired successfully',
      subscription: {
        id: subscription._id,
        planType: subscription.planType,
        expiresAt: subscription.expiresAt,
        isActive: subscription.isActive,
        daysUntilExpiration: subscription.getDaysUntilExpiration()
      }
    });
  } catch (error) {
    console.error('Expire hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
