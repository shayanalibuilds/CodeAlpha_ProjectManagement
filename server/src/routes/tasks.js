const express = require('express');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const { requireAuth, requireTaskMember } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const {
  asyncHandler,
  badRequest,
  readString,
  readDueDate,
  readOptionalObjectId,
} = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const TASK_POPULATE = [
  { path: 'assignee', select: 'name email' },
  { path: 'creator', select: 'name email' },
];

/** Task as sent to clients: populated, plus its current comment count. */
async function serializeTask(task) {
  const populated = await task.populate(TASK_POPULATE);
  const commentCount = await Comment.countDocuments({ task: task._id });
  return { ...populated.toObject(), commentCount };
}

function readEnum(value, allowed, label) {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) throw badRequest(`Invalid ${label}.`);
  return value;
}

function checkAssignee(project, assignee) {
  if (assignee && !project.members.some((m) => m.equals(assignee))) {
    throw badRequest('The assignee must be a project member.');
  }
}

// @route  POST /api/tasks
// @desc   Create a task on a project board
router.post(
  '/',
  requireTaskMember,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const title = readString(body, 'title', { label: 'Task title', required: true, max: 140 });
    const description = readString(body, 'description', { label: 'Description', max: 2000, allowNull: true }) || '';
    const status = readEnum(body.status, STATUSES, 'status') || 'TODO';
    const priority = readEnum(body.priority, PRIORITIES, 'priority') || 'MEDIUM';
    const dueDate = readDueDate(body.dueDate) ?? null;
    const assignee = readOptionalObjectId(body.assignee, 'Assignee') ?? null;
    checkAssignee(req.project, assignee);

    const last = await Task.findOne({ project: req.project._id, status })
      .sort({ position: -1 })
      .select('position')
      .lean();
    const task = await Task.create({
      title,
      description,
      status,
      priority,
      dueDate,
      position: (last?.position ?? 0) + 1,
      project: req.project._id,
      assignee,
      creator: req.user.id,
    });

    const payload = await serializeTask(task);
    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('task:created', {
      projectId: req.project._id.toString(),
      task: payload,
    });

    if (assignee && assignee !== req.user.id) {
      await notify(io, {
        userId: assignee,
        type: 'TASK_ASSIGNED',
        message: `${req.user.name} assigned you a task: "${task.title}" (${req.project.name}).`,
        projectId: req.project._id,
        taskId: task._id,
      });
    }

    res.status(201).json({ task: payload });
  })
);

// @route  PATCH /api/tasks/:taskId
// @desc   Update title/description/status/priority/dueDate/assignee/position
router.patch(
  '/:taskId',
  requireTaskMember,
  asyncHandler(async (req, res) => {
    const task = req.task;
    const body = req.body || {};
    const updates = {};

    const title = readString(body, 'title', { label: 'Task title', max: 140 });
    if (title !== undefined) {
      if (!title) throw badRequest('Task title cannot be empty.');
      updates.title = title;
    }
    const description = readString(body, 'description', { label: 'Description', max: 2000, allowNull: true });
    if (description !== undefined) updates.description = description;
    const status = readEnum(body.status, STATUSES, 'status');
    if (status !== undefined) updates.status = status;
    const priority = readEnum(body.priority, PRIORITIES, 'priority');
    if (priority !== undefined) updates.priority = priority;
    const dueDate = readDueDate(body.dueDate);
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (body.position !== undefined) {
      const position = Number(body.position);
      if (typeof body.position === 'boolean' || !Number.isFinite(position)) {
        throw badRequest('position must be a number.');
      }
      updates.position = position;
    }
    const assignee = readOptionalObjectId(body.assignee, 'Assignee');
    if (assignee !== undefined) {
      checkAssignee(req.project, assignee);
      updates.assignee = assignee;
    }

    // Capture RAW ids before populate() replaces them with objects
    const rawAssigneeId = task.assignee ? task.assignee.toString() : null;
    const rawCreatorId = task.creator ? task.creator.toString() : null;

    const statusChanged = updates.status && updates.status !== task.status;
    const assigneeChanged = updates.assignee !== undefined && (updates.assignee || null) !== rawAssigneeId;

    Object.assign(task, updates);
    await task.save();
    const payload = await serializeTask(task);

    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('task:updated', {
      projectId: req.project._id.toString(),
      task: payload,
    });

    if (statusChanged) {
      // Notify the current assignee (post-update) or the task creator
      const newAssigneeId = updates.assignee !== undefined ? updates.assignee || null : rawAssigneeId;
      const target = newAssigneeId || rawCreatorId;
      if (target && target !== req.user.id) {
        const labels = {
          TODO: 'moved back to To-Do',
          IN_PROGRESS: 'moved to In-Progress',
          DONE: 'marked as Done',
        };
        await notify(io, {
          userId: target,
          type: 'TASK_STATUS',
          message: `${req.user.name} ${labels[updates.status]}: "${task.title}".`,
          projectId: req.project._id,
          taskId: task._id,
        });
      }
    }

    if (assigneeChanged && updates.assignee && updates.assignee !== req.user.id) {
      await notify(io, {
        userId: updates.assignee,
        type: 'TASK_ASSIGNED',
        message: `${req.user.name} assigned you a task: "${task.title}" (${req.project.name}).`,
        projectId: req.project._id,
        taskId: task._id,
      });
    }

    res.json({ task: payload });
  })
);

// @route  DELETE /api/tasks/:taskId
// @desc   Delete a task, its comments and its notifications
router.delete(
  '/:taskId',
  requireTaskMember,
  asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    await Comment.deleteMany({ task: req.task._id });
    await Notification.deleteMany({ task: req.task._id });
    await req.task.deleteOne();

    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('task:deleted', {
      projectId: req.project._id.toString(),
      taskId: req.task._id.toString(),
    });

    res.json({ ok: true });
  })
);

module.exports = router;
