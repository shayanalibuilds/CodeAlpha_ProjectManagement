const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const { JWT_SECRET } = require('../config/security');

/**
 * Socket.io realtime layer.
 *  - Clients authenticate via JWT in the handshake auth payload.
 *  - Each user joins a personal room `user:<id>` (notifications).
 *  - Clients join project rooms `project:<id>` for board events — only if
 *    they are a current member of that project.
 *  - Presence (online members per project) is tracked and broadcast.
 */

// userId -> Set<socketId>
const onlineByUser = new Map();
// projectId -> Map<userId, { id, name }>
const presenceByProject = new Map();

function isObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function broadcastPresence(io, projectId) {
  const presence = presenceByProject.get(projectId);
  io.to(`project:${projectId}`).emit('presence:update', {
    projectId,
    online: presence ? Array.from(presence.values()) : [],
  });
}

/**
 * Force every socket of `userId` out of a project room (e.g. the member was
 * removed from the project). Cleans up presence and re-broadcasts it.
 */
function removeUserFromProjectRoom(io, projectId, userId) {
  if (!projectId || !userId) return;
  io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);

  const presence = presenceByProject.get(projectId);
  if (presence) {
    presence.delete(userId.toString());
    broadcastPresence(io, projectId);
  }
}

/**
 * Disband a project room entirely (e.g. the project was deleted).
 * Emits `project:deleted` first so open boards can close, then clears
 * the room and its presence state.
 */
function closeProjectRoom(io, projectId) {
  if (!projectId) return;
  io.to(`project:${projectId}`).emit('project:deleted', { projectId });
  io.in(`project:${projectId}`).socketsLeave(`project:${projectId}`);
  presenceByProject.delete(projectId);
}

function initSocket(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.sub).select('name email');
      if (!user) return next(new Error('User not found'));
      socket.data.user = { id: user._id.toString(), name: user.name, email: user.email };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // Personal room for notifications
    socket.join(`user:${user.id}`);
    if (!onlineByUser.has(user.id)) onlineByUser.set(user.id, new Set());
    onlineByUser.get(user.id).add(socket.id);

    socket.emit('connected', { user });

    // Join a project board room — members only.
    socket.on('project:join', async (payload = {}) => {
      try {
        const projectId = payload.projectId;
        if (!isObjectId(projectId)) {
          socket.emit('project:error', {
            projectId: projectId || null,
            error: 'Invalid project id.',
          });
          return;
        }

        const project = await Project.findById(projectId).select('members');
        if (!project || !project.members.some((m) => m.equals(user.id))) {
          socket.emit('project:error', {
            projectId,
            error: 'You are not a member of this project.',
          });
          return;
        }

        socket.join(`project:${projectId}`);

        if (!presenceByProject.has(projectId)) presenceByProject.set(projectId, new Map());
        const presence = presenceByProject.get(projectId);
        presence.set(user.id, { id: user.id, name: user.name });
        io.to(`project:${projectId}`).emit('presence:update', {
          projectId,
          online: Array.from(presence.values()),
        });
      } catch (err) {
        console.error('[socket project:join]', err);
        socket.emit('project:error', {
          projectId: payload.projectId || null,
          error: 'Could not join the project room.',
        });
      }
    });

    socket.on('project:leave', (payload = {}) => {
      const projectId = payload.projectId;
      if (!projectId) return;
      socket.leave(`project:${projectId}`);
      try {
        const presence = presenceByProject.get(projectId);
        if (presence) {
          // Only remove if the user has no other sockets in this room
          const stillHere = Array.from(io.of('/').adapter.rooms.get(`project:${projectId}`) || [])
            .some((sid) => io.of('/').sockets.get(sid)?.data?.user?.id === user.id);
          if (!stillHere) {
            presence.delete(user.id);
            io.to(`project:${projectId}`).emit('presence:update', {
              projectId,
              online: Array.from(presence.values()),
            });
          }
        }
      } catch (err) {
        console.error('[socket project:leave]', err);
      }
    });

    socket.on('disconnecting', () => {
      try {
        // Leave all project rooms cleanly
        for (const room of socket.rooms) {
          if (room.startsWith('project:')) {
            const projectId = room.slice('project:'.length);
            const sockets = Array.from(io.of('/').adapter.rooms.get(room) || []);
            const userStillConnected = sockets.some(
              (sid) => sid !== socket.id && io.of('/').sockets.get(sid)?.data?.user?.id === user.id
            );
            if (!userStillConnected) {
              const presence = presenceByProject.get(projectId);
              if (presence) {
                presence.delete(user.id);
                io.to(room).emit('presence:update', {
                  projectId,
                  online: Array.from(presence.values()),
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('[socket disconnecting]', err);
      }
    });

    socket.on('disconnect', () => {
      const set = onlineByUser.get(user.id);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineByUser.delete(user.id);
      }
    });
  });

  return io;
}

/** Emit an event to every socket in a project room. */
function emitToProject(io, projectId, event, payload) {
  io.to(`project:${projectId}`).emit(event, payload);
}

/** Emit an event to every socket of a set of users (personal rooms). */
function emitToUsers(io, userIds, event, payload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const id of unique) {
    io.to(`user:${id}`).emit(event, payload);
  }
}

module.exports = {
  initSocket,
  emitToProject,
  emitToUsers,
  removeUserFromProjectRoom,
  closeProjectRoom,
};
