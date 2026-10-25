const express = require('express');
const Task = require('../models/Task');
const { requireAuth, requireTaskMember } = require('../middleware/auth');
const { notify } = require('../utils/notify');
const {
  asTrimmedString,
  isOptionalString,
  isOptionalDate,
  isOptionalObjectId,
  isOptionalNumber,
} = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const TASK_POPULATE = [
  { path: 'assignee', select: 'name email' },
  { path: 'creator', select: 'name email' },
];

// @route  POST /api/tasks
// @desc   Create a task on a project board
router.post('/', requireTaskMember, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignee } = req.body || {};
    const cleanTitle = asTrimmedString(title, { min: 1, max: 140 });
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Task title is required (max 140 characters).' });
    }
    if (!isOptionalString(description, { max: 2000 })) {
      return res.status(400).json({ error: 'Description must be a string of at most 2000 characters.' });
    }
    if (!isOptionalDate(dueDate)) {
      return res.status(400).json({ error: 'Due date is not a valid date.' });
    }
    if (!isOptionalObjectId(assignee)) {
      return res.status(400).json({ error: 'The assignee must be a valid user id.' });
    }
    if (assignee && !req.project.members.some((m) => m.equals(assignee))) {
      return res.status(400).json({ error: 'The assignee must be a project member.' });
    }

    const last = await Task.findOne({ project: req.project._id, status: status || 'TODO' })
      .sort({ position: -1 })
      .select('position')
      .lean();
    const task = await Task.create({
      title: cleanTitle,
      description: (typeof description === 'string' ? description : '').trim(),
      status: STATUSES.includes(status) ? status : 'TODO',
      priority: PRIORITIES.includes(priority) ? priority : 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      position: (last?.position ?? 0) + 1,
      project: req.project._id,
      assignee: assignee || null,
      creator: req.user.id,
    });

    const populated = await task.populate(TASK_POPULATE);
    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('task:created', {
      projectId: req.project._id.toString(),
      task: populated,
    });

    if (assignee && assignee.toString() !== req.user.id) {
      await notify(io, {
        userId: assignee.toString(),
        type: 'TASK_ASSIGNED',
        message: `${req.user.name} assigned you a task: "${task.title}" (${req.project.name}).`,
        projectId: req.project._id,
        taskId: task._id,
      });
    }

    res.status(201).json({ task: populated });
  } catch (err) {
    console.error('[tasks/create]', err);
    res.status(500).json({ error: 'Could not create the task.' });
  }
});

// @route  PATCH /api/tasks/:taskId
// @desc   Update title/description/status/priority/dueDate/assignee/position
router.patch('/:taskId', requireTaskMember, async (req, res) => {
  try {
    const task = req.task;
    const body = req.body || {};
    const updates = {};

    if (body.title !== undefined) {
      const cleanTitle = asTrimmedString(body.title, { min: 1, max: 140 });
      if (!cleanTitle) {
        return res.status(400).json({ error: 'Task title must be a string of 1-140 characters.' });
      }
      updates.title = cleanTitle;
    }
    if (body.description !== undefined) {
      const cleanDescription = asTrimmedString(body.description, { max: 2000 });
      if (cleanDescription === undefined) {
        return res.status(400).json({ error: 'Description must be a string of at most 2000 characters.' });
      }
      updates.description = cleanDescription;
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      updates.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority)) {
        return res.status(400).json({ error: 'Invalid priority.' });
      }
      updates.priority = body.priority;
    }
    if (body.dueDate !== undefined) {
      if (!isOptionalDate(body.dueDate)) {
        return res.status(400).json({ error: 'Due date is not a valid date.' });
      }
      updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.position !== undefined) {
      if (!isOptionalNumber(body.position)) {
        return res.status(400).json({ error: 'Position must be a number.' });
      }
      updates.position = Number(body.position) || 0;
    }
    if (body.assignee !== undefined) {
      if (!isOptionalObjectId(body.assignee)) {
        return res.status(400).json({ error: 'The assignee must be a valid user id.' });
      }
      if (body.assignee && !req.project.members.some((m) => m.equals(body.assignee))) {
        return res.status(400).json({ error: 'The assignee must be a project member.' });
      }
      updates.assignee = body.assignee || null;
    }

    // Capture RAW ids before populate() replaces them with objects
    const rawAssigneeId = task.assignee ? task.assignee.toString() : null;
    const rawCreatorId = task.creator ? task.creator.toString() : null;

    const statusChanged = updates.status && updates.status !== task.status;
    const assigneeChanged =
      updates.assignee !== undefined &&
      (updates.assignee || null)?.toString() !== (rawAssigneeId || '');

    Object.assign(task, updates);
    await task.save();
    const populated = await task.populate(TASK_POPULATE);

    // Include the live comment count: the plain task document has none, and
    // clients replace the whole task on update, which used to reset the
    // comment badge to 0 after every move/edit.
    const Comment = require('../models/Comment');
    const commentCount = await Comment.countDocuments({ task: task._id });
    const taskWithCount = { ...populated.toJSON(), commentCount };

    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('task:updated', {
      projectId: req.project._id.toString(),
      task: taskWithCount,
    });

    if (statusChanged) {
      // Notify the current assignee (post-update) or the task creator
      const newAssigneeId =
        updates.assignee !== undefined ? updates.assignee || null : rawAssigneeId;
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

    if (assigneeChanged && updates.assignee && updates.assignee.toString() !== req.user.id) {
      await notify(io, {
        userId: updates.assignee.toString(),
        type: 'TASK_ASSIGNED',
        message: `${req.user.name} assigned you a task: "${task.title}" (${req.project.name}).`,
        projectId: req.project._id,
        taskId: task._id,
      });
    }

    res.json({ task: taskWithCount });
  } catch (err) {
    console.error('[tasks/patch]', err);
    res.status(500).json({ error: 'Could not update the task.' });
  }
});

// @route  DELETE /api/tasks/:taskId
// @desc   Delete a task and its comments
router.delete('/:taskId', requireTaskMember, async (req, res) => {
  try {
    const Comment = require('../models/Comment');
    await Comment.deleteMany({ task: req.task._id });
    await req.task.deleteOne();

    const io = req.app.get('io');
    io.to(`project:${req.project._id}`).emit('task:deleted', {
      projectId: req.project._id.toString(),
      taskId: req.task._id.toString(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[tasks/delete]', err);
    res.status(500).json({ error: 'Could not delete the task.' });
  }
});

module.exports = router;
