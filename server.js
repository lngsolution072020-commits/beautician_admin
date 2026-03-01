const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const logger = require('./src/config/logger');
const { initFirebase } = require('./src/config/firebase');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.info('Socket connected: %s', socket.id);

  socket.on('subscribe', (payload) => {
    const { appointmentId } = payload || {};
    if (appointmentId) {
      socket.join(`appointment:${appointmentId}`);
    }
  });

  socket.on('unsubscribe', (payload) => {
    const { appointmentId } = payload || {};
    if (appointmentId) {
      socket.leave(`appointment:${appointmentId}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected: %s', socket.id);
  });
});

initFirebase();

const start = async () => {
  await connectDB();

  server.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`);
  });
};

start();

