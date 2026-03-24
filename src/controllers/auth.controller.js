const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');

// Register new customer
exports.register = catchAsync(async (req, res) => {
  const { user, tokens } = await authService.register(req.body);

  return ApiResponse.success(res, {
    message: 'Registration successful',
    statusCode: 201,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      tokens
    }
  });
});

// Self-register beautician (pending admin approval)
exports.registerBeautician = catchAsync(async (req, res) => {
  const result = await authService.registerBeautician(req.body);

  return ApiResponse.success(res, {
    message: 'Beautician registration submitted. Admin will review and approve.',
    statusCode: 201,
    data: result
  });
});

// Login existing user
exports.login = catchAsync(async (req, res) => {
  const { user, tokens } = await authService.login(req.body);

  return ApiResponse.success(res, {
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      tokens
    }
  });
});

// Send OTP to phone (beautician or customer login). Optional fcmToken = send OTP via push.
exports.sendOtp = catchAsync(async (req, res) => {
  await authService.sendOtp(req.body.phone, req.body.fcmToken || null, req.body.role || 'beautician');

  return ApiResponse.success(res, {
    message: 'OTP sent successfully',
    data: { sent: true }
  });
});

// Verify OTP and login (or return needsSignup for customer signup flow)
exports.verifyOtp = catchAsync(async (req, res) => {
  const result = await authService.verifyOtp(req.body.phone, req.body.otp, req.body.role);

  if (result.needsSignup) {
    return ApiResponse.success(res, {
      message: 'OTP verified. Complete sign up.',
      data: { needsSignup: true, phone: result.phone }
    });
  }

  const { user, tokens } = result;
  return ApiResponse.success(res, {
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      tokens
    }
  });
});

// Refresh token
exports.refreshToken = catchAsync(async (req, res) => {
  const { user, tokens } = await authService.refreshToken(req.body.refreshToken);

  return ApiResponse.success(res, {
    message: 'Token refreshed',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      tokens
    }
  });
});

// Logout (stateless)
exports.logout = catchAsync(async (req, res) => {
  await authService.logout();

  return ApiResponse.success(res, {
    message: 'Logged out successfully',
    data: {}
  });
});

// Get profile
exports.getProfile = catchAsync(async (req, res) => {
  const user = await authService.getProfile(req.user.id);

  return ApiResponse.success(res, {
    message: 'Profile fetched',
    data: user
  });
});

// Update profile
exports.updateProfile = catchAsync(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);

  return ApiResponse.success(res, {
    message: 'Profile updated',
    data: user
  });
});

// Change password
exports.changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);

  return ApiResponse.success(res, {
    message: 'Password changed successfully',
    data: {}
  });
});

// Delete account (customer, soft-delete)
exports.deleteAccount = catchAsync(async (req, res) => {
  await authService.deleteAccount(req.user.id, req.body);

  return ApiResponse.success(res, {
    message: 'Account deleted',
    data: {}
  });
});

// Register FCM token for push notifications
exports.updateFcmToken = catchAsync(async (req, res) => {
  await authService.updateFcmToken(req.user.id, req.body.token);

  return ApiResponse.success(res, {
    message: 'FCM token updated',
    data: {}
  });
});

