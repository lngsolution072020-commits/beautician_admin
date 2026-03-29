const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const env = require('./config/env');

const app = express();

// Middlewares — explicit CORS so browsers send GET after preflight (Authorization header)
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  })
);
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

