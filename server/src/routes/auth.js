const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, signToken } = require('../middleware/auth');
const { asTrimmedString } = require('../utils/validate');

const router = express.Router();

// @route  POST /api/auth/register
// @desc   Create a new account and sign in
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const cleanName = asTrimmedString(name, { min: 2, max: 60 });
    if (!cleanName) {
      return res.status(400).json({ error: 'Name must be a string of 2-60 characters.' });
    }
    const cleanEmail = asTrimmedString(email, { min: 3, max: 254 });
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email.' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be a string of at least 6 characters.' });
    }

    const existing = await User.findOne({ email: cleanEmail.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: cleanName,
      email: cleanEmail.toLowerCase(),
      passwordHash,
    });

    res.status(201).json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (err) {
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// @route  POST /api/auth/login
// @desc   Sign in with email + password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = asTrimmedString(email, { max: 254 });
    if (!cleanEmail || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: cleanEmail.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    res.json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// @route  GET /api/auth/demo-status
// @desc   Whether the demo account exists (the client hides the demo button when it doesn't)
router.get('/demo-status', async (req, res) => {
  try {
    const demo = await User.findOne({ email: 'demo@taskflow.dev' }).select('_id').lean();
    res.json({ available: Boolean(demo) });
  } catch (err) {
    console.error('[auth/demo-status]', err);
    res.json({ available: false });
  }
});

// @route  GET /api/auth/me
// @desc   Return the currently signed-in user
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('name email');
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
});

module.exports = router;
