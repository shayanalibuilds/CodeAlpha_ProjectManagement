const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');

const { initSocket } = require('./realtime');
const errorHandler = require('./middleware/errorHandler');
const { demoUserExists } = require('./seed/demoData');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');

/**
 * Builds the Express app, HTTP server and Socket.io instance without
 * connecting to the database or listening, so tests can import it.
 */
function createApp({ serveClient = true } = {}) {
  const app = express();
  const server = http.createServer(app);

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/tasks', commentRoutes); // /api/tasks/:taskId/comments
  app.use('/api/notifications', notificationRoutes);

  app.get('/api/health', async (req, res, next) => {
    try {
      res.json({ ok: true, name: 'TaskFlow API', demoAvailable: await demoUserExists() });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  const io = initSocket(server);
  app.set('io', io);

  // Serve the built React client (production / single-port deployment)
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (serveClient && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return { app, server, io };
}

module.exports = { createApp };
