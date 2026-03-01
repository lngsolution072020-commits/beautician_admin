const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/apiError');

// Authenticate user using JWT access token
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication token missing');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.accessSecret);

    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }

    req.user = {
      id: user.id,
      role: user.role,
      city: user.city,
      vendor: user.vendor
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Access token expired'));
    }
    if (error instanceof ApiError) {
      return next(error);
    }
    return next(new ApiError(401, 'Invalid authentication token'));
  }
};

module.exports = authMiddleware;

