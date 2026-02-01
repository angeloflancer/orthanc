const express = require('express');
const router = express.Router();
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const User = require('../models/User');
const HospitalSubscription = require('../models/HospitalSubscription');
const { protect } = require('../middleware/auth');
const { requireAdmin, requireRole, requireOwner } = require('../middleware/roleAuth');

// Create hospital (Admin only)
router.post('/', protect, requireRole('admin'), async (req, res) => {
  try {
    const { name, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Hospital name is required' });
    }
    
    // Check if admin already has a hospital
    const existingHospital = await Hospital.findOne({ admin: req.user._id });
    if (existingHospital) {
      return res.status(400).json({ 
        error: 'You already have a hospital. An admin can only manage one hospital.' 
      });
    }
    
    // Create hospital
    const hospital = await Hospital.create({
      name,
      address: address || '',
      admin: req.user._id
    });
    
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

// Get all hospitals (Owner only) - for Hospital Management
router.get('/all', protect, requireOwner(), async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .populate('admin', 'name email username')
      .sort({ createdAt: -1 });

    const result = await Promise.all(hospitals.map(async (h) => {
      const subscription = await HospitalSubscription.findOne({ hospital: h._id });
      const memberCount = await HospitalMember.countDocuments({
        hospital: h._id,
        status: 'accepted'
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
        subscription: subscription ? {
          planType: subscription.planType,
          expiresAt: subscription.expiresAt,
          isActive: subscription.isActive,
          daysUntilExpiration: subscription.getDaysUntilExpiration(),
          shouldShowWarning: subscription.shouldShowWarning()
        } : null,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt
      };
    }));

    res.json({
      success: true,
      hospitals: result
    });
  } catch (error) {
    console.error('Get all hospitals error:', error);
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
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    const TARGET_SERVICE = process.env.TARGET_SERVICE || 'http://localhost:8042';
    
    // Get all DICOM studies for this hospital
    const dicomStudies = await DicomStudy.find({ hospital: hospital._id }).select('orthancStudyId');
    
    // Delete studies from Orthanc
    for (const study of dicomStudies) {
      if (study.orthancStudyId) {
        try {
          await axios.delete(`${TARGET_SERVICE}/studies/${study.orthancStudyId}`);
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
