process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-secret';

const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const seed = require('../src/seed/seed');
const { setupDB, teardownDB, clearDB } = require('./helpers');

describe('demo seeding', () => {
  let app;

  beforeAll(async () => {
    await setupDB();
    app = createApp().app;
  });

  afterAll(teardownDB);

  it('seeds the demo accounts and the demo login works', async () => {
    await clearDB();
    await seed();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'demo@taskflow.dev', password: 'demo1234' });
    expect(login.status).toBe(200);
    expect(login.body.user.name).toBe('Demo User');

    // The seeded demo user owns projects with tasks
    const board = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(board.status).toBe(200);
    expect(board.body.projects.length).toBeGreaterThanOrEqual(2);
  });

  it('auto-seeds an empty database when SEED_ON_START=true and stays a no-op afterwards', async () => {
    await clearDB();
    const maybeAutoSeed = require('../src/seed/autoSeed');

    process.env.SEED_ON_START = 'true';
    const seeded = await maybeAutoSeed();
    expect(seeded).toBe(true);
    expect(await User.countDocuments({ email: 'demo@taskflow.dev' })).toBe(1);

    // Second run must not duplicate anything
    const again = await maybeAutoSeed();
    expect(again).toBe(false);
    expect(await User.countDocuments({})).toBe(3);
    delete process.env.SEED_ON_START;
  });

  it('never auto-seeds a persistent database without SEED_ON_START', async () => {
    await clearDB();
    const maybeAutoSeed = require('../src/seed/autoSeed');
    const before = await User.countDocuments({});
    const result = await maybeAutoSeed();
    expect(result).toBe(false);
    expect(await User.countDocuments({})).toBe(before);
  });
});
