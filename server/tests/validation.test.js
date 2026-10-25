process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-secret';

const request = require('supertest');
const { createApp } = require('../src/app');
const { setupDB, teardownDB, clearDB, registerViaApi } = require('./helpers');

describe('input validation (400 instead of 500)', () => {
  let app;
  let token;
  let projectId;

  beforeAll(async () => {
    await setupDB();
    app = createApp().app;
    const { token: t } = await registerViaApi(app, 'Owner', 'owner@test.dev');
    token = t;
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Validation Project' });
    projectId = res.body.project._id;
  });

  afterAll(teardownDB);

  const post = (url, body) =>
    request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
  const patch = (url, body) =>
    request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body);

  it.each([
    ['POST /api/tasks with numeric title', () => post('/api/tasks', { projectId, title: 123 })],
    [
      'POST /api/tasks with invalid dueDate',
      () => post('/api/tasks', { projectId, title: 'a', dueDate: 'notadate' }),
    ],
    [
      'POST /api/tasks with over-length title',
      () => post('/api/tasks', { projectId, title: 'a'.repeat(200) }),
    ],
    [
      'POST /api/tasks with non-member assignee',
      () => post('/api/tasks', { projectId, title: 'a', assignee: '111111111111111111111111' }),
    ],
    [
      'POST /api/tasks with garbage assignee id',
      () => post('/api/tasks', { projectId, title: 'a', assignee: 'garbage' }),
    ],
    [
      'POST /api/tasks with invalid projectId',
      () => post('/api/tasks', { projectId: 'garbage', title: 'a' }),
    ],
    [
      'PATCH /api/tasks/:id with garbage dueDate',
      async () => {
        const created = await post('/api/tasks', { projectId, title: 'valid' });
        return patch(`/api/tasks/${created.body.task._id}`, { dueDate: 'garbage' });
      },
    ],
    [
      'PATCH /api/tasks/:id with invalid status',
      async () => {
        const created = await post('/api/tasks', { projectId, title: 'valid' });
        return patch(`/api/tasks/${created.body.task._id}`, { status: 'NOPE' });
      },
    ],
    ['POST /api/auth/login with numeric email', () => post('/api/auth/login', { email: 1, password: 'x' })],
    [
      'POST /api/auth/register with numeric name',
      () => post('/api/auth/register', { name: 12345, email: 'v@test.dev', password: 'password123' }),
    ],
    ['POST /api/projects with array name', () => post('/api/projects', { name: ['ab'] })],
    [
      'POST /api/projects with over-length description',
      () => post('/api/projects', { name: 'Fine', description: 'x'.repeat(401) }),
    ],
    [
      'POST /api/tasks/:id/comments with object content',
      async () => {
        const created = await post('/api/tasks', { projectId, title: 'valid' });
        return post(`/api/tasks/${created.body.task._id}/comments`, { content: { a: 1 } });
      },
    ],
    [
      'POST /api/tasks/:id/comments with over-length content',
      async () => {
        const created = await post('/api/tasks', { projectId, title: 'valid' });
        return post(`/api/tasks/${created.body.task._id}/comments`, { content: 'x'.repeat(1001) });
      },
    ],
  ])('%s -> 400', async (_name, makeRequest) => {
    const res = await makeRequest();
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('responds 400 (not 500) to malformed JSON', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
  });

  it('responds 400 (not 500) to invalid project id in the URL', async () => {
    const res = await request(app).get('/api/projects/garbage').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
