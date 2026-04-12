const ApiError = require('../utils/apiError');
const { ROLES } = require('../utils/constants');

/**
 * permissionMiddleware
 * Allows access if:
 * 1. User is SUPER_ADMIN
 * 2. User is SUB_ADMIN and has the required permission in their permissions array
 * @param {string} permission - The required permission (e.g., 'vendors_view', 'cities_edit')
 */
const permissionMiddleware = (permission, allowVendor = false) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Unauthorized'));
  }

  // Super Admin has all permissions
  if (req.user.role === ROLES.SUPER_ADMIN) {
    return next();
  }

  // Vendor check
  if (req.user.role === ROLES.VENDOR) {
    if (allowVendor) return next();
    return next(new ApiError(403, 'Forbidden: Vendors cannot perform this action'));
  }

  // Sub Admin check
  if (req.user.role === ROLES.SUB_ADMIN) {
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }
  }

  return next(new ApiError(403, 'Forbidden: you do not have permission to perform this action'));
};

module.exports = permissionMiddleware;
