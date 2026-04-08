const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const env = require('./config/env');

const app = express();

// Configure explicit allowed origins for secure credential support
const allowedOrigins = env.allowedOrigins;

// Manual CORS middleware to bypass any package configuration edge cases
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Fallback for tools like Postman
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Static files for uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use('/2026/beautician/backend/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'OK' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;

