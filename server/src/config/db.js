require('dotenv').config();
const mongoose = require('mongoose');

let inMemory = false;

/**
 * True when the app is running on the auto-started in-memory MongoDB
 * (i.e. MONGODB_URI was empty and this is not a production environment).
 */
function isInMemoryDB() {
  return inMemory;
}

/**
 * Connects to MongoDB using MONGODB_URI.
 * If no URI is configured outside production, an in-memory MongoDB instance
 * is started instead (convenient for local development / demo, data resets
 * on restart). In production a missing URI is a hard error: the in-memory
 * fallback is a dev-only convenience (mongodb-memory-server is a devDependency).
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    inMemory = false;
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB -> ${mongoose.connection.name}`);
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'MONGODB_URI is required in production. The in-memory MongoDB fallback is ' +
        'dev-only (its data is lost on restart and mongodb-memory-server is not ' +
        'installed in production). Set MONGODB_URI in the environment and restart.'
    );
  }

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    throw new Error(
      'MONGODB_URI is not set and mongodb-memory-server is not installed. ' +
        'Install dev dependencies (npm install) or set MONGODB_URI in server/.env.'
    );
  }

  inMemory = true;
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('taskflow'));
  console.log('[db] Started in-memory MongoDB (set MONGODB_URI for persistent storage)');
}

module.exports = connectDB;
module.exports.isInMemoryDB = isInMemoryDB;
