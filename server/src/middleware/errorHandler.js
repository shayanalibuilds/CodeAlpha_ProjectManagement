const mongoose = require('mongoose');

/**
 * Global error handler. Client mistakes become 400s with a clear message;
 * only genuine server faults are logged and returned as 500.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ error: first?.message || 'Invalid input.' });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid value for ${err.path}.` });
  }
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  if (process.env.NODE_ENV !== 'test') console.error('[unhandled]', err);
  res.status(500).json({ error: 'Unexpected server error.' });
}

module.exports = errorHandler;
