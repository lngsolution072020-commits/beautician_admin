const Vendor = require('../models/Vendor');
const ApiError = require('../utils/apiError');
const { ROLES } = require('../utils/constants');

/** After auth + role (super_admin | vendor), attach city/vendor scope for vendor users */
const attachVendorScope = async (req, res, next) => {
  try {
    if (req.user.role === ROLES.SUPER_ADMIN) {
      req.vendorScope = null;
      return next();
    }
    if (req.user.role === ROLES.VENDOR) {
      const vid = req.user.vendor;
      if (!vid) {
        return next(new ApiError(403, 'Vendor account is not linked to a vendor profile'));
      }
      const vendor = await Vendor.findById(vid).populate('city').lean();
      if (!vendor) {
        return next(new ApiError(403, 'Vendor profile not found'));
      }
      const cityId = vendor.city && (vendor.city._id || vendor.city);
      req.vendorScope = {
        vendorId: vendor._id,
        cityId
      };
      return next();
    }
    return next(new ApiError(403, 'Forbidden'));
  } catch (e) {
    return next(e);
  }
};

const superAdminOnly = (req, res, next) => {
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return next(new ApiError(403, 'Only super admin can perform this action'));
  }
  return next();
};

module.exports = {
  attachVendorScope,
  superAdminOnly
};
