### Example Auth Requests

**Register**
```json
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "phone": "9999999999",
  "cityId": "60d21b4667d0d8992e610c85"
}
```

**Login**
```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "Password123"
}
```

### Example Admin Requests

**Create City**
```json
POST /api/admin/cities
Authorization: Bearer <SUPER_ADMIN_TOKEN>
{
  "name": "Mumbai",
  "state": "Maharashtra",
  "country": "India"
}
```

**Create Vendor**
```json
POST /api/admin/vendors
Authorization: Bearer <SUPER_ADMIN_TOKEN>
{
  "name": "Glamour Salon",
  "email": "vendor@example.com",
  "phone": "8888888888",
  "city": "60d21b4667d0d8992e610c85",
  "address": "Andheri West, Mumbai"
}
```

### Example Vendor Requests

**Create Beautician**
```json
POST /api/vendor/beauticians
Authorization: Bearer <VENDOR_TOKEN>
{
  "name": "Sara Stylist",
  "email": "sara@example.com",
  "password": "Password123",
  "phone": "7777777777",
  "expertise": ["Hair", "Makeup"],
  "experienceYears": 3
}
```

### Example Customer Requests

**Create Appointment**
```json
POST /api/customer/appointments
Authorization: Bearer <CUSTOMER_TOKEN>
{
  "serviceId": "60d21b9767d0d8992e610c88",
  "scheduledAt": "2026-03-01T10:00:00.000Z",
  "address": "Bandra West, Mumbai",
  "lat": 19.0600,
  "lng": 72.8300,
  "price": 1500
}
```

