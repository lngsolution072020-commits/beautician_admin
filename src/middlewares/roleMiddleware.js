const ApiError = require('../utils/apiError');

// Authorize user based on allowed roles
const roleMiddleware = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden: insufficient permissions'));
  }

  return next();
};

module.exports = roleMiddleware;

