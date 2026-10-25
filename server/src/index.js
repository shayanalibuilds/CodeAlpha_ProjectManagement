require('dotenv').config();
const { jwtSecret } = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { seedDemoData, demoUserExists } = require('./seed/demoData');

const { app, server, io } = createApp();

async function start() {
  // Fail fast on a missing/unsafe JWT secret before accepting any traffic.
  jwtSecret();

  const { inMemory } = await connectDB();

  // The in-memory database starts empty on every run, so seed the demo
  // accounts into it (set SEED_ON_START=false to disable).
  const seedOnStart = process.env.SEED_ON_START
    ? process.env.SEED_ON_START === 'true'
    : inMemory;
  if (seedOnStart && !(await demoUserExists())) {
    await seedDemoData();
    console.log('[seed] Demo data loaded: demo@taskflow.dev / demo1234');
  }

  const PORT = process.env.PORT || 5000;
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[server] TaskFlow API running on http://localhost:${PORT}`);
  console.log('[server] Socket.io realtime enabled');
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[server] Failed to start:', err.message || err);
    process.exit(1);
  });
}

module.exports = { app, server, io, start };
