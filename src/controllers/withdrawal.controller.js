const WithdrawalRequest = require('../models/WithdrawalRequest');
const BeauticianProfile = require('../models/BeauticianProfile');
const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');

// Beautician: Request withdrawal
exports.createRequest = catchAsync(async (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  const profile = await BeauticianProfile.findOne({ user: userId });
  if (!profile) {
    throw new ApiError(404, 'Beautician profile not found');
  }

  if (profile.walletBalance < amount) {
    throw new ApiError(400, 'Insufficient wallet balance');
  }

  // Deduct from wallet immediately to "lock" the funds? 
  // Or just check? Usually, it's better to deduct and if rejected, refund.
  profile.walletBalance -= amount;
  await profile.save();

  const withdrawal = await WithdrawalRequest.create({
    beautician: userId,
    amount,
    status: 'pending'
  });

  return ApiResponse.success(res, {
    message: 'Withdrawal request submitted successfully',
    data: withdrawal
  });
});

// Beautician: Get own withdrawal history
exports.getMyWithdrawals = catchAsync(async (req, res) => {
  const withdrawals = await WithdrawalRequest.find({ beautician: req.user.id })
    .sort({ createdAt: -1 });

  return ApiResponse.success(res, {
    message: 'Withdrawal history fetched',
    data: withdrawals
  });
});

// Admin: Get all requests
exports.getAllRequests = catchAsync(async (req, res) => {
  const { status } = req.query;
  const query = status ? { status } : {};
  
  const withdrawals = await WithdrawalRequest.find(query)
    .populate('beautician', 'name email phone')
    .sort({ createdAt: -1 })
    .lean();

  // Attach bank details from profile
  const beauticianIds = withdrawals.map(w => w.beautician._id);
  const profiles = await BeauticianProfile.find({ user: { $in: beauticianIds } })
    .select('user bankDetails')
    .lean();

  const profileMap = profiles.reduce((acc, p) => {
    acc[p.user.toString()] = p.bankDetails;
    return acc;
  }, {});

  const data = withdrawals.map(w => ({
    ...w,
    beautician: {
      ...w.beautician,
      bankDetails: profileMap[w.beautician._id.toString()] || {}
    }
  }));

  return ApiResponse.success(res, {
    message: 'All withdrawal requests fetched',
    data
  });
});

// Admin: Update status (Approve/Reject)
exports.updateStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Invalid status update');
  }

  const withdrawal = await WithdrawalRequest.findById(id);
  if (!withdrawal) {
    throw new ApiError(404, 'Request not found');
  }

  if (withdrawal.status !== 'pending') {
    throw new ApiError(400, 'Request is already processed');
  }

  withdrawal.status = status;
  withdrawal.adminNotes = adminNotes;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  // If rejected, refund the wallet
  if (status === 'rejected') {
    const profile = await BeauticianProfile.findOne({ user: withdrawal.beautician });
    if (profile) {
      profile.walletBalance += withdrawal.amount;
      await profile.save();
    }
  }

  return ApiResponse.success(res, {
    message: `Withdrawal request ${status}`,
    data: withdrawal
  });
});
