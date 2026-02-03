const express = require('express');
const router = express.Router();
const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');
const userRepo = require('../db/userRepo');
const { protect } = require('../middleware/auth');
const { requireRole, requireHospitalAdmin } = require('../middleware/roleAuth');

// Get all hospital members (Admin only)
router.get('/', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const hospitalId = req.hospital.id || req.hospital._id;
    const query = { hospital: hospitalId };
    if (status && ['pending', 'pending_invitation', 'accepted', 'kicked', 'blocked'].includes(status)) {
      query.status = status;
    }
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (parseInt(page) - 1) * limitNum;
    const searchTerm = (search || '').trim().toLowerCase();
    const { rows: members, total: totalFromDb } = hospitalMemberRepo.find(
      query,
      { limit: searchTerm ? 10000 : limitNum, skip: searchTerm ? 0 : skip }
    );
    let withUser = members.map((m) => {
      const u = userRepo.findById(m.user);
      return {
        id: m.id,
        user: u ? { id: u.id, username: u.username, name: u.name, email: u.email } : null,
        status: m.status,
        invitedBy: m.invitedBy,
        joinedAt: m.joinedAt,
        statusChangedAt: m.statusChangedAt,
        createdAt: m.createdAt
      };
    });
    if (searchTerm) {
      withUser = withUser.filter((m) => {
        if (!m.user) return false;
        return (m.user.username && m.user.username.toLowerCase().includes(searchTerm)) ||
          (m.user.name && m.user.name.toLowerCase().includes(searchTerm)) ||
          (m.user.email && m.user.email.toLowerCase().includes(searchTerm));
      });
    }
    const total = searchTerm ? withUser.length : totalFromDb;
    const paginated = searchTerm ? withUser.slice(skip, skip + limitNum) : withUser;
    res.json({
      success: true,
      members: paginated,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Invite doctor by username (Admin only)
router.post('/invite', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    if (!req.hospital || (req.hospital.id == null && req.hospital._id == null)) {
      return res.status(404).json({ error: 'No hospital found. Please create a hospital first.' });
    }
    const hospitalId = req.hospital.id || req.hospital._id;
    const user = userRepo.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'doctor') return res.status(400).json({ error: 'Only doctors can be invited to a hospital' });
    if (user.blocked && user.blockedBy === 'owner') return res.status(400).json({ error: 'This user account is suspended' });
    const existingMembership = hospitalMemberRepo.findOne({ hospital: hospitalId, user: user.id });
    if (existingMembership) {
      if (existingMembership.status === 'accepted') {
        return res.status(400).json({ error: 'This doctor is already a member of your hospital' });
      }
      if (existingMembership.status === 'pending_invitation') {
        return res.status(400).json({ error: 'This doctor already has a pending invitation' });
      }
      if (existingMembership.status === 'pending' && existingMembership.invitedBy) {
        return res.status(400).json({ error: 'This doctor already has a pending invitation' });
      }
      if (existingMembership.status === 'blocked') {
        return res.status(400).json({ error: 'This doctor is blocked from your hospital' });
      }
      hospitalMemberRepo.update(existingMembership.id, {
        status: 'pending_invitation',
        invitedBy: req.user.id || req.user._id,
        statusChangedAt: Date.now()
      });
      return res.json({ success: true, message: 'Doctor re-invited successfully' });
    }
    const otherMembership = hospitalMemberRepo.findOne({ user: user.id, status: 'accepted' });
    if (otherMembership) {
      return res.status(400).json({ error: 'This doctor is already a member of another hospital' });
    }
    const membership = hospitalMemberRepo.create({
      hospital: hospitalId,
      user: user.id,
      status: 'pending_invitation',
      invitedBy: req.user.id || req.user._id
    });
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      membership: { id: membership.id, status: membership.status }
    });
  } catch (error) {
    console.error('Invite member error:', error);
    if (error.code === 'SQLITE_CONSTRAINT') return res.status(400).json({ error: 'This membership already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept pending member (Admin only) - Only for doctor-requested memberships
router.put('/:id/accept', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const hospitalId = req.hospital.id || req.hospital._id;
    const membership = hospitalMemberRepo.findById(req.params.id);
    if (!membership || membership.hospital !== hospitalId) return res.status(404).json({ error: 'Membership not found' });
    if (membership.status !== 'pending' || membership.invitedBy != null) {
      return res.status(400).json({
        error: 'Only doctor-requested memberships can be accepted by admin. Invited doctors must accept the invitation themselves.'
      });
    }
    hospitalMemberRepo.update(membership.id, { status: 'accepted', statusChangedAt: Date.now() });
    const updated = hospitalMemberRepo.findById(membership.id);
    const u = userRepo.findById(updated.user);
    res.json({
      success: true,
      message: 'Member accepted successfully',
      membership: {
        id: updated.id,
        user: u ? { id: u.id, username: u.username, name: u.name } : null,
        status: updated.status,
        joinedAt: updated.joinedAt
      }
    });
  } catch (error) {
    console.error('Accept member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Kick member (Admin only)
router.put('/:id/kick', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const hospitalId = req.hospital.id || req.hospital._id;
    const membership = hospitalMemberRepo.findById(req.params.id);
    if (!membership || membership.hospital !== hospitalId) return res.status(404).json({ error: 'Membership not found' });
    if (membership.status === 'kicked') return res.status(400).json({ error: 'Member is already kicked' });
    hospitalMemberRepo.update(membership.id, { status: 'kicked', statusChangedAt: Date.now() });
    res.json({ success: true, message: 'Member kicked successfully' });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block member (Admin only)
router.put('/:id/block', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const hospitalId = req.hospital.id || req.hospital._id;
    const membership = hospitalMemberRepo.findById(req.params.id);
    if (!membership || membership.hospital !== hospitalId) return res.status(404).json({ error: 'Membership not found' });
    if (membership.status === 'blocked') return res.status(400).json({ error: 'Member is already blocked' });
    hospitalMemberRepo.update(membership.id, { status: 'blocked', statusChangedAt: Date.now() });
    userRepo.update(membership.user, { blocked: true, blockedBy: 'admin' });
    res.json({ success: true, message: 'Member blocked successfully' });
  } catch (error) {
    console.error('Block member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock member (Admin only)
router.put('/:id/unblock', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const hospitalId = req.hospital.id || req.hospital._id;
    const membership = hospitalMemberRepo.findById(req.params.id);
    if (!membership || membership.hospital !== hospitalId) return res.status(404).json({ error: 'Membership not found' });
    if (membership.status !== 'blocked') return res.status(400).json({ error: 'Member is not blocked' });
    hospitalMemberRepo.update(membership.id, { status: 'kicked', statusChangedAt: Date.now() });
    const user = userRepo.findById(membership.user);
    if (user && user.blockedBy === 'admin') {
      userRepo.update(user.id, { blocked: false, blockedBy: null });
    }
    res.json({ success: true, message: 'Member unblocked successfully' });
  } catch (error) {
    console.error('Unblock member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join hospital by hospital ID (Doctor only)
router.post('/join', protect, requireRole('doctor'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    
    if (!hospitalId) return res.status(400).json({ error: 'Hospital ID is required' });
    const hospital = hospitalRepo.findOne({ hospitalId });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const userId = req.user.id || req.user._id;
    const existingAcceptedMembership = hospitalMemberRepo.findOne({ user: userId, status: 'accepted' });
    if (existingAcceptedMembership) return res.status(400).json({ error: 'You are already a member of a hospital' });
    const existingMembership = hospitalMemberRepo.findOne({ hospital: hospital.id, user: userId });
    if (existingMembership) {
      if (existingMembership.status === 'pending') return res.status(400).json({ error: 'You already have a pending request for this hospital' });
      if (existingMembership.status === 'blocked') return res.status(400).json({ error: 'You are blocked from this hospital' });
      hospitalMemberRepo.update(existingMembership.id, { status: 'pending', invitedBy: null, statusChangedAt: Date.now() });
      return res.json({ success: true, message: 'Join request sent successfully' });
    }
    const membership = hospitalMemberRepo.create({ hospital: hospital.id, user: userId, status: 'pending', invitedBy: null });
    res.status(201).json({
      success: true,
      message: 'Join request sent successfully. Waiting for admin approval.',
      membership: { id: membership.id, hospitalName: hospital.name, status: membership.status }
    });
  } catch (error) {
    console.error('Join hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get own membership status (Doctor only)
router.get('/my-membership', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const membership = hospitalMemberRepo.findOne({ user: userId }, { withHospital: true });
    if (!membership) return res.json({ success: true, membership: null });
    const invitedByUser = membership.invitedBy ? userRepo.findById(membership.invitedBy) : null;
    res.json({
      success: true,
      membership: {
        id: membership.id,
        hospital: membership.hospital ? {
          hospitalId: membership.hospital.hospitalId,
          name: membership.hospital.name,
          address: membership.hospital.address
        } : null,
        status: membership.status,
        invitedBy: invitedByUser ? { id: invitedByUser.id, name: invitedByUser.name, username: invitedByUser.username } : null,
        joinedAt: membership.joinedAt,
        createdAt: membership.createdAt
      }
    });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept invitation (Doctor only) - For admin-invited memberships
router.put('/accept-invitation', protect, requireRole('doctor'), async (req, res) => {
  try {
    const user = userRepo.findById(req.user.id || req.user._id);
    if (!user || !user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email address before accepting hospital invitations.' });
    }
    const membership = hospitalMemberRepo.findOne({ user: user.id, status: 'pending_invitation' }, { withHospital: true });
    if (!membership) return res.status(404).json({ error: 'No pending invitation found' });
    const otherMembership = hospitalMemberRepo.findOne({ user: user.id, status: 'accepted' });
    if (otherMembership && otherMembership.id !== membership.id) {
      return res.status(400).json({ error: 'You are already a member of another hospital' });
    }
    hospitalMemberRepo.update(membership.id, { status: 'accepted', statusChangedAt: Date.now() });
    const updated = hospitalMemberRepo.findById(membership.id);
    const hosp = membership.hospital;
    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      membership: {
        id: updated.id,
        hospital: hosp ? { hospitalId: hosp.hospitalId, name: hosp.name, address: hosp.address } : null,
        status: updated.status,
        joinedAt: updated.joinedAt
      }
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject/Cancel invitation (Doctor only)
router.put('/reject-invitation', protect, requireRole('doctor'), async (req, res) => {
  try {
    const user = userRepo.findById(req.user.id || req.user._id);
    if (!user || !user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email address before rejecting hospital invitations.' });
    }
    const membership = hospitalMemberRepo.findOne({ user: user.id, status: 'pending_invitation' });
    if (!membership) return res.status(404).json({ error: 'No pending invitation found' });
    hospitalMemberRepo.deleteById(membership.id);
    res.json({ success: true, message: 'Invitation rejected successfully' });
  } catch (error) {
    console.error('Reject invitation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave hospital (Doctor only)
router.delete('/leave', protect, requireRole('doctor'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const membership = hospitalMemberRepo.findOne({ user: userId });
    if (!membership) return res.status(404).json({ error: 'You are not a member of any hospital' });
    if (membership.status === 'pending_invitation') {
      return res.status(400).json({ error: 'Please use the reject invitation option to cancel pending invitations' });
    }
    if (membership.status !== 'pending' && membership.status !== 'accepted') {
      return res.status(400).json({ error: 'You cannot leave in your current status' });
    }
    hospitalMemberRepo.deleteById(membership.id);
    res.json({ success: true, message: 'You have left the hospital' });
  } catch (error) {
    console.error('Leave hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users by username (Admin only - for inviting)
router.get('/search-users', protect, requireRole('admin'), async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 2) return res.json({ success: true, users: [] });
    const users = userRepo.find({ role: 'doctor', blocked: false, search: username }, { limit: 10 });
    res.json({
      success: true,
      users: users.map(u => ({ id: u.id, username: u.username, name: u.name, email: u.email }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
