const Notification = require('../models/Notification');
const { emitToUsers } = require('../realtime');

/**
 * Creates a notification and pushes it in real time to the recipient.
 * `io` is the socket.io server instance attached to app in index.js.
 */
async function notify(io, { userId, type, message, projectId = null, taskId = null }) {
  if (!userId) return null;
  const notification = await Notification.create({
    user: userId,
    type,
    message: message.length > 300 ? `${message.slice(0, 299)}…` : message,
    project: projectId,
    task: taskId,
  });
  const populated = await notification.populate('project', 'name');
  emitToUsers(io, [userId.toString()], 'notification:new', {
    id: populated._id,
    type: populated.type,
    message: populated.message,
    read: populated.read,
    project: populated.project ? { id: populated.project._id, name: populated.project.name } : null,
    task: populated.task ? populated.task.toString() : null,
    createdAt: populated.createdAt,
  });
  return notification;
}

module.exports = { notify };
