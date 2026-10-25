const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

// @route  POST /api/auth/register
// @desc   Create a new account and sign in
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
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
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    res.json({ user: user.toSafeJSON(), token: signToken(user) });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
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
