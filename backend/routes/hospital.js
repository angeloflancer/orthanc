const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const User = require('../models/User');
const HospitalSubscription = require('../models/HospitalSubscription');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireRole, requireOwner } = require('../middleware/roleAuth');
const orthancClient = require('../utils/orthancClient');
const subscriptionService = require('../utils/subscriptionService');

// Create hospital (Owner only, and only when no hospital exists)
// Server allows only one hospital. Owner can create it when there are none; when one exists, owner can only delete it.
// Body: { name, address, adminUserId }
router.post('/', protect, requireOwner(), async (req, res) => {
  try {
    const { name, address, adminUserId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Hospital name is required' });
    }

    const existingCount = await Hospital.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({
        error: 'Only one hospital is allowed on this server. Delete the existing hospital first if you want to create a new one.'
      });
    }

    if (!adminUserId) {
      return res.status(400).json({ error: 'adminUserId is required.' });
    }
    const adminUser = await User.findById(adminUserId);
    if (!adminUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (adminUser.blocked && adminUser.blockedBy === 'owner') {
      return res.status(400).json({ error: 'Cannot assign a suspended user as hospital admin.' });
    }
    if (adminUser.role !== 'doctor' && adminUser.role !== 'admin') {
      return res.status(400).json({ error: 'Only a doctor or admin can be assigned as hospital admin.' });
    }
    const existingHospital = await Hospital.findOne({ admin: adminUser._id });
    if (existingHospital) {
      return res.status(400).json({
        error: 'That user is already the admin of a hospital.'
      });
    }

    const hospital = await Hospital.create({
      name,
      address: address || '',
      admin: adminUser._id
    });
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin';
      await adminUser.save();
    }
    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      hospital: {
        id: hospital._id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        createdAt: hospital.createdAt
      }
    });
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get admin's hospital (admin/owner) or list all hospitals (owner only via /all)
router.get('/', protect, requireRole('admin', 'owner'), async (req, res) => {
  try {
    // Owner has no _id; they use GET /all for listing. Here they get null.
    const hospital = await Hospital.findOne({ admin: req.user._id })
      .populate('admin', 'name email username');

    if (!hospital) {
      return res.json({
        success: true,
        hospital: null
      });
    }

    const memberCount = await HospitalMember.countDocuments({
      hospital: hospital._id,
      status: 'accepted'
    });

    const pendingCount = await HospitalMember.countDocuments({
      hospital: hospital._id,
      status: 'pending'
    });

    res.json({
      success: true,
      hospital: {
        id: hospital._id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        admin: {
          id: hospital.admin._id,
          name: hospital.admin.name,
          email: hospital.admin.email,
          username: hospital.admin.username
        },
        memberCount,
        pendingCount,
        createdAt: hospital.createdAt,
        updatedAt: hospital.updatedAt
      }
    });
  } catch (error) {
    console.error('Get hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a hospital by ID (Owner only)
router.delete('/:hospitalId', protect, requireOwner(), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const DicomStudy = require('../models/DicomStudy');
    const WordFile = require('../models/WordFile');
    const Patient = require('../models/Patient');
    const fs = require('fs');

    const dicomStudies = await DicomStudy.find({ hospital: hospital._id }).select('orthancStudyId');
    for (const study of dicomStudies) {
      if (study.orthancStudyId) {
        try {
          await orthancClient.delete(`/studies/${study.orthancStudyId}`);
        } catch (err) {
          console.error(`Error deleting study ${study.orthancStudyId} from Orthanc:`, err.message);
        }
      }
    }
    const wordFiles = await WordFile.find({ hospital: hospital._id }).select('filePath');
    for (const wordFile of wordFiles) {
      if (wordFile.filePath && fs.existsSync(wordFile.filePath)) {
        try {
          fs.unlinkSync(wordFile.filePath);
        } catch (err) {
          console.error(`Error deleting file ${wordFile.filePath}:`, err.message);
        }
      }
    }
    await DicomStudy.deleteMany({ hospital: hospital._id });
    await WordFile.deleteMany({ hospital: hospital._id });
    await Patient.deleteMany({ hospital: hospital._id });
    await HospitalSubscription.deleteOne({ hospital: hospital._id });
    await HospitalMember.deleteMany({ hospital: hospital._id });
    await Hospital.findByIdAndDelete(hospital._id);

    if (hospital.admin) {
      await User.findByIdAndUpdate(hospital.admin, { $set: { role: 'doctor' } });
    }

    res.json({
      success: true,
      message: 'Hospital and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete hospital by ID error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all hospitals (Owner only) - for Hospital Management (paginated)
router.get('/all', protect, requireOwner(), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await Hospital.countDocuments();
    const hospitals = await Hospital.find()
      .populate('admin', 'name email username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const result = await Promise.all(hospitals.map(async (h) => {
      // Use subscription service (handles decryption)
      const subscriptionInfo = await subscriptionService.getSubscriptionForApi(h._id);
      const memberCount = await HospitalMember.countDocuments({
        hospital: h._id,
        status: 'accepted'
      });
      const pendingCount = await HospitalMember.countDocuments({
        hospital: h._id,
        status: { $in: ['pending', 'pending_invitation'] }
      });
      return {
        id: h._id,
        hospitalId: h.hospitalId,
        name: h.name,
        address: h.address,
        admin: h.admin ? {
          id: h.admin._id,
          username: h.admin.username,
          name: h.admin.name,
          email: h.admin.email
        } : null,
        memberCount,
        pendingCount,
        subscription: subscriptionInfo,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt
      };
    }));

    res.json({
      success: true,
      hospitals: result,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Get all hospitals error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----- Owner-only: manage members of any hospital -----

// Get members of a hospital (Owner only) (paginated)
router.get('/:hospitalId/members', protect, requireOwner(), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await HospitalMember.countDocuments({ hospital: hospital._id });
    const members = await HospitalMember.find({ hospital: hospital._id })
      .populate('user', 'username name email')
      .sort({ status: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json({
      success: true,
      members: members.map(m => ({
        id: m._id,
        user: m.user ? {
          id: m.user._id,
          username: m.user.username,
          name: m.user.name,
          email: m.user.email
        } : null,
        status: m.status,
        joinedAt: m.joinedAt,
        statusChangedAt: m.statusChangedAt,
        createdAt: m.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    console.error('Get hospital members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Invite doctor to hospital by username (Owner only)
router.post('/:hospitalId/members/invite', protect, requireOwner(), async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({ error: 'Only doctors can be invited to a hospital' });
    }
    if (user.blocked && user.blockedBy === 'owner') {
      return res.status(400).json({ error: 'This user account is suspended' });
    }
    const existing = await HospitalMember.findOne({ hospital: hospital._id, user: user._id });
    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'This doctor is already a member' });
      }
      if (existing.status === 'pending_invitation') {
        return res.status(400).json({ error: 'This doctor already has a pending invitation' });
      }
      if (existing.status === 'blocked') {
        return res.status(400).json({ error: 'This doctor is blocked from this hospital' });
      }
      existing.status = 'pending_invitation';
      existing.invitedBy = req.user._id || null;
      existing.statusChangedAt = new Date();
      await existing.save();
      return res.json({ success: true, message: 'Re-invitation sent' });
    }
    const otherAccepted = await HospitalMember.findOne({ user: user._id, status: 'accepted' });
    if (otherAccepted) {
      return res.status(400).json({ error: 'This doctor is already a member of another hospital' });
    }
    await HospitalMember.create({
      hospital: hospital._id,
      user: user._id,
      status: 'pending_invitation',
      invitedBy: req.user._id || null
    });
    res.status(201).json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite to hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Kick member (Owner only)
router.put('/:hospitalId/members/:memberId/kick', protect, requireOwner(), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const membership = await HospitalMember.findOne({
      _id: req.params.memberId,
      hospital: hospital._id
    });
    if (!membership) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (membership.status === 'kicked') {
      return res.status(400).json({ error: 'Member is already kicked' });
    }
    membership.status = 'kicked';
    await membership.save();
    res.json({ success: true, message: 'Member kicked successfully' });
  } catch (error) {
    console.error('Kick member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Block member (Owner only) - also sets user.blockedBy = 'owner' for app-wide block
router.put('/:hospitalId/members/:memberId/block', protect, requireOwner(), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const membership = await HospitalMember.findOne({
      _id: req.params.memberId,
      hospital: hospital._id
    }).populate('user');
    if (!membership) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (membership.status === 'blocked') {
      return res.status(400).json({ error: 'Member is already blocked' });
    }
    membership.status = 'blocked';
    await membership.save();
    await User.findByIdAndUpdate(membership.user._id, {
      $set: { blocked: true, blockedBy: 'owner' }
    });
    res.json({ success: true, message: 'Member blocked successfully' });
  } catch (error) {
    console.error('Block member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unblock member (Owner only)
router.put('/:hospitalId/members/:memberId/unblock', protect, requireOwner(), async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const membership = await HospitalMember.findOne({
      _id: req.params.memberId,
      hospital: hospital._id
    });
    if (!membership) {
      return res.status(404).json({ error: 'Member not found' });
    }
    if (membership.status !== 'blocked') {
      return res.status(400).json({ error: 'Member is not blocked' });
    }
    membership.status = 'kicked';
    await membership.save();
    const user = await User.findById(membership.user);
    if (user && user.blockedBy === 'owner') {
      user.blocked = false;
      user.blockedBy = null;
      await user.save();
    }
    res.json({ success: true, message: 'Member unblocked successfully' });
  } catch (error) {
    console.error('Unblock member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update hospital
router.put('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { name, address } = req.body;
    
    const hospital = await Hospital.findOne({ admin: req.user._id });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    if (name) hospital.name = name;
    if (address !== undefined) hospital.address = address;
    
    await hospital.save();
    
    res.json({
      success: true,
      message: 'Hospital updated successfully',
      hospital: {
        id: hospital._id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        updatedAt: hospital.updatedAt
      }
    });
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete hospital
router.delete('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ admin: req.user._id });
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    const DicomStudy = require('../models/DicomStudy');
    const WordFile = require('../models/WordFile');
    const Patient = require('../models/Patient');
    const fs = require('fs');
    const path = require('path');
    
    // Get all DICOM studies for this hospital
    const dicomStudies = await DicomStudy.find({ hospital: hospital._id }).select('orthancStudyId');
    
    // Delete studies from Orthanc (uses IPv4 localhost via orthancClient)
    for (const study of dicomStudies) {
      if (study.orthancStudyId) {
        try {
          await orthancClient.delete(`/studies/${study.orthancStudyId}`);
        } catch (err) {
          console.error(`Error deleting study ${study.orthancStudyId} from Orthanc:`, err.message);
          // Continue with deletion even if Orthanc deletion fails
        }
      }
    }
    
    // Get all Word files for this hospital
    const wordFiles = await WordFile.find({ hospital: hospital._id }).select('filePath');
    
    // Delete physical Word files from filesystem
    for (const wordFile of wordFiles) {
      if (wordFile.filePath && fs.existsSync(wordFile.filePath)) {
        try {
          fs.unlinkSync(wordFile.filePath);
        } catch (err) {
          console.error(`Error deleting file ${wordFile.filePath}:`, err.message);
          // Continue with deletion even if file deletion fails
        }
      }
    }
    
    // Delete all data records
    await DicomStudy.deleteMany({ hospital: hospital._id });
    await WordFile.deleteMany({ hospital: hospital._id });
    await Patient.deleteMany({ hospital: hospital._id });
    
    // Delete subscription
    const HospitalSubscription = require('../models/HospitalSubscription');
    await HospitalSubscription.deleteOne({ hospital: hospital._id });
    
    // Delete all memberships associated with this hospital
    await HospitalMember.deleteMany({ hospital: hospital._id });
    
    // Delete the hospital
    await Hospital.findByIdAndDelete(hospital._id);
    
    res.json({
      success: true,
      message: 'Hospital and all associated data deleted successfully'
    });
  } catch (error) {
    console.error('Delete hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set hospital admin (Owner only) - reassign who is admin of this hospital
router.put('/:hospitalId/admin', protect, requireOwner(), async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const newAdmin = await User.findById(userId);
    if (!newAdmin) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (newAdmin.role !== 'doctor' && newAdmin.role !== 'admin') {
      return res.status(400).json({ error: 'User must be a doctor or current admin to be assigned as hospital admin' });
    }

    const previousAdminId = hospital.admin ? hospital.admin.toString() : null;
    if (previousAdminId === userId) {
      return res.status(400).json({ error: 'User is already the admin of this hospital' });
    }

    // If there was a previous admin, demote to doctor (hospital is reassigned, not deleted)
    if (previousAdminId) {
      const previousAdmin = await User.findById(previousAdminId);
      if (previousAdmin) {
        previousAdmin.role = 'doctor';
        await previousAdmin.save();
      }
      await HospitalMember.deleteMany({ hospital: hospital._id, user: previousAdminId });
    }

    // If new admin was doctor, remove from any hospital membership
    if (newAdmin.role === 'doctor') {
      await HospitalMember.deleteMany({ user: newAdmin._id });
    }

    hospital.admin = newAdmin._id;
    await hospital.save();

    newAdmin.role = 'admin';
    await newAdmin.save();

    res.json({
      success: true,
      message: 'Hospital admin updated successfully',
      hospital: {
        id: hospital._id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        admin: {
          id: newAdmin._id,
          username: newAdmin.username,
          name: newAdmin.name,
          email: newAdmin.email
        }
      }
    });
  } catch (error) {
    console.error('Set hospital admin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Find hospital by ID (for doctors to join)
router.get('/find/:hospitalId', protect, async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    const hospital = await Hospital.findOne({ hospitalId })
      .populate('admin', 'name');
    
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    
    res.json({
      success: true,
      hospital: {
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        adminName: hospital.admin.name
      }
    });
  } catch (error) {
    console.error('Find hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
