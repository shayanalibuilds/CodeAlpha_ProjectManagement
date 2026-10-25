const mongoose = require('mongoose');

/**
 * Small input-validation helpers shared by the routes.
 * Routes use these to answer 400 with a clear message for any invalid
 * client input, instead of letting a TypeError or Mongoose cast error
 * bubble up as a 500.
 */

const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

/**
 * Returns the trimmed string when `value` is a string of at least `min`
 * and at most `max` characters, otherwise undefined (invalid).
 */
function asTrimmedString(value, { min = 0, max = Infinity } = {}) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return undefined;
  return trimmed;
}

/** Returns true when `value` is missing (undefined/null) or a valid string within limits. */
function isOptionalString(value, limits) {
  return value === undefined || value === null || asTrimmedString(value, limits) !== undefined;
}

/**
 * Returns true when `value` is missing/empty or can be parsed as a real
 * date. Guards `new Date(garbage)` reaching Mongoose as an Invalid Date.
 */
function isOptionalDate(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Returns true when `value` is missing/empty or a valid ObjectId string.
 */
function isOptionalObjectId(value) {
  return value === undefined || value === null || value === '' || isValidObjectId(value);
}

/** Returns true when `value` is missing/empty or a plain finite number. */
function isOptionalNumber(value) {
  return value === undefined || value === null || value === '' ||
    (typeof value === 'number' && Number.isFinite(value));
}

module.exports = {
  isValidObjectId,
  asTrimmedString,
  isOptionalString,
  isOptionalDate,
  isOptionalObjectId,
  isOptionalNumber,
};
