process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-secret';

const request = require('supertest');
const { createApp } = require('../src/app');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const {
  setupDB,
  teardownDB,
  clearDB,
  createUser,
  bearerFor,
  registerViaApi,
} = require('./helpers');

describe('projects API', () => {
  let app;
  let owner; // alice
  let member; // bob
  let outsider; // mallory

  beforeAll(async () => {
    await setupDB();
    app = createApp().app;
  });

  beforeEach(async () => {
    await clearDB();
    owner = await createUser('Alice Owner', 'alice@test.dev');
    member = await createUser('Bob Member', 'bob@test.dev');
    outsider = await createUser('Mallory Outsider', 'mallory@test.dev');
  });

  afterAll(teardownDB);

  async function createProject() {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', bearerFor(owner))
      .send({ name: 'Secret Project' });
    expect(res.status).toBe(201);
    return res.body.project;
  }

  async function addMember(projectId) {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', bearerFor(owner))
      .send({ email: 'bob@test.dev' });
    expect(res.status).toBe(201);
    return res.body.member;
  }

  async function createAssignedTask(projectId, assigneeId) {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', bearerFor(owner))
      .send({ projectId, title: 'Assigned task', assignee: assigneeId });
    expect(res.status).toBe(201);
    return res.body.task;
  }

  describe('membership authorization', () => {
    it('lets a non-member create but not read a project', async () => {
      const project = await createProject();
      const res = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(outsider));
      expect(res.status).toBe(403);
    });

    it('lets members read the board', async () => {
      const project = await createProject();
      await addMember(project._id);
      const res = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(member));
      expect(res.status).toBe(200);
      expect(res.body.project._id).toBe(project._id.toString());
    });

    it('rejects non-owners on owner-only routes', async () => {
      const project = await createProject();
      await addMember(project._id);

      const patch = await request(app)
        .patch(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(member))
        .send({ name: 'Hacked' });
      expect(patch.status).toBe(403);

      const del = await request(app)
        .delete(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(member));
      expect(del.status).toBe(403);

      const invite = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', bearerFor(member))
        .send({ email: 'mallory@test.dev' });
      expect(invite.status).toBe(403);
    });
  });

  describe('member management', () => {
    it('adds a member by email and rejects unknown emails and duplicates', async () => {
      const project = await createProject();

      const missing = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', bearerFor(owner))
        .send({ email: 'nobody@test.dev' });
      expect(missing.status).toBe(404);

      await addMember(project._id);
      const dup = await request(app)
        .post(`/api/projects/${project._id}/members`)
        .set('Authorization', bearerFor(owner))
        .send({ email: 'bob@test.dev' });
      expect(dup.status).toBe(409);
    });

    it('unassigns the removed member from tasks and reports non-members', async () => {
      const project = await createProject();
      await addMember(project._id);
      const task = await createAssignedTask(project._id, member._id);

      const invalid = await request(app)
        .delete(`/api/projects/${project._id}/members/garbage`)
        .set('Authorization', bearerFor(owner));
      expect(invalid.status).toBe(400);

      const notMember = await request(app)
        .delete(`/api/projects/${project._id}/members/${outsider._id}`)
        .set('Authorization', bearerFor(owner));
      expect(notMember.status).toBe(404);

      const removed = await request(app)
        .delete(`/api/projects/${project._id}/members/${member._id}`)
        .set('Authorization', bearerFor(owner));
      expect(removed.status).toBe(200);
      expect(removed.body.unassignedTasks).toBe(1);

      // The removed member lost access...
      const denied = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(member));
      expect(denied.status).toBe(403);

      // ...and no longer appears as assignee on the board.
      const board = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(owner));
      const shown = board.body.tasks.find((t) => t._id === task._id);
      expect(shown.assignee).toBeNull();

      const persisted = await Task.findById(task._id);
      expect(persisted.assignee).toBeNull();
    });

    it('blocks owners from removing themselves', async () => {
      const project = await createProject();
      const res = await request(app)
        .delete(`/api/projects/${project._id}/members/${owner._id}`)
        .set('Authorization', bearerFor(owner));
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id cascade', () => {
    it('removes tasks, comments and notifications with the project', async () => {
      const project = await createProject();
      await addMember(project._id);
      const task = await createAssignedTask(project._id, member._id);

      await request(app)
        .post(`/api/tasks/${task._id}/comments`)
        .set('Authorization', bearerFor(owner))
        .send({ content: 'This comment must not survive the project' });

      // Give bob a notification pointing at the project
      await Notification.create({
        user: member._id,
        type: 'TASK_ASSIGNED',
        message: 'Demo User assigned you a task',
        project: project._id,
        task: task._id,
      });

      const del = await request(app)
        .delete(`/api/projects/${project._id}`)
        .set('Authorization', bearerFor(owner));
      expect(del.status).toBe(200);

      expect(await Project.countDocuments({ _id: project._id })).toBe(0);
      expect(await Task.countDocuments({ project: project._id })).toBe(0);
      expect(await Comment.countDocuments({ task: task._id })).toBe(0);
      expect(await Notification.countDocuments({ project: project._id })).toBe(0);
    });
  });

  describe('project input validation', () => {
    it('rejects a short name with 400', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', bearerFor(owner))
        .send({ name: 'a' });
      expect(res.status).toBe(400);
    });
  });

  describe('auth via API registration', () => {
    it('works end-to-end with registerViaApi users', async () => {
      const { token } = await registerViaApi(app, 'Api User', 'apiuser@test.dev');
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'API Project' });
      expect(res.status).toBe(201);
    });
  });
});
