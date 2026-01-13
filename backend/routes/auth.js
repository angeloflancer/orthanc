const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/emailService');

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Please provide email, password, and name' });
    }
    
    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    // Create user
    const user = await User.create({ 
      email, 
      password, 
      name,
      emailVerificationToken,
      emailVerificationTokenExpiry
    });
    
    // Generate token
    const token = generateToken(user._id);
    
    // Send verification email
    await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      },
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors)[0].message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Check if user exists (include password field)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check email verification requirement (read from env per request)
    // Support both REQUIRE_VERIFY_EMAIL and REQUIRE_EMAIL_VERIFY for compatibility
    const envValue = process.env.REQUIRE_VERIFY_EMAIL || process.env.REQUIRE_EMAIL_VERIFY;
    console.log("EnValue", envValue)
    const requireEmailVerify = envValue 
      ? envValue.toString().trim().toLowerCase() === 'true'
      : false; // Explicitly default to false
    
    if (requireEmailVerify && !user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email verification required',
        emailVerified: false,
        requireEmailVerify: true
      });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      },
      requireEmailVerify
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        emailVerified: req.user.emailVerified
      }
    });
  } catch (error) {
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
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Verify credentials
    const user = await User.findOne({ email }).select('+password +emailVerificationToken +emailVerificationTokenExpiry');
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
    const { name, email } = req.body;
    const user = await User.findById(req.user._id).select('+emailVerificationToken +emailVerificationTokenExpiry');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.name = name || user.name;

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
      await sendVerificationEmail(user.email, user.name, user.emailVerificationToken);
      await user.save();
      return res.json({ 
        success: true, 
        message: 'Profile updated. New email requires verification.', 
        user: { 
          id: user._id, 
          name: user.name, 
          email: user.email, 
          emailVerified: user.emailVerified 
        } 
      });
    } else {
      await user.save();
      return res.json({ 
        success: true, 
        message: 'Profile updated successfully', 
        user: { 
          id: user._id, 
          name: user.name, 
          email: user.email, 
          emailVerified: user.emailVerified 
        } 
      });
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(error.errors)[0].message });
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
