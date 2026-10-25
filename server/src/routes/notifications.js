const express = require('express');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// @route  GET /api/notifications
// @desc   Latest 30 notifications for the signed-in user
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });

    res.json({
      notifications: notifications.map((n) => ({
        id: n._id,
        type: n.type,
        message: n.message,
        read: n.read,
        project: n.project ? { id: n.project._id, name: n.project.name } : null,
        task: n.task,
        createdAt: n.createdAt,
      })),
      unreadCount,
    });
  } catch (err) {
    console.error('[notifications/list]', err);
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});

// @route  POST /api/notifications/read-all
// @desc   Mark all notifications as read
router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications/read-all]', err);
    res.status(500).json({ error: 'Could not update notifications.' });
  }
});

module.exports = router;
