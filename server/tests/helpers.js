const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
const { signToken } = require('../src/middleware/auth');

let mongo;

/** Start (once) and connect to an in-memory MongoDB. */
async function setupDB() {
  if (!mongo) {
    mongo = await MongoMemoryServer.create();
  }
  await mongoose.connect(mongo.getUri('taskflow-test'));
}

/** Disconnect between test files. */
async function teardownDB() {
  await mongoose.disconnect();
}

/** Wipe all collections between tests. */
async function clearDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

/** Create a user with a known password and return the document. */
async function createUser(name, email, password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  return User.create({ name, email, passwordHash });
}

/** Authorization header value for a user. */
function bearerFor(user) {
  return `Bearer ${signToken(user)}`;
}

/** Register via the API and return { user, token }. */
async function registerViaApi(app, name, email, password = 'password123') {
  const res = await require('supertest')(app)
    .post('/api/auth/register')
    .send({ name, email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Wait helper for socket assertions. */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Collect received events into an array with a drain helper. */
function collector(socket, event) {
  const events = [];
  socket.on(event, (payload) => events.push(payload));
  return events;
}

module.exports = { setupDB, teardownDB, clearDB, createUser, bearerFor, registerViaApi, wait, collector };
