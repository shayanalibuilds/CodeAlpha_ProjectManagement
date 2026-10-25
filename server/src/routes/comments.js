const express = require('express');
const Comment = require('../models/Comment');
const { requireAuth, requireTaskMember } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { asyncHandler, readString } = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

// @route  GET /api/tasks/:taskId/comments
// @desc   List comments of a task (oldest first)
router.get(
  '/:taskId/comments',
  requireTaskMember,
  asyncHandler(async (req, res) => {
    const comments = await Comment.find({ task: req.task._id })
      .populate('author', 'name email')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ comments });
  })
);

// @route  POST /api/tasks/:taskId/comments
// @desc   Add a comment to a task and notify assignee/creator
router.post(
  '/:taskId/comments',
  requireTaskMember,
  asyncHandler(async (req, res) => {
    const content = readString(req.body, 'content', { label: 'Comment', required: true, max: 1000 });

    const comment = await Comment.create({
      content,
      task: req.task._id,
      author: req.user.id,
    });
    const populated = await comment.populate('author', 'name email');
    const commentCount = await Comment.countDocuments({ task: req.task._id });

    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('comment:added', {
      projectId: req.project._id.toString(),
      taskId: req.task._id.toString(),
      comment: populated,
      commentCount,
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

    res.status(201).json({ comment: populated, commentCount });
  })
);

module.exports = router;
