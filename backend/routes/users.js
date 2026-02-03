const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const userRepo = require('../db/userRepo');
const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');
const hospitalSubscriptionRepo = require('../db/hospitalSubscriptionRepo');
const dicomStudyRepo = require('../db/dicomStudyRepo');
const wordFileRepo = require('../db/wordFileRepo');
const { protect } = require('../middleware/auth');
const { requireOwner } = require('../middleware/roleAuth');

// Get all users (Owner only)
router.get('/', protect, requireOwner(), async (req, res) => {
  try {
    const { role, blocked, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) {
      const roles = role.split(',').map(r => r.trim()).filter(r => ['doctor', 'admin'].includes(r));
      if (roles.length === 1) query.role = roles[0];
      else if (roles.length > 1) query.role = roles;
      else query.role = 'doctor';
    } else {
      query.role = 'doctor';
    }
    if (blocked === 'true') query.blocked = true;
    else if (blocked === 'false') query.blocked = false;
    if (search) query.search = search;
    const limitNum = parseInt(limit) || 20;
    const skip = (parseInt(page) - 1) * limitNum;
    const total = userRepo.countDocuments(query);
    const users = userRepo.find(query, { limit: limitNum, skip });
    res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
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
      pagination: { page: parseInt(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user statistics (Owner only) - must be before /:id
router.get('/stats/overview', protect, requireOwner(), async (req, res) => {
  try {
    const totalUsers = userRepo.countDocuments();
    const doctorCount = userRepo.countDocuments({ role: 'doctor' });
    const adminCount = userRepo.countDocuments({ role: 'admin' });
    const ownerCount = 0;
    const blockedCount = userRepo.countDocuments({ blocked: true });
    const hospitalCount = hospitalRepo.countDocuments();
    res.json({
      success: true,
      stats: { totalUsers, doctorCount, adminCount, ownerCount, blockedCount, hospitalCount }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single user details (Owner only)
router.get('/:id', protect, requireOwner(), async (req, res) => {
  try {
    const user = userRepo.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, emailVerificationToken, emailVerificationTokenExpiry, ...safe } = user;
    let additionalInfo = {};
    if (user.role === 'admin') {
      const hospital = hospitalRepo.findOne({ admin: user.id });
      if (hospital) {
        const { rows: members } = hospitalMemberRepo.find({ hospital: hospital.id }, { limit: 1000 });
        const memberCount = members.filter(m => m.status === 'accepted').length;
        additionalInfo.hospital = { id: hospital.id, hospitalId: hospital.hospitalId, name: hospital.name, memberCount };
      }
    } else if (user.role === 'doctor') {
      const membership = hospitalMemberRepo.findOne({ user: user.id }, { withHospital: true });
      if (membership && membership.hospital) {
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
        id: safe.id,
        username: safe.username,
        email: safe.email,
        name: safe.name,
        role: safe.role,
        blocked: safe.blocked,
        blockedBy: safe.blockedBy,
        blockedReason: safe.blockedReason,
        emailVerified: safe.emailVerified,
        createdAt: safe.createdAt,
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
    const user = userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'owner') return res.status(400).json({ error: 'Cannot block owner account' });
    if (req.user.id && Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot block your own account' });
    }
    if (user.blocked && user.blockedBy === 'owner') {
      return res.status(400).json({ error: 'User is already blocked' });
    }
    userRepo.update(user.id, { blocked: true, blockedBy: 'owner', blockedReason: reason || '' });
    const updated = userRepo.findById(user.id);
    res.json({
      success: true,
      message: 'User blocked successfully',
      user: { id: updated.id, username: updated.username, name: updated.name, blocked: updated.blocked }
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock user (Owner only)
router.put('/:id/unblock', protect, requireOwner(), async (req, res) => {
  try {
    const user = userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.blocked) return res.status(400).json({ error: 'User is not blocked' });
    userRepo.update(user.id, { blocked: false, blockedBy: null, blockedReason: '' });
    const updated = userRepo.findById(user.id);
    res.json({
      success: true,
      message: 'User unblocked successfully',
      user: { id: updated.id, username: updated.username, name: updated.name, blocked: updated.blocked }
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
    const user = userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'owner') return res.status(400).json({ error: 'Cannot modify owner account' });
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (username !== undefined && username.toLowerCase() !== user.username) {
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }
      const usernameExists = userRepo.findOne({ username: username.toLowerCase() });
      if (usernameExists && usernameExists.id !== user.id) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      updates.username = username.toLowerCase();
    }
    if (email !== undefined && email !== user.email) {
      const emailExists = userRepo.findOne({ email });
      if (emailExists && emailExists.id !== user.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.email = email;
      updates.emailVerified = false;
    }
    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      updates.password = await bcrypt.hash(password, 10);
    }
    userRepo.update(user.id, updates);
    const updated = userRepo.findById(user.id);
    res.json({
      success: true,
      message: 'User updated successfully',
      user: { id: updated.id, username: updated.username, name: updated.name, email: updated.email, role: updated.role }
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Username or email already in use' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Get hospital info for admin user (Owner only)
router.get('/:id/hospital-info', protect, requireOwner(), async (req, res) => {
  try {
    const user = userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });
    const hospital = hospitalRepo.findOne({ admin: user.id });
    if (!hospital) {
      return res.json({ success: true, hospital: null, message: 'Admin does not have a hospital' });
    }
    const { rows: members } = hospitalMemberRepo.find({ hospital: hospital.id }, { limit: 10000 });
    const memberCount = members.filter(m => m.status === 'accepted').length;
    const subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    const dicomCount = dicomStudyRepo.countDocuments({ hospital: hospital.id });
    const documentCount = wordFileRepo.countDocuments({ hospital: hospital.id });
    res.json({
      success: true,
      hospital: {
        id: hospital.id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        memberCount,
        dicomCount,
        documentCount,
        subscription: subscription ? {
          planType: subscription.planType,
          expiresAt: subscription.expiresAt,
          isActive: hospitalSubscriptionRepo.isActive(subscription),
          daysUntilExpiration: hospitalSubscriptionRepo.getDaysUntilExpiration(subscription),
          shouldShowWarning: hospitalSubscriptionRepo.shouldShowWarning(subscription)
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
    const user = userRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });
    const hospital = hospitalRepo.findOne({ admin: user.id });
    if (!hospital) return res.status(404).json({ error: 'Admin does not have a hospital' });
    const subscription = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    if (!subscription) return res.status(404).json({ error: 'No subscription found for this hospital' });
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    hospitalSubscriptionRepo.update(subscription.hospital, { expiresAt: oneDayAgo });
    const updated = hospitalSubscriptionRepo.findOne({ hospital: hospital.id });
    res.json({
      success: true,
      message: 'Hospital subscription expired successfully',
      subscription: {
        id: updated.id,
        planType: updated.planType,
        expiresAt: updated.expiresAt,
        isActive: hospitalSubscriptionRepo.isActive(updated),
        daysUntilExpiration: hospitalSubscriptionRepo.getDaysUntilExpiration(updated)
      }
    });
  } catch (error) {
    console.error('Expire hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
