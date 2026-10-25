/**
 * Seeds demo data into the database configured by MONGODB_URI.
 *   npm run seed
 * Demo login:  demo@taskflow.dev / demo1234
 * Teammates:   alex@taskflow.dev / demo1234, maya@taskflow.dev / demo1234
 *
 * With an empty MONGODB_URI there is nothing persistent to seed: the API
 * server starts its own in-memory database and seeds it automatically on
 * startup, so this script exits with an explanation instead.
 */
require('dotenv').config();
const { connectDB, disconnectDB, usesInMemoryDB } = require('../config/db');
const { seedDemoData } = require('./demoData');

async function main() {
  if (usesInMemoryDB()) {
    console.error(
      'MONGODB_URI is not set. The dev server uses an in-memory database and seeds the demo data itself on startup,\n' +
        'so there is nothing to seed here. To seed a persistent database, set MONGODB_URI in server/.env and run this again.'
    );
    process.exit(1);
  }

  await connectDB();
  await seedDemoData();
  await disconnectDB();

  console.log('Seed complete.');
  console.log('  demo@taskflow.dev / demo1234   (project owner)');
  console.log('  alex@taskflow.dev / demo1234   (member)');
  console.log('  maya@taskflow.dev / demo1234   (member)');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
