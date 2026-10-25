const path = require('path');

describe('JWT secret configuration (no hard-coded fallback)', () => {
  const securityPath = path.join(__dirname, '..', 'src', 'config', 'security.js');

  function loadFresh(env) {
    jest.resetModules();
    const saved = { ...process.env };
    // Keep PATH etc., drop secret-related vars
    delete process.env.JWT_SECRET;
    Object.assign(process.env, env);
    try {
      return require(securityPath);
    } finally {
      process.env = saved;
    }
  }

  it('throws when JWT_SECRET is missing in production', () => {
    expect(() => loadFresh({ NODE_ENV: 'production' })).toThrow(
      /Refusing to start: JWT_SECRET is not set/
    );
  });

  it('throws when JWT_SECRET is the .env.example placeholder in production', () => {
    expect(() =>
      loadFresh({ NODE_ENV: 'production', JWT_SECRET: 'change_this_to_a_long_random_secret' })
    ).toThrow(/placeholder/);
  });

  it('exposes the configured secret in production when set', () => {
    const { JWT_SECRET } = loadFresh({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-long-random-production-secret',
    });
    expect(JWT_SECRET).toBe('a-long-random-production-secret');
  });

  it('uses an ephemeral random secret in development instead of a public fallback', () => {
    const first = loadFresh({ NODE_ENV: 'development' });
    const second = loadFresh({ NODE_ENV: 'development' });
    expect(typeof first.JWT_SECRET).toBe('string');
    expect(first.JWT_SECRET.length).toBeGreaterThanOrEqual(64);
    // Ephemeral, never the value that used to be hard-coded
    expect(first.JWT_SECRET).not.toBe('dev_only_fallback_secret');
    // Random per session, so tokens signed with a publicly known value can't exist
    expect(second.JWT_SECRET).not.toBe(first.JWT_SECRET);
  });
});
