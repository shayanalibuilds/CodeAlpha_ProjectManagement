require('dotenv').config();

/** Placeholder value shipped in .env.example. Never valid outside local development. */
const PLACEHOLDER_SECRETS = new Set(['change_this_to_a_long_random_secret', 'dev_only_fallback_secret']);

const TEST_SECRET = 'taskflow-test-secret';

/**
 * Returns the secret used to sign and verify JWTs.
 *
 * - NODE_ENV=test: falls back to a fixed test-only secret.
 * - Otherwise JWT_SECRET must be set, or the server refuses to start.
 * - NODE_ENV=production additionally rejects the .env.example placeholder
 *   and secrets shorter than 32 characters.
 */
function getJwtSecret(env = process.env) {
  const secret = (env.JWT_SECRET || '').trim();
  const nodeEnv = env.NODE_ENV || 'development';

  if (!secret) {
    if (nodeEnv === 'test') return TEST_SECRET;
    throw new Error(
      'JWT_SECRET is not set. Copy server/.env.example to server/.env and set JWT_SECRET to a long random string.'
    );
  }

  if (nodeEnv === 'production') {
    if (PLACEHOLDER_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET is still the example placeholder. Set a long random secret before running in production.');
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production.');
    }
  } else if (PLACEHOLDER_SECRETS.has(secret) && nodeEnv !== 'test') {
    console.warn('[config] WARNING: JWT_SECRET is the example placeholder. Fine for local development only.');
  }

  return secret;
}

let cached;
/** Lazily resolved, shared JWT secret (used by HTTP auth and the socket handshake). */
function jwtSecret() {
  if (cached === undefined) cached = getJwtSecret();
  return cached;
}

module.exports = { getJwtSecret, jwtSecret, PLACEHOLDER_SECRETS };
