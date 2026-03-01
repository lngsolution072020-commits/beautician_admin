const logger = require('../config/logger');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

// Centralized error handling middleware
// Ensures consistent error responses across the API
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error: %s', err.stack || err.message);

  if (err instanceof ApiError) {
    return ApiResponse.error(res, {
      message: err.message,
      statusCode: err.statusCode,
      error: err.errors || null
    });
  }

  // MongoDB duplicate key (e.g. unique index violation)
  if (err.code === 11000) {
    return ApiResponse.error(res, {
      message: 'A record with this value already exists',
      statusCode: 409,
      error: null
    });
  }

  return ApiResponse.error(res, {
    message: 'Internal server error',
    statusCode: 500,
    error: null
  });
};

module.exports = errorHandler;

