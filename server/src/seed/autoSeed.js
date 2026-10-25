const mongoose = require('mongoose');
const { isInMemoryDB } = require('../config/db');
const seed = require('./seed');

/**
 * Auto-seed the database on server startup when it is empty.
 *
 * The in-memory fallback database is brand new (and throwaway) on every
 * start, so seeding it makes the default zero-config setup work out of the
 * box: the demo login (demo@taskflow.dev / demo1234) and the client's
 * "Explore with the demo account" button just work.
 *
 * Persistent databases (MONGODB_URI set) are only seeded when they contain
 * no users at all, and only when SEED_ON_START=true is set explicitly, so a
 * production database is never clobbered by accident.
 */
async function maybeAutoSeed() {
  if (!isInMemoryDB()) {
    if (process.env.SEED_ON_START !== 'true') return false;
  }

  const User = require('../models/User');
  const userCount = await User.countDocuments({});
  if (userCount > 0) return false;

  const result = await seed();
  console.log(
    `[seed] Seeded empty database with demo data (demo@taskflow.dev / demo1234, ` +
      `${result.projects} projects, ${result.tasks} tasks)`
  );
  return true;
}

module.exports = maybeAutoSeed;
