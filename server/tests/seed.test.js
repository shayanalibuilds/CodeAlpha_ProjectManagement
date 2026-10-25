const path = require('path');
const { spawnSync } = require('child_process');
const request = require('supertest');

describe('demo seed with the default (in-memory) setup (#3)', () => {
  const saved = { ...process.env };
  let mod;

  afterAll(async () => {
    if (mod) {
      mod.io.close();
      if (mod.server.listening) await new Promise((r) => mod.server.close(r));
    }
    await require('../src/config/db').disconnectDB();
    process.env = saved;
  });

  test('the server seeds its own in-memory DB so the demo login works', async () => {
    process.env.MONGODB_URI = '';
    process.env.PORT = '0';
    delete process.env.SEED_ON_START;
    jest.resetModules();
    mod = require('../src/index');
    await mod.start();

    const health = await request(mod.app).get('/api/health');
    expect(health.body.demoAvailable).toBe(true);

    const res = await request(mod.app)
      .post('/api/auth/login')
      .send({ email: 'demo@taskflow.dev', password: 'demo1234' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('demo@taskflow.dev');
  });

  test('`npm run seed` without MONGODB_URI exits with a clear error instead of seeding a throwaway DB', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'seed', 'seed.js')], {
      env: { ...saved, MONGODB_URI: '', NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/MONGODB_URI is not set/);
  });

  test('production refuses to start without MONGODB_URI', async () => {
    const { connectDB } = jest.requireActual('../src/config/db');
    const env = { ...process.env };
    process.env.MONGODB_URI = '';
    process.env.NODE_ENV = 'production';
    try {
      await expect(connectDB()).rejects.toThrow(/MONGODB_URI is required in production/);
    } finally {
      process.env = env;
    }
  });
});
