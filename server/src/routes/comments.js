const express = require('express');
const Comment = require('../models/Comment');
const { requireAuth, requireTaskMember } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { asTrimmedString } = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

// @route  GET /api/tasks/:taskId/comments
// @desc   List comments of a task (oldest first)
router.get('/:taskId/comments', requireTaskMember, async (req, res) => {
  try {
    const comments = await Comment.find({ task: req.task._id })
      .populate('author', 'name email')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ comments });
  } catch (err) {
    console.error('[comments/list]', err);
    res.status(500).json({ error: 'Could not load comments.' });
  }
});

// @route  POST /api/tasks/:taskId/comments
// @desc   Add a comment to a task and notify assignee/creator
router.post('/:taskId/comments', requireTaskMember, async (req, res) => {
  try {
    const { content } = req.body || {};
    const cleanContent = asTrimmedString(content, { min: 1, max: 1000 });
    if (!cleanContent) {
      return res
        .status(400)
        .json({ error: 'Comment cannot be empty and must be a string of at most 1000 characters.' });
    }

    const comment = await Comment.create({
      content: cleanContent,
      task: req.task._id,
      author: req.user.id,
    });
    const populated = await comment.populate('author', 'name email');

    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('comment:added', {
      projectId: req.project._id.toString(),
      taskId: req.task._id.toString(),
      comment: populated,
    });

    // Notify assignee + creator (skip the author)
    const recipients = new Set();
    if (req.task.assignee) recipients.add(req.task.assignee.toString());
    if (req.task.creator) recipients.add(req.task.creator.toString());
    recipients.delete(req.user.id);

    for (const userId of recipients) {
      const preview = comment.content.slice(0, 60) + (comment.content.length > 60 ? '…' : '');
      await notify(io, {
        userId,
        type: 'COMMENT_ADDED',
        message: `${req.user.name} commented on "${req.task.title}": "${preview}"`,
        projectId: req.project._id,
        taskId: req.task._id,
      });
    }

    res.status(201).json({ comment: populated });
  } catch (err) {
    console.error('[comments/create]', err);
    res.status(500).json({ error: 'Could not add the comment.' });
  }
});

module.exports = router;
