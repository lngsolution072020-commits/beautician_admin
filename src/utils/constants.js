// Application-wide constants such as roles and appointment/payment statuses

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  VENDOR: 'vendor',
  BEAUTICIAN: 'beautician',
  CUSTOMER: 'customer'
};

const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

module.exports = {
  ROLES,
  APPOINTMENT_STATUS,
  PAYMENT_STATUS
};

