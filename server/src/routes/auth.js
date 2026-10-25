const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, signToken } = require('../middleware/auth');
const { asyncHandler, readString, readEmail, badRequest } = require('../utils/validate');

const router = express.Router();

// @route  POST /api/auth/register
// @desc   Create a new account and sign in
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = readString(body, 'name', { label: 'Name', required: true, min: 2, max: 60 });
    const email = readEmail(body);
    if (typeof body.password !== 'string' || body.password.length < 6) {
      throw badRequest('Password must be at least 6 characters.');
    }
    if (body.password.length > 128) throw badRequest('Password must be at most 128 characters.');

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await User.create({ name, email, passwordHash });

    res.status(201).json({ user: user.toSafeJSON(), token: signToken(user) });
  })
);

// @route  POST /api/auth/login
// @desc   Sign in with email + password
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.email || !body.password) {
      throw badRequest('Email and password are required.');
    }
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      throw badRequest('Email and password must be strings.');
    }

    const user = await User.findOne({ email: body.email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    res.json({ user: user.toSafeJSON(), token: signToken(user) });
  })
);

// @route  GET /api/auth/me
// @desc   Return the currently signed-in user
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('name email');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  })
);

module.exports = router;
