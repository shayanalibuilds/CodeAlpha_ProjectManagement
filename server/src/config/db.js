require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Connects to MongoDB using MONGODB_URI.
 * If no URI is configured, an in-memory MongoDB instance is started instead
 * (convenient for local development / demo, data resets on restart).
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB -> ${mongoose.connection.name}`);
    return;
  }

  // Fallback: in-memory MongoDB for zero-setup development
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('taskflow'));
  console.log('[db] Started in-memory MongoDB (set MONGODB_URI for persistent storage)');
}

module.exports = connectDB;
