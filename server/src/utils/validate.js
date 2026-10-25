const mongoose = require('mongoose');

/** Error carrying an HTTP status, turned into a JSON response by the global error handler. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const badRequest = (message) => new HttpError(400, message);

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value);
}

/**
 * Reads a string field from a request body.
 * Throws a 400 HttpError when the value has the wrong type or length.
 *   required: missing/empty is an error
 *   min/max:  length bounds after trimming
 * Returns the trimmed string, or undefined when the field is absent and optional.
 */
function readString(body, field, { label = field, required = false, min = 0, max = Infinity, allowNull = false } = {}) {
  const value = body?.[field];
  if (value === undefined || (allowNull && value === null)) {
    if (required) throw badRequest(`${label} is required.`);
    return value === null ? '' : undefined;
  }
  if (typeof value !== 'string') throw badRequest(`${label} must be a string.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(`${label} is required.`);
  if (trimmed.length < min) throw badRequest(`${label} must be at least ${min} characters.`);
  if (trimmed.length > max) throw badRequest(`${label} must be at most ${max} characters.`);
  return trimmed;
}

/**
 * Parses a due date. Accepts null/'' (clears the date), a calendar date
 * 'YYYY-MM-DD' (stored as UTC midnight), or any ISO date string.
 */
function readDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('dueDate must be a date string (YYYY-MM-DD).');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
      throw badRequest('dueDate is not a valid date.');
    }
    return d;
  }
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) throw badRequest('dueDate is not a valid date.');
  return new Date(ts);
}

/** Reads an optional ObjectId field (null/'' allowed to clear). */
function readOptionalObjectId(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!isValidObjectId(value)) throw badRequest(`${label} is not a valid id.`);
  return value;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function readEmail(body, field = 'email') {
  const email = readString(body, field, { label: 'Email', required: true, max: 254 });
  if (!EMAIL_RE.test(email)) throw badRequest('Please provide a valid email.');
  return email.toLowerCase();
}

/** Wraps an async route handler so thrown errors reach the global error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  HttpError,
  badRequest,
  isValidObjectId,
  readString,
  readDueDate,
  readOptionalObjectId,
  readEmail,
  asyncHandler,
};
