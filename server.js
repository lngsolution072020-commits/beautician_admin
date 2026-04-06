const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const logger = require('./src/config/logger');
const { initFirebase } = require('./src/config/firebase');
const { processExpiredOffers } = require('./src/services/appointmentOffer.service');

const server = http.createServer(app);

const allowedOrigins = [
  'https://novabeautician.vercel.app',
  'https://novaadmin-alpha.vercel.app',
  'https://nova-rho-lemon.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
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

const OFFER_POLL_MS = 10_000;

const start = async () => {
  await connectDB();

  setInterval(() => {
    processExpiredOffers().catch((e) => logger.warn('processExpiredOffers: %s', e.message));
  }, OFFER_POLL_MS);

  server.listen(env.port, () => {
    logger.info(`Server running on port ${env.port}`);
  });
};

start();

