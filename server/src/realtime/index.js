const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const { jwtSecret } = require('../config/env');
const { isValidObjectId } = require('../utils/validate');

/**
 * Socket.io realtime layer.
 *  - Clients authenticate via JWT in the handshake auth payload.
 *  - Each user joins a personal room `user:<id>` (notifications).
 *  - Clients join project rooms `project:<id>` for board events; only current
 *    project members are allowed in (checked on every join).
 *  - Presence (online members per project) is tracked and broadcast.
 */

// userId -> Set<socketId>
const onlineByUser = new Map();
// projectId -> Map<userId, { id, name }>
const presenceByProject = new Map();

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
      const payload = jwt.verify(token, jwtSecret());
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

    // Join a project board room (members only). The optional ack callback
    // receives { ok: true } or { ok: false, error }.
    socket.on('project:join', async (payload = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const projectId = payload?.projectId;
        if (!isValidObjectId(projectId)) {
          return reply({ ok: false, error: 'Invalid project id.' });
        }
        const isMember = await Project.exists({ _id: projectId, members: user.id });
        if (!isMember) {
          socket.emit('project:join:error', { projectId, error: 'You are not a member of this project.' });
          return reply({ ok: false, error: 'You are not a member of this project.' });
        }
        socket.join(`project:${projectId}`);

        if (!presenceByProject.has(projectId)) presenceByProject.set(projectId, new Map());
        const presence = presenceByProject.get(projectId);
        presence.set(user.id, { id: user.id, name: user.name });
        io.to(`project:${projectId}`).emit('presence:update', {
          projectId,
          online: Array.from(presence.values()),
        });
        reply({ ok: true });
      } catch (err) {
        console.error('[socket project:join]', err);
        reply({ ok: false, error: 'Could not join the project.' });
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

/**
 * Removes users' sockets from a project room (e.g. after they are removed
 * from the project) and drops them from its presence list.
 */
function removeUsersFromProject(io, projectId, userIds) {
  const pid = projectId.toString();
  const presence = presenceByProject.get(pid);
  for (const id of userIds.map(String)) {
    io.in(`user:${id}`).socketsLeave(`project:${pid}`);
    if (presence) presence.delete(id);
  }
  if (presence) {
    io.to(`project:${pid}`).emit('presence:update', {
      projectId: pid,
      online: Array.from(presence.values()),
    });
  }
}

/** Closes a project room entirely (used when a project is deleted). */
function closeProjectRoom(io, projectId) {
  const pid = projectId.toString();
  io.in(`project:${pid}`).socketsLeave(`project:${pid}`);
  presenceByProject.delete(pid);
}

module.exports = { initSocket, emitToProject, emitToUsers, removeUsersFromProject, closeProjectRoom };
