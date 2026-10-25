const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../src/config/env');
const { setupTestEnv } = require('./helpers');

describe('JWT secret configuration (#2)', () => {
  test('refuses to start in production without JWT_SECRET', () => {
    expect(() => getJwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET is not set/);
  });

  test('refuses the .env.example placeholder and the old fallback in production', () => {
    expect(() =>
      getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'change_this_to_a_long_random_secret' })
    ).toThrow(/placeholder/);
    expect(() => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'dev_only_fallback_secret' })).toThrow(
      /placeholder/
    );
  });

  test('refuses short secrets in production', () => {
    expect(() => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/32 characters/);
  });

  test('requires JWT_SECRET in development too', () => {
    expect(() => getJwtSecret({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET is not set/);
    expect(() => getJwtSecret({})).toThrow(/JWT_SECRET is not set/);
  });

  test('accepts a strong secret in production', () => {
    const secret = 'x'.repeat(48);
    expect(getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret })).toBe(secret);
  });

  test('only the test environment gets a fallback', () => {
    expect(getJwtSecret({ NODE_ENV: 'test' })).toEqual(expect.any(String));
  });
});

describe('forged tokens (#2)', () => {
  let env;
  beforeAll(async () => {
    env = await setupTestEnv();
  });
  afterAll(() => env.teardown());

  test('a token signed with the old hard-coded fallback secret is rejected', async () => {
    const victim = await env.register('Victim');
    const forged = jwt.sign({ sub: victim.id, name: 'x', email: 'x' }, 'dev_only_fallback_secret');
    const res = await env.api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('a token signed with the real secret is accepted', async () => {
    const user = await env.register('Real');
    const res = await env.api().get('/api/auth/me').set(env.auth(user));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('real@example.com');
  });
});
