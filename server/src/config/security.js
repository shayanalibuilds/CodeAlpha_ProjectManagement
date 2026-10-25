require('dotenv').config();
const crypto = require('crypto');

/**
 * Central place for security-critical configuration.
 * Both the HTTP auth middleware and the Socket.io handshake must use the
 * exact same JWT secret, and that secret must never fall back to a value
 * that is publicly readable in the repository.
 */

const PLACEHOLDER_SECRETS = new Set([
  'change_this_to_a_long_random_secret',
  'changeme',
  'secret',
]);

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function loadJwtSecret() {
  const raw = (process.env.JWT_SECRET || '').trim();
  const placeholder = PLACEHOLDER_SECRETS.has(raw);

  if (isProduction()) {
    if (!raw) {
      throw new Error(
        'Refusing to start: JWT_SECRET is not set. Generate a long random secret ' +
          '(e.g. `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`) ' +
          'and set it via server/.env or the process environment.'
      );
    }
    if (placeholder) {
      throw new Error(
        'Refusing to start: JWT_SECRET is still the .env.example placeholder. ' +
          'Replace it with a long random secret before deploying.'
      );
    }
    return raw;
  }

  if (!raw || placeholder) {
    console.warn(
      '[security] JWT_SECRET is not set (or is the .env.example placeholder). ' +
        'Using an ephemeral random secret for this session; all sessions are ' +
        'invalidated on restart. Set JWT_SECRET for anything beyond local dev.'
    );
    // Ephemeral secret instead of a hard-coded string so tokens can never be
    // forged with a value readable in the public repository.
    return crypto.randomBytes(48).toString('hex');
  }

  return raw;
}

const JWT_SECRET = loadJwtSecret();

module.exports = { JWT_SECRET };
