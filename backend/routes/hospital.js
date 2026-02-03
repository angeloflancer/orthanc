const express = require('express');
const router = express.Router();
const fs = require('fs');
const hospitalRepo = require('../db/hospitalRepo');
const hospitalMemberRepo = require('../db/hospitalMemberRepo');
const hospitalSubscriptionRepo = require('../db/hospitalSubscriptionRepo');
const userRepo = require('../db/userRepo');
const patientRepo = require('../db/patientRepo');
const dicomStudyRepo = require('../db/dicomStudyRepo');
const wordFileRepo = require('../db/wordFileRepo');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireRole, requireOwner } = require('../middleware/roleAuth');
const orthancClient = require('../utils/orthancClient');

function getHospitalByParam(param) {
  const id = param;
  if (/^\d+$/.test(String(id))) return hospitalRepo.findById(Number(id));
  return hospitalRepo.findOne({ hospitalId: id });
}

// Create hospital (Owner only, and only when no hospital exists)
// Server allows only one hospital. Owner can create it when there are none; when one exists, owner can only delete it.
// Body: { name, address, adminUserId }
router.post('/', protect, requireOwner(), async (req, res) => {
  try {
    const { name, address, adminUserId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Hospital name is required' });
    }

    const existingCount = hospitalRepo.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({
        error: 'Only one hospital is allowed on this server. Delete the existing hospital first if you want to create a new one.'
      });
    }
    if (!adminUserId) {
      return res.status(400).json({ error: 'adminUserId is required.' });
    }
    const adminUser = userRepo.findById(adminUserId);
    if (!adminUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (adminUser.blocked && adminUser.blockedBy === 'owner') {
      return res.status(400).json({ error: 'Cannot assign a suspended user as hospital admin.' });
    }
    if (adminUser.role !== 'doctor' && adminUser.role !== 'admin') {
      return res.status(400).json({ error: 'Only a doctor or admin can be assigned as hospital admin.' });
    }
    const existingHospital = hospitalRepo.findOne({ admin: adminUser.id });
    if (existingHospital) {
      return res.status(400).json({ error: 'That user is already the admin of a hospital.' });
    }
    const hospital = hospitalRepo.create({ name, address: address || '', admin: adminUser.id });
    if (adminUser.role !== 'admin') {
      userRepo.update(adminUser.id, { role: 'admin' });
    }
    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      hospital: {
        id: hospital.id,
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
    const userId = req.user.id || req.user._id;
    const hospital = hospitalRepo.findOne({ admin: userId });
    if (!hospital) {
      return res.json({ success: true, hospital: null });
    }
    const adminUser = userRepo.findById(hospital.admin);
    const memberCount = hospitalMemberRepo.countDocuments({ hospital: hospital.id, status: 'accepted' });
    const pendingCount = hospitalMemberRepo.countDocuments({ hospital: hospital.id, status: 'pending' });
    res.json({
      success: true,
      hospital: {
        id: hospital.id,
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        admin: adminUser ? { id: adminUser.id, name: adminUser.name, email: adminUser.email, username: adminUser.username } : null,
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
    const hospital = getHospitalByParam(req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }
    const dicomStudies = dicomStudyRepo.find({ hospital: hospital.id }, { limit: 10000 });
    for (const study of dicomStudies) {
      if (study.orthancStudyId) {
        try {
          await orthancClient.delete(`/studies/${study.orthancStudyId}`);
        } catch (err) {
          console.error(`Error deleting study ${study.orthancStudyId} from Orthanc:`, err.message);
        }
      }
    }
    const wordFiles = wordFileRepo.find({ hospital: hospital.id }, { limit: 10000 });
    for (const wordFile of wordFiles) {
      if (wordFile.filePath && fs.existsSync(wordFile.filePath)) {
        try {
          fs.unlinkSync(wordFile.filePath);
        } catch (err) {
          console.error(`Error deleting file ${wordFile.filePath}:`, err.message);
        }
      }
    }
    dicomStudyRepo.deleteMany({ hospital: hospital.id });
    wordFileRepo.deleteMany({ hospital: hospital.id });
    patientRepo.deleteMany({ hospital: hospital.id });
    hospitalSubscriptionRepo.deleteByHospital(hospital.id);
    hospitalMemberRepo.deleteMany({ hospital: hospital.id });
    hospitalRepo.deleteById(hospital.id);
    if (hospital.admin) {
      userRepo.update(hospital.admin, { role: 'doctor' });
    }
    res.json({ success: true, message: 'Hospital and all associated data deleted successfully' });
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
    const total = hospitalRepo.countDocuments();
    const hospitals = hospitalRepo.find({ limit, skip, order: 'desc' });
    const result = hospitals.map((h) => {
      const subscription = hospitalSubscriptionRepo.findOne({ hospital: h.id });
      const memberCount = hospitalMemberRepo.countDocuments({ hospital: h.id, status: 'accepted' });
      const pendingCount = hospitalMemberRepo.countDocuments({ hospital: h.id, status: 'pending' })
        + hospitalMemberRepo.countDocuments({ hospital: h.id, status: 'pending_invitation' });
      const adminUser = userRepo.findById(h.admin);
      return {
        id: h.id,
        hospitalId: h.hospitalId,
        name: h.name,
        address: h.address,
        admin: adminUser ? { id: adminUser.id, username: adminUser.username, name: adminUser.name, email: adminUser.email } : null,
        memberCount,
        pendingCount,
        subscription: subscription ? {
          planType: subscription.planType,
          expiresAt: subscription.expiresAt,
          isActive: hospitalSubscriptionRepo.isActive(subscription),
          daysUntilExpiration: hospitalSubscriptionRepo.getDaysUntilExpiration(subscription),
          shouldShowWarning: hospitalSubscriptionRepo.shouldShowWarning(subscription)
        } : null,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt
      };
    });
    res.json({
      success: true,
      hospitals: result,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
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
    const hospital = getHospitalByParam(req.params.hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { rows: members, total } = hospitalMemberRepo.find({ hospital: hospital.id }, { limit, skip });
    const withUser = members.map((m) => {
      const u = userRepo.findById(m.user);
      return {
        id: m.id,
        user: u ? { id: u.id, username: u.username, name: u.name, email: u.email } : null,
        status: m.status,
        joinedAt: m.joinedAt,
        statusChangedAt: m.statusChangedAt,
        createdAt: m.createdAt
      };
    });
    res.json({
      success: true,
      members: withUser,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
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
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const hospital = getHospitalByParam(req.params.hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const user = userRepo.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'doctor') return res.status(400).json({ error: 'Only doctors can be invited to a hospital' });
    if (user.blocked && user.blockedBy === 'owner') return res.status(400).json({ error: 'This user account is suspended' });
    const existing = hospitalMemberRepo.findOne({ hospital: hospital.id, user: user.id });
    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ error: 'This doctor is already a member' });
      if (existing.status === 'pending_invitation') return res.status(400).json({ error: 'This doctor already has a pending invitation' });
      if (existing.status === 'blocked') return res.status(400).json({ error: 'This doctor is blocked from this hospital' });
      hospitalMemberRepo.update(existing.id, { status: 'pending_invitation', invitedBy: req.user.id || null, statusChangedAt: Date.now() });
      return res.json({ success: true, message: 'Re-invitation sent' });
    }
    const otherAccepted = hospitalMemberRepo.findOne({ user: user.id, status: 'accepted' });
    if (otherAccepted) return res.status(400).json({ error: 'This doctor is already a member of another hospital' });
    hospitalMemberRepo.create({ hospital: hospital.id, user: user.id, status: 'pending_invitation', invitedBy: req.user.id || null });
    res.status(201).json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite to hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Kick member (Owner only)
router.put('/:hospitalId/members/:memberId/kick', protect, requireOwner(), async (req, res) => {
  try {
    const hospital = getHospitalByParam(req.params.hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const membership = hospitalMemberRepo.findById(req.params.memberId);
    if (!membership || membership.hospital !== hospital.id) return res.status(404).json({ error: 'Member not found' });
    if (membership.status === 'kicked') return res.status(400).json({ error: 'Member is already kicked' });
    hospitalMemberRepo.update(membership.id, { status: 'kicked', statusChangedAt: Date.now() });
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
    const hospital = getHospitalByParam(req.params.hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const membership = hospitalMemberRepo.findById(req.params.memberId);
    if (!membership || membership.hospital !== hospital.id) return res.status(404).json({ error: 'Member not found' });
    if (membership.status !== 'blocked') return res.status(400).json({ error: 'Member is not blocked' });
    hospitalMemberRepo.update(membership.id, { status: 'kicked', statusChangedAt: Date.now() });
    const user = userRepo.findById(membership.user);
    if (user && user.blockedBy === 'owner') {
      userRepo.update(user.id, { blocked: false, blockedBy: null });
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
    const userId = req.user.id || req.user._id;
    const hospital = hospitalRepo.findOne({ admin: userId });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const updates = {};
    if (name) updates.name = name;
    if (address !== undefined) updates.address = address;
    hospitalRepo.update(hospital.id, updates);
    const updated = hospitalRepo.findById(hospital.id);
    res.json({
      success: true,
      message: 'Hospital updated successfully',
      hospital: { id: updated.id, hospitalId: updated.hospitalId, name: updated.name, address: updated.address, updatedAt: updated.updatedAt }
    });
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete hospital
router.delete('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const hospital = hospitalRepo.findOne({ admin: userId });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const dicomStudies = dicomStudyRepo.find({ hospital: hospital.id }, { limit: 10000 });
    for (const study of dicomStudies) {
      if (study.orthancStudyId) {
        try {
          await orthancClient.delete(`/studies/${study.orthancStudyId}`);
        } catch (err) {
          console.error(`Error deleting study ${study.orthancStudyId} from Orthanc:`, err.message);
        }
      }
    }
    const wordFiles = wordFileRepo.find({ hospital: hospital.id }, { limit: 10000 });
    for (const wordFile of wordFiles) {
      if (wordFile.filePath && fs.existsSync(wordFile.filePath)) {
        try {
          fs.unlinkSync(wordFile.filePath);
        } catch (err) {
          console.error(`Error deleting file ${wordFile.filePath}:`, err.message);
        }
      }
    }
    dicomStudyRepo.deleteMany({ hospital: hospital.id });
    wordFileRepo.deleteMany({ hospital: hospital.id });
    patientRepo.deleteMany({ hospital: hospital.id });
    hospitalSubscriptionRepo.deleteByHospital(hospital.id);
    hospitalMemberRepo.deleteMany({ hospital: hospital.id });
    hospitalRepo.deleteById(hospital.id);
    res.json({ success: true, message: 'Hospital and all associated data deleted successfully' });
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
    const hospital = hospitalRepo.findOne({ hospitalId: req.params.hospitalId });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const adminUser = userRepo.findById(hospital.admin);
    res.json({
      success: true,
      hospital: {
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        adminName: adminUser ? adminUser.name : ''
      }
    });
  } catch (error) {
    console.error('Find hospital error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
