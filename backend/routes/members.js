const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { requireRole, requireHospitalAdmin } = require('../middleware/roleAuth');

// Get all hospital members (Admin only)
router.get('/', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    
    const query = { hospital: req.hospital._id };
    
    if (status && ['pending', 'accepted', 'kicked', 'blocked'].includes(status)) {
      query.status = status;
    }
    
    // Build the aggregation pipeline
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' }
    ];
    
    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userInfo.username': { $regex: search, $options: 'i' } },
            { 'userInfo.name': { $regex: search, $options: 'i' } },
            { 'userInfo.email': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await HospitalMember.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    
    // Add pagination and sorting
    pipeline.push(
      { $sort: { createdAt: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );
    
    const members = await HospitalMember.aggregate(pipeline);
    
    res.json({
      success: true,
      members: members.map(m => ({
        id: m._id,
        user: {
          id: m.userInfo._id,
          username: m.userInfo.username,
          name: m.userInfo.name,
          email: m.userInfo.email
        },
        status: m.status,
        invitedBy: m.invitedBy,
        joinedAt: m.joinedAt,
        statusChangedAt: m.statusChangedAt,
        createdAt: m.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
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
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Ensure hospital exists
    if (!req.hospital || !req.hospital._id) {
      return res.status(404).json({ error: 'No hospital found. Please create a hospital first.' });
    }
    
    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is a doctor
    if (user.role !== 'doctor') {
      return res.status(400).json({ error: 'Only doctors can be invited to a hospital' });
    }
    
    // Check if user is blocked by owner
    if (user.blocked && user.blockedBy === 'owner') {
      return res.status(400).json({ error: 'This user account is suspended' });
    }
    
    // Validate ObjectId format and convert to ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.hospital._id)) {
      return res.status(400).json({ error: 'Invalid hospital ID format' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(user._id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Convert to ObjectId to ensure proper type
    const hospitalId = new mongoose.Types.ObjectId(req.hospital._id);
    const userId = new mongoose.Types.ObjectId(user._id);
    const invitedById = new mongoose.Types.ObjectId(req.user._id);
    
    // Check if membership already exists
    const existingMembership = await HospitalMember.findOne({ 
      hospital: hospitalId,
      user: userId
    });
    
    if (existingMembership) {
      if (existingMembership.status === 'accepted') {
        return res.status(400).json({ error: 'This doctor is already a member of your hospital' });
      }
      if (existingMembership.status === 'pending') {
        return res.status(400).json({ error: 'This doctor already has a pending invitation' });
      }
      if (existingMembership.status === 'blocked') {
        return res.status(400).json({ error: 'This doctor is blocked from your hospital' });
      }
      
      // If kicked, allow re-invite
      existingMembership.status = 'pending';
      existingMembership.invitedBy = invitedById;
      await existingMembership.save();
      
      return res.json({
        success: true,
        message: 'Doctor re-invited successfully'
      });
    }
    
    // Check if user is already a member of another hospital
    const otherMembership = await HospitalMember.findOne({ 
      user: userId,
      status: 'accepted'
    });
    
    if (otherMembership) {
      return res.status(400).json({ error: 'This doctor is already a member of another hospital' });
    }
    
    // Create membership
    const membership = await HospitalMember.create({
      hospital: hospitalId,
      user: userId,
      status: 'pending',
      invitedBy: invitedById
    });
    
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      membership: {
        id: membership._id,
        status: membership.status
      }
    });
  } catch (error) {
    console.error('Invite member error:', error);
    console.error('Error details:', {
      code: error.code,
      keyPattern: error.keyPattern,
      keyValue: error.keyValue,
      message: error.message
    });
    
    // Handle duplicate key error
    if (error.code === 11000) {
      // Check if it's a null duplicate key error (corrupted data or index mismatch)
      if (error.keyValue && (error.keyValue.hospital === null || error.keyValue.user === null || 
          error.keyValue.hospitalId === null || error.keyValue.userId === null)) {
        console.error('Database index mismatch detected. Index uses hospitalId/userId but schema uses hospital/user.');
        return res.status(500).json({ 
          error: 'Database configuration error. Please contact administrator to fix the database index.' 
        });
      }
      
      // Check if the error is due to index field name mismatch
      if (error.keyPattern && (error.keyPattern.hospitalId || error.keyPattern.userId)) {
        console.error('Index field name mismatch: database has hospitalId/userId index but schema uses hospital/user');
        return res.status(500).json({ 
          error: 'Database index mismatch. Please contact administrator to recreate the index.' 
        });
      }
      
      // Regular duplicate key error
      return res.status(400).json({ error: 'This membership already exists' });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: Object.values(error.errors).map(e => e.message).join(', ') 
      });
    }
    
    // Handle custom errors
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept pending member (Admin only)
router.put('/:id/accept', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const membership = await HospitalMember.findOne({ 
      _id: req.params.id,
      hospital: req.hospital._id
    }).populate('user', 'username name email');
    
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    
    if (membership.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending memberships can be accepted' });
    }
    
    membership.status = 'accepted';
    await membership.save();
    
    res.json({
      success: true,
      message: 'Member accepted successfully',
      membership: {
        id: membership._id,
        user: {
          id: membership.user._id,
          username: membership.user.username,
          name: membership.user.name
        },
        status: membership.status,
        joinedAt: membership.joinedAt
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
    const membership = await HospitalMember.findOne({ 
      _id: req.params.id,
      hospital: req.hospital._id
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    
    if (membership.status === 'kicked') {
      return res.status(400).json({ error: 'Member is already kicked' });
    }
    
    membership.status = 'kicked';
    await membership.save();
    
    res.json({
      success: true,
      message: 'Member kicked successfully'
    });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block member (Admin only)
router.put('/:id/block', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const membership = await HospitalMember.findOne({ 
      _id: req.params.id,
      hospital: req.hospital._id
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    
    if (membership.status === 'blocked') {
      return res.status(400).json({ error: 'Member is already blocked' });
    }
    
    membership.status = 'blocked';
    await membership.save();
    
    // Also update user's blocked status for hospital-level blocking
    await User.findByIdAndUpdate(membership.user, {
      $set: {
        blocked: true,
        blockedBy: 'admin'
      }
    });
    
    res.json({
      success: true,
      message: 'Member blocked successfully'
    });
  } catch (error) {
    console.error('Block member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock member (Admin only)
router.put('/:id/unblock', protect, requireRole('admin'), requireHospitalAdmin(), async (req, res) => {
  try {
    const membership = await HospitalMember.findOne({ 
      _id: req.params.id,
      hospital: req.hospital._id
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }
    
    if (membership.status !== 'blocked') {
      return res.status(400).json({ error: 'Member is not blocked' });
    }
    
    membership.status = 'kicked'; // Move to kicked status after unblock
    await membership.save();
    
    // Remove admin-level block from user
    const user = await User.findById(membership.user);
    if (user && user.blockedBy === 'admin') {
      user.blocked = false;
      user.blockedBy = null;
      await user.save();
    }
    
    res.json({
      success: true,
      message: 'Member unblocked successfully'
    });
  } catch (error) {
    console.error('Unblock member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join hospital by hospital ID (Doctor only)
router.post('/join', protect, requireRole('doctor'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    
    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }
    
    // Find hospital
    const hospital = await Hospital.findOne({ hospitalId });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    // Check if already a member of any hospital
    const existingAcceptedMembership = await HospitalMember.findOne({ 
      user: req.user._id,
      status: 'accepted'
    });
    
    if (existingAcceptedMembership) {
      return res.status(400).json({ error: 'You are already a member of a hospital' });
    }
    
    // Check if membership already exists for this hospital
    const existingMembership = await HospitalMember.findOne({ 
      hospital: hospital._id,
      user: req.user._id
    });
    
    if (existingMembership) {
      if (existingMembership.status === 'pending') {
        return res.status(400).json({ error: 'You already have a pending request for this hospital' });
      }
      if (existingMembership.status === 'blocked') {
        return res.status(400).json({ error: 'You are blocked from this hospital' });
      }
      
      // If kicked, allow re-request
      existingMembership.status = 'pending';
      existingMembership.invitedBy = null; // User requested, not invited
      await existingMembership.save();
      
      return res.json({
        success: true,
        message: 'Join request sent successfully'
      });
    }
    
    // Create membership request
    const membership = await HospitalMember.create({
      hospital: hospital._id,
      user: req.user._id,
      status: 'pending',
      invitedBy: null // User requested, not invited
    });
    
    res.status(201).json({
      success: true,
      message: 'Join request sent successfully. Waiting for admin approval.',
      membership: {
        id: membership._id,
        hospitalName: hospital.name,
        status: membership.status
      }
    });
  } catch (error) {
    console.error('Join hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get own membership status (Doctor only)
router.get('/my-membership', protect, async (req, res) => {
  try {
    const membership = await HospitalMember.findOne({ 
      user: req.user._id
    }).populate('hospital', 'hospitalId name address');
    
    if (!membership) {
      return res.json({
        success: true,
        membership: null
      });
    }
    
    res.json({
      success: true,
      membership: {
        id: membership._id,
        hospital: {
          hospitalId: membership.hospital.hospitalId,
          name: membership.hospital.name,
          address: membership.hospital.address
        },
        status: membership.status,
        joinedAt: membership.joinedAt,
        createdAt: membership.createdAt
      }
    });
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave hospital (Doctor only)
router.delete('/leave', protect, requireRole('doctor'), async (req, res) => {
  try {
    const membership = await HospitalMember.findOne({ 
      user: req.user._id,
      status: { $in: ['pending', 'accepted'] }
    });
    
    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of any hospital' });
    }
    
    await HospitalMember.findByIdAndDelete(membership._id);
    
    res.json({
      success: true,
      message: 'You have left the hospital'
    });
  } catch (error) {
    console.error('Leave hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users by username (Admin only - for inviting)
router.get('/search-users', protect, requireRole('admin'), async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username || username.length < 2) {
      return res.json({ success: true, users: [] });
    }
    
    const users = await User.find({
      username: { $regex: username, $options: 'i' },
      role: 'doctor',
      blocked: { $ne: true }
    })
    .select('username name email')
    .limit(10);
    
    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        username: u.username,
        name: u.name,
        email: u.email
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
