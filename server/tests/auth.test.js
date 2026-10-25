process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-secret';

const request = require('supertest');
const { createApp } = require('../src/app');

const { setupDB, teardownDB, clearDB, registerViaApi } = require('./helpers');

describe('auth API', () => {
  let app;

  beforeAll(async () => {
    await setupDB();
    app = createApp().app;
  });

  afterAll(teardownDB);
  beforeEach(clearDB);

  describe('POST /api/auth/register', () => {
    it('creates an account and returns user + token', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Alice Test',
        email: 'alice@test.dev',
        password: 'password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.name).toBe('Alice Test');
      expect(res.body.user.email).toBe('alice@test.dev');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(typeof res.body.token).toBe('string');
    });

    it('rejects a non-string name with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 12345, email: 'x@test.dev', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid email with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Alice', email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('rejects a short password with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Alice', email: 'a@test.dev', password: '12345' });
      expect(res.status).toBe(400);
    });

    it('rejects a duplicate email with 409', async () => {
      await registerViaApi(app, 'Alice', 'dup@test.dev');
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Alice Two', email: 'dup@test.dev', password: 'password123' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await registerViaApi(app, 'Alice', 'login@test.dev', 'password123');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@test.dev', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('login@test.dev');
      expect(res.body.token).toBeTruthy();
    });

    it('rejects a wrong password with 401', async () => {
      await registerViaApi(app, 'Alice', 'wrong@test.dev', 'password123');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@test.dev', password: 'incorrect' });
      expect(res.status).toBe(401);
    });

    it('rejects a non-string email with 400 (no 500)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 1, password: 'password123' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const { user, token } = await registerViaApi(app, 'Alice', 'me@test.dev');
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.id.toString()).toBe(user.id.toString());
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with a forged token signed with the removed hard-coded fallback', async () => {
      const jwt = require('jsonwebtoken');
      // A token signed with the old 'dev_only_fallback_secret' must not verify:
      // the secret is either configured or ephemeral-random per session.
      const forged = jwt.sign({ sub: '507f1f77bcf86cd799439011', name: 'x', email: 'x' }, 'dev_only_fallback_secret');
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });
  });

  describe('malformed request bodies', () => {
    it('responds 400 (not 500) to invalid JSON', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('GET /api/auth/demo-status', () => {
    it('reports available:false when no demo user exists', async () => {
      const res = await request(app).get('/api/auth/demo-status');
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
    });

    it('reports available:true after seeding', async () => {
      const seed = require('../src/seed/seed');
      await seed();
      const res = await request(app).get('/api/auth/demo-status');
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
    });
  });
});
