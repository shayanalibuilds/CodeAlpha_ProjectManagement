const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const {
  requireAuth,
  requireProjectMember,
  requireProjectOwner,
} = require('../middleware/auth');
const { notify } = require('../utils/notify');
const { removeUsersFromProject, closeProjectRoom } = require('../realtime');
const {
  asyncHandler,
  badRequest,
  readString,
  readEmail,
  isValidObjectId,
} = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

const COLORS = ['emerald', 'amber', 'rose', 'violet', 'teal', 'orange'];

function readColor(value) {
  if (value === undefined) return undefined;
  if (!COLORS.includes(value)) throw badRequest(`Color must be one of: ${COLORS.join(', ')}.`);
  return value;
}

// @route  GET /api/projects
// @desc   All projects the user belongs to, with task counts
router.get(
  '/',
  asyncHandler(async (req, res) => {
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
  })
);

// @route  POST /api/projects
// @desc   Create a project (creator becomes owner + first member)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = readString(body, 'name', { label: 'Project name', required: true, min: 2, max: 80 });
    const description = readString(body, 'description', { label: 'Description', max: 400, allowNull: true }) || '';
    const color = readColor(body.color) || 'emerald';
    const project = await Project.create({
      name,
      description,
      color,
      owner: req.user.id,
      members: [req.user.id],
    });
    res.status(201).json({ project });
  })
);

// @route  GET /api/projects/:projectId
// @desc   Full board data: project + members + tasks (with comment counts)
router.get(
  '/:projectId',
  requireProjectMember,
  asyncHandler(async (req, res) => {
    const project = await Project.findById(req.project._id)
      .populate('owner', 'name email')
      .populate('members', 'name email');

    const tasks = await Task.find({ project: req.project._id })
      .populate('assignee', 'name email')
      .populate('creator', 'name email')
      .sort({ position: 1, createdAt: 1 })
      .lean();

    // Attach comment counts for the board cards
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
  })
);

// @route  PATCH /api/projects/:projectId
// @desc   Update project settings (owner only)
router.patch(
  '/:projectId',
  requireProjectMember,
  requireProjectOwner,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = readString(body, 'name', { label: 'Project name', min: 2, max: 80 });
    if (name !== undefined) req.project.name = name;
    const description = readString(body, 'description', { label: 'Description', max: 400, allowNull: true });
    if (description !== undefined) req.project.description = description;
    const color = readColor(body.color);
    if (color !== undefined) req.project.color = color;
    await req.project.save();
    res.json({ project: req.project });
  })
);

// @route  DELETE /api/projects/:projectId
// @desc   Delete project with its tasks, their comments and its notifications (owner only)
router.delete(
  '/:projectId',
  requireProjectMember,
  requireProjectOwner,
  asyncHandler(async (req, res) => {
    const projectId = req.project._id;
    const taskIds = await Task.find({ project: projectId }).distinct('_id');

    await Comment.deleteMany({ task: { $in: taskIds } });
    await Notification.deleteMany({ $or: [{ project: projectId }, { task: { $in: taskIds } }] });
    await Task.deleteMany({ project: projectId });
    await req.project.deleteOne();

    const io = req.app.get('io');
    io.to(`project:${projectId}`).emit('project:deleted', { projectId: projectId.toString() });
    closeProjectRoom(io, projectId);

    res.json({ ok: true });
  })
);

// @route  POST /api/projects/:projectId/members
// @desc   Add a member by email (owner only)
router.post(
  '/:projectId/members',
  requireProjectMember,
  requireProjectOwner,
  asyncHandler(async (req, res) => {
    const email = readEmail(req.body);
    const user = await User.findOne({ email });
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
      projectId: req.project._id.toString(),
      member: { id: user._id, name: user.name, email: user.email },
    });

    res.status(201).json({
      member: { id: user._id, name: user.name, email: user.email },
    });
  })
);

// @route  DELETE /api/projects/:projectId/members/:userId
// @desc   Remove a member (owner only). Unassigns them from the project's tasks
//         and removes their sockets from the project room.
router.delete(
  '/:projectId/members/:userId',
  requireProjectMember,
  requireProjectOwner,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) throw badRequest('Invalid user id.');
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Owners cannot remove themselves.' });
    }
    if (!req.project.members.some((m) => m.equals(userId))) {
      return res.status(404).json({ error: 'This user is not a member of the project.' });
    }

    req.project.members = req.project.members.filter((m) => !m.equals(userId));
    await req.project.save();

    const projectId = req.project._id;
    const affected = await Task.find({ project: projectId, assignee: userId }).distinct('_id');
    if (affected.length) {
      await Task.updateMany({ _id: { $in: affected } }, { $set: { assignee: null } });
    }

    const io = req.app.get('io');
    io.to(`project:${projectId}`).emit('member:left', {
      projectId: projectId.toString(),
      userId,
      unassignedTaskIds: affected.map(String),
    });
    removeUsersFromProject(io, projectId, [userId]);

    res.json({ ok: true, unassignedTaskIds: affected.map(String) });
  })
);

module.exports = router;
