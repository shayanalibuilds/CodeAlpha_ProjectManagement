const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const {
  requireAuth,
  requireProjectMember,
  requireProjectOwner,
} = require('../middleware/auth');
const { notify } = require('../utils/notify');

const router = express.Router();
router.use(requireAuth);

const COLORS = ['emerald', 'amber', 'rose', 'violet', 'teal', 'orange'];

// @route  GET /api/projects
// @desc   All projects the user belongs to, with task counts
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ members: req.user.id })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const withCounts = await Promise.all(
      projects.map(async (p) => {
        const tasks = await Task.find({ project: p._id }).select('status').lean();
        return {
          ...p,
          taskCounts: {
            total: tasks.length,
            todo: tasks.filter((t) => t.status === 'TODO').length,
            inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
            done: tasks.filter((t) => t.status === 'DONE').length,
          },
        };
      })
    );

    res.json({ projects: withCounts });
  } catch (err) {
    console.error('[projects/list]', err);
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

// @route  POST /api/projects
// @desc   Create a project (creator becomes owner + first member)
router.post('/', async (req, res) => {
  try {
    const { name, description, color } = req.body || {};
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Project name must be at least 2 characters.' });
    }
    const project = await Project.create({
      name: name.trim(),
      description: (description || '').trim(),
      color: COLORS.includes(color) ? color : 'emerald',
      owner: req.user.id,
      members: [req.user.id],
    });
    res.status(201).json({ project });
  } catch (err) {
    console.error('[projects/create]', err);
    res.status(500).json({ error: 'Could not create the project.' });
  }
});

// @route  GET /api/projects/:projectId
// @desc   Full board data: project + members + tasks (with comment counts)
router.get('/:projectId', requireProjectMember, async (req, res) => {
  try {
    const project = await Project.findById(req.project._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    const tasks = await Task.find({ project: req.project._id })
      .populate('assignee', 'name email')
      .populate('creator', 'name email')
      .sort({ position: 1, createdAt: 1 })
      .lean();

    // Attach comment counts for the board cards
    const Comment = require('../models/Comment');
    const counts = await Comment.aggregate([
      { $match: { task: { $in: tasks.map((t) => t._id) } } },
      { $group: { _id: '$task', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));
    const tasksWithCounts = tasks.map((t) => ({
      ...t,
      commentCount: countMap[t._id.toString()] || 0,
    }));

    res.json({ project, tasks: tasksWithCounts });
  } catch (err) {
    console.error('[projects/get]', err);
    res.status(500).json({ error: 'Could not load the board.' });
  }
});

// @route  PATCH /api/projects/:projectId
// @desc   Update project settings (owner only)
router.patch('/:projectId', requireProjectMember, requireProjectOwner, async (req, res) => {
  try {
    const { name, description, color } = req.body || {};
    if (name !== undefined) {
      if (name.trim().length < 2) {
        return res.status(400).json({ error: 'Project name must be at least 2 characters.' });
      }
      req.project.name = name.trim();
    }
    if (description !== undefined) req.project.description = (description || '').trim();
    if (color !== undefined && COLORS.includes(color)) req.project.color = color;
    await req.project.save();
    res.json({ project: req.project });
  } catch (err) {
    console.error('[projects/patch]', err);
    res.status(500).json({ error: 'Could not update the project.' });
  }
});

// @route  DELETE /api/projects/:projectId
// @desc   Delete project and its tasks/comments (owner only)
router.delete('/:projectId', requireProjectMember, requireProjectOwner, async (req, res) => {
  try {
    await Task.deleteMany({ project: req.project._id });
    await req.project.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('[projects/delete]', err);
    res.status(500).json({ error: 'Could not delete the project.' });
  }
});

// @route  POST /api/projects/:projectId/members
// @desc   Add a member by email (owner only)
router.post('/:projectId/members', requireProjectMember, requireProjectOwner, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email.' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({
        error: 'No TaskFlow account with that email. Ask your teammate to sign up first.',
      });
    }
    if (req.project.members.some((m) => m.equals(user._id))) {
      return res.status(409).json({ error: 'This user is already a member.' });
    }
    req.project.members.push(user._id);
    await req.project.save();

    const io = req.app.get('io');
    await notify(io, {
      userId: user._id.toString(),
      type: 'MEMBER_JOINED',
      message: `You were added to the project "${req.project.name}".`,
      projectId: req.project._id,
    });
    io.to(`project:${req.project._id}`).emit('member:joined', {
      projectId: req.project._id,
      member: { id: user._id, name: user.name, email: user.email },
    });

    res.status(201).json({
      member: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[members/add]', err);
    res.status(500).json({ error: 'Could not add the member.' });
  }
});

// @route  DELETE /api/projects/:projectId/members/:userId
// @desc   Remove a member (owner only)
router.delete(
  '/:projectId/members/:userId',
  requireProjectMember,
  requireProjectOwner,
  async (req, res) => {
    try {
      if (req.params.userId === req.user.id) {
        return res.status(400).json({ error: 'Owners cannot remove themselves.' });
      }
      req.project.members = req.project.members.filter((m) => !m.equals(req.params.userId));
      await req.project.save();

      const io = req.app.get('io');
      io.to(`project:${req.project._id}`).emit('member:left', {
        projectId: req.project._id,
        userId: req.params.userId,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('[members/remove]', err);
      res.status(500).json({ error: 'Could not remove the member.' });
    }
  }
);

module.exports = router;
