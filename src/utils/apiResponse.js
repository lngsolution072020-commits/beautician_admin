// Standardized API response helpers aligned with required format:
// Success: { success: true, message, data }
// Error:   { success: false, message, error }

class ApiResponse {
  static success(res, { message = 'Success', data = null, statusCode = 200 } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static error(res, { message = 'Error', statusCode = 500, error = null } = {}) {
    return res.status(statusCode).json({
      success: false,
      message,
      error
    });
  }
}

module.exports = ApiResponse;


