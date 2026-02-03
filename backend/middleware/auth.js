const jwt = require('jsonwebtoken');
const userRepo = require('../db/userRepo');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers.token) {
      token = req.headers.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // Owner token: not in DB, set req.user from payload/env
      if (decoded.type === 'owner' && decoded.email) {
        req.user = {
          _id: null,
          role: 'owner',
          email: decoded.email,
          name: process.env.OWNER_NAME || 'Owner',
          emailVerified: true
        };
        return next();
      }

      // Normal user: load from DB (exclude password)
      const user = userRepo.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      const { password, ...safe } = user;
      req.user = safe;
      req.user.id = user.id;
      req.user._id = user.id;

      if (req.user.blocked && req.user.blockedBy === 'owner') {
        return res.status(403).json({
          error: 'Your account has been suspended. Please contact the owner for assistance.',
          blocked: true,
          blockedBy: 'owner'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Not authorized, invalid token' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
};

exports.generateOwnerToken = (email) => {
  return jwt.sign({ type: 'owner', email }, JWT_SECRET, { expiresIn: '30d' });
};
