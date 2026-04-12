const ApiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const Notification = require('../models/Notification');

/** Get current user's persistent notifications */
exports.getNotifications = catchAsync(async (req, res) => {
  const items = await Notification.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  
  return ApiResponse.success(res, {
    message: 'Notifications fetched',
    data: items
  });
});

/** Mark one notification as read */
exports.markRead = catchAsync(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  
  return ApiResponse.success(res, {
    message: 'Notification marked as read',
    data: {}
  });
});

/** Mark all notifications as read for current user */
exports.markAllRead = catchAsync(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  
  return ApiResponse.success(res, {
    message: 'All notifications marked as read',
    data: {}
  });
});
