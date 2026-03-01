const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const env = require('./config/env');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// API routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'OK' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;

