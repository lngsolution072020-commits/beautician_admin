const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

// Initialize MongoDB connection using Mongoose
const connectDB = async () => {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(env.mongoUri, {
      autoIndex: true
    });

    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection error: %s', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

