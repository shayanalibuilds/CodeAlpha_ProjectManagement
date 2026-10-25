const connectDB = require('./config/db');
const maybeAutoSeed = require('./seed/autoSeed');
const { createApp } = require('./app');

// --- Start ---
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    await maybeAutoSeed();
    const { server } = createApp();
    server.listen(PORT, () => {
      console.log(`[server] TaskFlow API running on http://localhost:${PORT}`);
      console.log('[server] Socket.io realtime enabled');
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
})();
