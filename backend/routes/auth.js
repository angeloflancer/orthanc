const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');
const { generateToken, generateOwnerToken, protect } = require('../middleware/auth');
const { sendVerificationEmail, sendOtpEmail } = require('../utils/emailService');

// In-memory OTP store for owner login: { email -> { code, expiresAt } }. Single-use, 10 min TTL.
const ownerOtpStore = {};
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_LENGTH = 6;

// Rate limit: max OTP requests and verify attempts per email per window
const OTP_RATE_LIMIT = { maxRequest: 5, maxVerify: 10, windowMs: 15 * 60 * 1000 };
const otpRateLimit = {}; // { email -> { requests: n, verifyAttempts: n, windowStart } }
function checkOtpRateLimit(email, isVerify) {
  const key = (email || '').toLowerCase();
  const now = Date.now();
  if (!otpRateLimit[key] || now - otpRateLimit[key].windowStart > OTP_RATE_LIMIT.windowMs) {
    otpRateLimit[key] = { requests: 0, verifyAttempts: 0, windowStart: now };
  }
  const lim = otpRateLimit[key];
  if (isVerify) {
    lim.verifyAttempts++;
    if (lim.verifyAttempts > OTP_RATE_LIMIT.maxVerify) return false;
  } else {
    lim.requests++;
    if (lim.requests > OTP_RATE_LIMIT.maxRequest) return false;
  }
  return true;
}

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.json({ 
        available: false, 
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.json({ 
        available: false, 
        error: 'Username must be between 3 and 20 characters' 
      });
    }
    
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    res.json({ available: !existingUser });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    
    // Validation
    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: 'Please provide username, email, password, and name' });
    }
    
    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }
    
    // Check if username exists
    const usernameExists = await User.findOne({ username: username.toLowerCase() });
    if (usernameExists) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Check if email exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Create user with default role 'doctor'
    const user = await User.create({ 
      username: username.toLowerCase(),
      email, 
      password, 
      name,
      role: 'doctor',
      emailVerificationToken,
      emailVerificationTokenExpiry
    });
    
    // Send verification email
    await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    
    res.status(201).json({
      success: true,
      token: process.env.REQUIRE_VERIFY_EMAIL === "false" ? generateToken(user._id) : null,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified
      },
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors)[0].message });
    }
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    const identifier = (email || username || '').toString().trim();
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide email/username and password' });
    }

    const ownerEmail = process.env.OWNER_EMAIL && process.env.OWNER_EMAIL.trim().toLowerCase();
    const ownerPassword = process.env.OWNER_PASSWORD;

    // Owner login: require OTP; do not issue token until OTP is verified
    if (ownerEmail && ownerPassword && identifier.toLowerCase() === ownerEmail) {
      if (password !== ownerPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const code = crypto.randomInt(0, Math.pow(10, OTP_LENGTH))
        .toString()
        .padStart(OTP_LENGTH, '0');
      ownerOtpStore[ownerEmail] = { code, expiresAt: Date.now() + OTP_TTL_MS };
      const ownerName = process.env.OWNER_NAME || 'Owner';
      await sendOtpEmail(ownerEmail, code, ownerName);
      return res.json({
        success: true,
        requiresOtp: true,
        email: ownerEmail
      });
    }

    // Normal user login
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: identifier.toLowerCase() }
      : { username: identifier.toLowerCase() };

    const user = await User.findOne(query).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.blocked && user.blockedBy === 'owner') {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact the owner for assistance.',
        blocked: true,
        blockedBy: 'owner'
      });
    }

    const envValue = process.env.REQUIRE_VERIFY_EMAIL;
    const requireEmailVerify = envValue
      ? envValue.toString().trim().toLowerCase() === 'true'
      : false;

    if (requireEmailVerify && !user.emailVerified) {
      return res.status(403).json({
        error: 'Email verification required',
        emailVerified: false,
        requireEmailVerify: true,
        email: user.email
      });
    }

    const token = generateToken(user._id);

    let hospital = null;
    if (user.role === 'admin') {
      hospital = await Hospital.findOne({ admin: user._id });
    }

    let hospitalMembership = null;
    if (user.role === 'doctor') {
      const membership = await HospitalMember.findOne({ user: user._id })
        .populate('hospital', 'hospitalId name');
      if (membership) {
        hospitalMembership = {
          hospitalId: membership.hospital.hospitalId,
          hospitalName: membership.hospital.name,
          status: membership.status
        };
      }
    }

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        hospital: hospital ? {
          id: hospital._id,
          hospitalId: hospital.hospitalId,
          name: hospital.name
        } : null,
        hospitalMembership
      },
      requireEmailVerify
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Owner login: verify OTP and issue JWT
router.post('/login-verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const ownerEmail = process.env.OWNER_EMAIL && process.env.OWNER_EMAIL.trim().toLowerCase();

    if (!ownerEmail || !email || !otp) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }
    if (email.toLowerCase() !== ownerEmail) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }
    if (!checkOtpRateLimit(ownerEmail, true)) {
      return res.status(429).json({ error: 'Too many verification attempts. Try again later.' });
    }

    const stored = ownerOtpStore[ownerEmail];
    if (!stored) {
      return res.status(401).json({ error: 'Verification code expired or already used' });
    }
    if (Date.now() > stored.expiresAt) {
      delete ownerOtpStore[ownerEmail];
      return res.status(401).json({ error: 'Verification code expired' });
    }
    if (stored.code !== String(otp).trim()) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    delete ownerOtpStore[ownerEmail];
    const token = generateOwnerToken(ownerEmail);

    res.json({
      success: true,
      token,
      user: {
        id: null,
        username: null,
        email: ownerEmail,
        name: process.env.OWNER_NAME || 'Owner',
        role: 'owner',
        emailVerified: true,
        hospital: null,
        hospitalMembership: null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    // Owner: not in DB, return profile from env
    if (req.user.role === 'owner') {
      return res.json({
        success: true,
        user: {
          id: null,
          username: null,
          email: req.user.email,
          name: req.user.name,
          role: 'owner',
          emailVerified: true,
          hospital: null,
          subscription: null,
          hospitalMembership: null,
          doctorSubscription: null
        }
      });
    }

    const HospitalSubscription = require('../models/HospitalSubscription');

    let hospital = null;
    let subscription = null;
    if (req.user.role === 'admin') {
      hospital = await Hospital.findOne({ admin: req.user._id });
      if (hospital) {
        subscription = await HospitalSubscription.findOne({ hospital: hospital._id });
      }
    }

    let hospitalMembership = null;
    let doctorSubscription = null;
    if (req.user.role === 'doctor') {
      const membership = await HospitalMember.findOne({
        user: req.user._id
      }).populate('hospital', 'hospitalId name');
      if (membership) {
        hospitalMembership = {
          hospitalId: membership.hospital.hospitalId,
          hospitalName: membership.hospital.name,
          status: membership.status
        };
        if (membership.status === 'accepted' && membership.hospital) {
          doctorSubscription = await HospitalSubscription.findOne({
            hospital: membership.hospital._id
          });
        }
      }
    }

    let subscriptionInfo = null;
    if (subscription) {
      subscriptionInfo = {
        planType: subscription.planType,
        expiresAt: subscription.expiresAt,
        isActive: subscription.isActive,
        daysUntilExpiration: subscription.getDaysUntilExpiration(),
        shouldShowWarning: subscription.shouldShowWarning()
      };
    }

    let doctorSubscriptionInfo = null;
    if (doctorSubscription) {
      doctorSubscriptionInfo = {
        planType: doctorSubscription.planType,
        expiresAt: doctorSubscription.expiresAt,
        isActive: doctorSubscription.isActive,
        daysUntilExpiration: doctorSubscription.getDaysUntilExpiration(),
        shouldShowWarning: doctorSubscription.shouldShowWarning()
      };
    }

    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        emailVerified: req.user.emailVerified,
        hospital: hospital ? {
          id: hospital._id,
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          address: hospital.address
        } : null,
        subscription: subscriptionInfo,
        hospitalMembership,
        doctorSubscription: doctorSubscriptionInfo
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify email
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find user with this token and check if it's not expired
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpiry: { $gt: Date.now() }
    }).select('+emailVerificationToken +emailVerificationTokenExpiry');
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }
    
    // Update user
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    await user.save();
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend verification email (authenticated)
router.post('/resend-verification', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+emailVerificationToken +emailVerificationTokenExpiry');
    
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationTokenExpiry = emailVerificationTokenExpiry;
    await user.save();
    
    // Send verification email
    await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    
    res.json({
      success: true,
      message: 'Verification email sent. Please check your email.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend verification email (public - requires email and password for security)
router.post('/resend-verification-public', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    // Support both 'email' and 'username' fields
    const identifier = email || username;
    
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide email/username and password' });
    }
    
    // Determine if identifier is email or username
    const isEmail = identifier.includes('@');
    
    // Build query based on identifier type
    const query = isEmail 
      ? { email: identifier.toLowerCase() }
      : { username: identifier.toLowerCase() };
    
    // Verify credentials
    const user = await User.findOne(query).select('+password +emailVerificationToken +emailVerificationTokenExpiry');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationTokenExpiry = emailVerificationTokenExpiry;
    await user.save();
    
    // Send verification email
    await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    
    res.json({
      success: true,
      message: 'Verification email sent. Please check your email.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, username } = req.body;
    const user = await User.findById(req.user._id).select('+emailVerificationToken +emailVerificationTokenExpiry');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.name = name || user.name;
    
    let usernameChanged = false;
    let emailChanged = false;

    // Handle username change
    if (username && username.toLowerCase() !== user.username) {
      // Validate username format
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      }
      
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }
      
      // Check if new username is already taken
      const usernameExists = await User.findOne({ username: username.toLowerCase() });
      if (usernameExists && usernameExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      
      user.username = username.toLowerCase();
      usernameChanged = true;
    }

    // Handle email change
    if (email && email !== user.email) {
      // Check if new email is already taken
      const emailExists = await User.findOne({ email });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      user.email = email;
      user.emailVerified = false; // Reset verification status
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      emailChanged = true;
    }

    await user.save();
    
    if (emailChanged) {
      await sendVerificationEmail(user.email, user.name, user.emailVerificationToken);
    }

    let message = 'Profile updated successfully';
    if (emailChanged) {
      message = 'Profile updated. New email requires verification.';
    }

    return res.json({ 
      success: true, 
      message, 
      user: { 
        id: user._id,
        username: user.username,
        name: user.name, 
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified 
      } 
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors)[0].message });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Please provide current password and new password' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
