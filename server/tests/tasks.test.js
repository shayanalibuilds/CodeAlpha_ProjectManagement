process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-secret';

const request = require('supertest');
const { createApp } = require('../src/app');
const Comment = require('../src/models/Comment');
const { setupDB, teardownDB, clearDB, createUser, bearerFor } = require('./helpers');

describe('tasks + comments API', () => {
  let app;
  let owner;
  let projectId;

  beforeAll(async () => {
    await setupDB();
    app = createApp().app;
  });

  beforeEach(async () => {
    await clearDB();
    owner = await createUser('Alice Owner', 'alice@test.dev');
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', bearerFor(owner))
      .send({ name: 'Task Project' });
    projectId = res.body.project._id;
  });

  afterAll(teardownDB);

  const post = (url, body) =>
    request(app).post(url).set('Authorization', bearerFor(owner)).send(body);

  async function createTask(overrides = {}) {
    const res = await post('/api/tasks', { projectId, title: 'A task', ...overrides });
    expect(res.status).toBe(201);
    return res.body.task;
  }

  it('creates a task and stores due dates at UTC midnight', async () => {
    const task = await createTask({ dueDate: '2026-10-25' });
    expect(task.dueDate).toBe('2026-10-25T00:00:00.000Z');
  });

  it('rejects task creation by non-members', async () => {
    const outsider = await createUser('Mallory', 'mallory@test.dev');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', bearerFor(outsider))
      .send({ projectId, title: 'Sneaky task' });
    expect(res.status).toBe(403);
  });

  it('keeps the comment count accurate across updates', async () => {
    const task = await createTask();

    // Fresh task: PATCH response reports the real (zero) count
    let res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Authorization', bearerFor(owner))
      .send({ priority: 'HIGH' });
    expect(res.status).toBe(200);
    expect(res.body.task.commentCount).toBe(0);

    await post(`/api/tasks/${task._id}/comments`, { content: 'first' });
    await post(`/api/tasks/${task._id}/comments`, { content: 'second' });

    // The count survives a move/edit instead of resetting to null/0
    res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Authorization', bearerFor(owner))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.task.commentCount).toBe(2);
  });

  it('lists comments oldest first and returns them for members', async () => {
    const task = await createTask();
    await post(`/api/tasks/${task._id}/comments`, { content: 'first' });
    await post(`/api/tasks/${task._id}/comments`, { content: 'second' });

    const res = await request(app)
      .get(`/api/tasks/${task._id}/comments`)
      .set('Authorization', bearerFor(owner));
    expect(res.status).toBe(200);
    expect(res.body.comments.map((c) => c.content)).toEqual(['first', 'second']);
    expect(res.body.comments[0].author.name).toBe('Alice Owner');
  });

  it('rejects comments by non-members', async () => {
    const task = await createTask();
    const outsider = await createUser('Mallory', 'mallory2@test.dev');
    const res = await request(app)
      .post(`/api/tasks/${task._id}/comments`)
      .set('Authorization', bearerFor(outsider))
      .send({ content: 'sneaky' });
    expect(res.status).toBe(403);
  });

  it('deletes a task together with its comments', async () => {
    const task = await createTask();
    await post(`/api/tasks/${task._id}/comments`, { content: 'to be deleted' });

    const res = await request(app)
      .delete(`/api/tasks/${task._id}`)
      .set('Authorization', bearerFor(owner));
    expect(res.status).toBe(200);

    const comments = await Comment.countDocuments({ task: task._id });
    expect(comments).toBe(0);
  });

  it('rejects invalid task ids with 400 instead of 500', async () => {
    const res = await request(app)
      .patch('/api/tasks/garbage')
      .set('Authorization', bearerFor(owner))
      .send({ title: 'x' });
    expect(res.status).toBe(400);
  });
});
