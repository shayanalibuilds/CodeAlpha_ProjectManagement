require('dotenv').config();
const mongoose = require('mongoose');

let memoryServer = null;

/** True when no MONGODB_URI is configured and the in-memory fallback would be used. */
function usesInMemoryDB(env = process.env) {
  return !(env.MONGODB_URI && env.MONGODB_URI.trim() !== '');
}

/**
 * Connects to MongoDB using MONGODB_URI.
 * If no URI is configured, an in-memory MongoDB instance is started instead
 * (local development only, data resets on restart). In production a real
 * MONGODB_URI is required.
 */
async function connectDB() {
  if (!usesInMemoryDB()) {
    await mongoose.connect(process.env.MONGODB_URI.trim());
    console.log(`[db] Connected to MongoDB -> ${mongoose.connection.name}`);
    return { inMemory: false };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production. The in-memory database is for local development only.');
  }

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    throw new Error(
      'MONGODB_URI is empty and mongodb-memory-server is not installed. Set MONGODB_URI or install dev dependencies.'
    );
  }
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('taskflow'));
  console.log('[db] Started in-memory MongoDB (set MONGODB_URI for persistent storage)');
  return { inMemory: true };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
module.exports.usesInMemoryDB = usesInMemoryDB;
