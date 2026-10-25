const jwt = require('jsonwebtoken');
const Project = require('../models/Project');
const Task = require('../models/Task');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_fallback_secret';

/** Verifies the JWT in the Authorization header and attaches req.user. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/** Loads :projectId from the route and checks the user is a member. */
async function requireProjectMember(req, res, next) {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (!project.members.some((m) => m.equals(req.user.id))) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }
    req.project = project;
    next();
  } catch {
    return res.status(400).json({ error: 'Invalid project id.' });
  }
}

/**
 * Task-scoped guard.
 *  - PATCH/DELETE /api/tasks/:taskId and /:taskId/comments -> loads the task from the URL
 *  - POST /api/tasks -> the task does not exist yet, uses req.body.projectId instead
 * Attaches req.task (when loaded) and req.project, and checks membership.
 */
async function requireTaskMember(req, res, next) {
  try {
    const taskId = req.params.taskId;
    let projectId;

    if (taskId) {
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found.' });
      }
      req.task = task;
      projectId = task.project;
    } else {
      projectId = req.body?.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required.' });
      }
    }

    const project = await Project.findById(projectId);
    if (!project || !project.members.some((m) => m.equals(req.user.id))) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }
    req.project = project;
    next();
  } catch {
    return res.status(400).json({ error: 'Invalid task or project id.' });
  }
}

/** Owner-only guard, must run after requireProjectMember. */
function requireProjectOwner(req, res, next) {
  if (!req.project.owner.equals(req.user.id)) {
    return res.status(403).json({ error: 'Only the project owner can perform this action.' });
  }
  next();
}

module.exports = { requireAuth, signToken, requireProjectMember, requireTaskMember, requireProjectOwner };
