require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const http = require('http');

const connectDB = require('./config/db');
const maybeAutoSeed = require('./seed/autoSeed');
const { initSocket } = require('./realtime');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks', commentRoutes); // /api/tasks/:taskId/comments
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'TaskFlow API' }));

// --- Socket.io realtime (bonus feature) ---
const io = initSocket(server);
app.set('io', io);

// --- Serve the built React client (production / single-port deployment) ---
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// --- Error handler ---
// Maps well-known client errors to 4xx so bad input never surfaces as a 500.
app.use((err, req, res, next) => {
  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors || {})[0];
    return res.status(400).json({ error: first?.message || 'Invalid input.' });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: `Invalid value for ${err.path || 'an identifier'}.` });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

// --- Start ---
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    await maybeAutoSeed();
    server.listen(PORT, () => {
      console.log(`[server] TaskFlow API running on http://localhost:${PORT}`);
      console.log('[server] Socket.io realtime enabled');
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
})();
