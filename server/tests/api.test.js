const mongoose = require('mongoose');
const Task = require('../src/models/Task');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const { setupTestEnv } = require('./helpers');

let env;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterEach(() => env.reset());
afterAll(() => env.teardown());

describe('auth', () => {
  test('register, login and me', async () => {
    await env.register('Alice');
    const login = await env
      .api()
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'secret123' });
    expect(login.status).toBe(200);
    const me = await env.api().get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.body.user.name).toBe('Alice');
  });

  test('wrong password is 401', async () => {
    await env.register('Alice');
    const res = await env.api().post('/api/auth/login').send({ email: 'alice@example.com', password: 'nope123' });
    expect(res.status).toBe(401);
  });
});

describe('access control', () => {
  test('non-members get 403 on project, task and comment routes; owner-only routes are enforced', async () => {
    const alice = await env.register('Alice');
    const bob = await env.register('Bob');
    const eve = await env.register('Eve');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, bob);
    const task = await env.createTask(alice, project._id);

    await env.api().get(`/api/projects/${project._id}`).set(env.auth(eve)).expect(403);
    await env.api().patch(`/api/tasks/${task._id}`).set(env.auth(eve)).send({ title: 'x' }).expect(403);
    await env.api().get(`/api/tasks/${task._id}/comments`).set(env.auth(eve)).expect(403);
    await env.api().post('/api/tasks').set(env.auth(eve)).send({ projectId: project._id, title: 't' }).expect(403);

    await env.api().get(`/api/projects/${project._id}`).set(env.auth(bob)).expect(200);
    await env.api().delete(`/api/projects/${project._id}`).set(env.auth(bob)).expect(403);
    await env
      .api()
      .delete(`/api/projects/${project._id}/members/${alice.id}`)
      .set(env.auth(bob))
      .expect(403);
  });
});

describe('removing a member (#4)', () => {
  test('unassigns them from the project tasks', async () => {
    const alice = await env.register('Alice');
    const carol = await env.register('Carol');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, carol);
    const t1 = await env.createTask(alice, project._id, { title: 't1', assignee: carol.id });
    const t2 = await env.createTask(alice, project._id, { title: 't2', assignee: alice.id });

    // Carol's assignment in another project must stay.
    const other = await env.createProject(alice, 'Other');
    await env.addMember(alice, other._id, carol);
    const t3 = await env.createTask(alice, other._id, { title: 't3', assignee: carol.id });

    const res = await env
      .api()
      .delete(`/api/projects/${project._id}/members/${carol.id}`)
      .set(env.auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.unassignedTaskIds).toEqual([t1._id]);

    const board = await env.api().get(`/api/projects/${project._id}`).set(env.auth(alice));
    const byTitle = Object.fromEntries(board.body.tasks.map((t) => [t.title, t]));
    expect(byTitle.t1.assignee).toBeNull();
    expect(byTitle.t2.assignee.name).toBe('Alice');
    expect(board.body.project.members.map((m) => m.name)).toEqual(['Alice']);

    expect(String((await Task.findById(t3._id)).assignee)).toBe(carol.id);
    expect(String((await Task.findById(t2._id)).assignee)).toBe(alice.id);
  });

  test('returns 404 for a user who is not a member and 400 for an invalid id', async () => {
    const alice = await env.register('Alice');
    const stranger = await env.register('Stranger');
    const project = await env.createProject(alice);
    await env
      .api()
      .delete(`/api/projects/${project._id}/members/${stranger.id}`)
      .set(env.auth(alice))
      .expect(404);
    await env.api().delete(`/api/projects/${project._id}/members/xyz`).set(env.auth(alice)).expect(400);
  });

  test('owner cannot remove themselves', async () => {
    const alice = await env.register('Alice');
    const project = await env.createProject(alice);
    await env.api().delete(`/api/projects/${project._id}/members/${alice.id}`).set(env.auth(alice)).expect(400);
  });
});

describe('deleting a project (#5)', () => {
  test('removes its tasks, their comments and its notifications', async () => {
    const alice = await env.register('Alice');
    const bob = await env.register('Bob');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, bob); // MEMBER_JOINED notification
    const task = await env.createTask(alice, project._id, { assignee: bob.id }); // TASK_ASSIGNED
    await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'hi' });

    // Unrelated data that must survive.
    const keep = await env.createProject(alice, 'Keep');
    const keepTask = await env.createTask(alice, keep._id);
    await env.api().post(`/api/tasks/${keepTask._id}/comments`).set(env.auth(alice)).send({ content: 'keep' });

    expect(await Comment.countDocuments({ task: task._id })).toBe(1);
    expect(await Notification.countDocuments({ project: project._id })).toBeGreaterThan(0);

    await env.api().delete(`/api/projects/${project._id}`).set(env.auth(alice)).expect(200);

    expect(await Task.countDocuments({ project: project._id })).toBe(0);
    expect(await Comment.countDocuments({ task: task._id })).toBe(0);
    expect(await Notification.countDocuments({ project: project._id })).toBe(0);
    expect(await Notification.countDocuments({ task: task._id })).toBe(0);
    expect(await Comment.countDocuments({ task: keepTask._id })).toBe(1);

    const bell = await env.api().get('/api/notifications').set(env.auth(bob));
    expect(bell.body.notifications.filter((n) => n.project === null)).toEqual([]);
  });
});

describe('input validation returns 400, not 500 (#6)', () => {
  let alice;
  let project;
  let task;
  beforeEach(async () => {
    alice = await env.register('Alice');
    project = await env.createProject(alice);
    task = await env.createTask(alice, project._id);
  });

  const cases = [
    ['POST /api/tasks title is a number', () => ['post', '/api/tasks', { projectId: project._id, title: 123 }]],
    ['POST /api/tasks invalid dueDate', () => ['post', '/api/tasks', { projectId: project._id, title: 'a', dueDate: 'notadate' }]],
    ['POST /api/tasks impossible calendar date', () => ['post', '/api/tasks', { projectId: project._id, title: 'a', dueDate: '2026-02-31' }]],
    ['POST /api/tasks 200-char title', () => ['post', '/api/tasks', { projectId: project._id, title: 'a'.repeat(200) }]],
    ['POST /api/tasks invalid assignee id', () => ['post', '/api/tasks', { projectId: project._id, title: 'a', assignee: 'nope' }]],
    ['POST /api/tasks invalid projectId', () => ['post', '/api/tasks', { projectId: 'nope', title: 'a' }]],
    ['POST /api/tasks invalid status', () => ['post', '/api/tasks', { projectId: project._id, title: 'a', status: 'LATER' }]],
    ['PATCH /api/tasks/:id garbage dueDate', () => ['patch', `/api/tasks/${task._id}`, { dueDate: 'garbage' }]],
    ['PATCH /api/tasks/:id description object', () => ['patch', `/api/tasks/${task._id}`, { description: { a: 1 } }]],
    ['PATCH /api/tasks/:id position NaN', () => ['patch', `/api/tasks/${task._id}`, { position: 'abc' }]],
    ['PATCH /api/tasks/:id invalid assignee', () => ['patch', `/api/tasks/${task._id}`, { assignee: 42 }]],
    ['PATCH /api/tasks/bad-id', () => ['patch', '/api/tasks/bad-id', { title: 'x' }]],
    ['POST /api/auth/login email number', () => ['post', '/api/auth/login', { email: 1, password: 'x' }]],
    ['POST /api/auth/register name number', () => ['post', '/api/auth/register', { name: 12345, email: 'n@x.io', password: 'secret123' }]],
    ['POST /api/auth/register password number', () => ['post', '/api/auth/register', { name: 'Nina', email: 'n@x.io', password: 12345678 }]],
    ['POST /api/projects name array', () => ['post', '/api/projects', { name: ['ab'] }]],
    ['POST /api/projects name too long', () => ['post', '/api/projects', { name: 'a'.repeat(81) }]],
    ['PATCH /api/projects/:id name number', () => ['patch', `/api/projects/${project._id}`, { name: 5 }]],
    ['GET /api/projects/bad-id', () => ['get', '/api/projects/bad-id']],
    ['POST /api/projects/:id/members email object', () => ['post', `/api/projects/${project._id}/members`, { email: { $gt: '' } }]],
    ['POST /api/tasks/:id/comments content object', () => ['post', `/api/tasks/${task._id}/comments`, { content: { a: 1 } }]],
    ['POST /api/tasks/:id/comments too long', () => ['post', `/api/tasks/${task._id}/comments`, { content: 'a'.repeat(1001) }]],
  ];

  test.each(cases)('%s', async (_name, build) => {
    const [method, url, body] = build();
    let req = env.api()[method](url).set(env.auth(alice));
    if (body !== undefined) req = req.send(body);
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  test('malformed JSON body is a 400', async () => {
    const res = await env
      .api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });

  test('a valid id that does not exist is 404', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    await env.api().get(`/api/projects/${id}`).set(env.auth(alice)).expect(404);
    await env.api().patch(`/api/tasks/${id}`).set(env.auth(alice)).send({ title: 'x' }).expect(404);
  });
});

describe('comment counts (#8)', () => {
  test('POST comment returns the total and PATCH responses keep commentCount', async () => {
    const alice = await env.register('Alice');
    const project = await env.createProject(alice);
    const task = await env.createTask(alice, project._id);
    expect(task.commentCount).toBe(0);

    const c1 = await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'a' });
    expect(c1.body.commentCount).toBe(1);
    const c2 = await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'b' });
    expect(c2.body.commentCount).toBe(2);

    const patched = await env.api().patch(`/api/tasks/${task._id}`).set(env.auth(alice)).send({ priority: 'HIGH' });
    expect(patched.status).toBe(200);
    expect(patched.body.task.commentCount).toBe(2);

    const board = await env.api().get(`/api/projects/${project._id}`).set(env.auth(alice));
    expect(board.body.tasks[0].commentCount).toBe(2);
  });
});

describe('due dates (#9)', () => {
  test('a calendar date is stored as UTC midnight of that date', async () => {
    const alice = await env.register('Alice');
    const project = await env.createProject(alice);
    const task = await env.createTask(alice, project._id, { dueDate: '2026-10-25' });
    expect(task.dueDate).toBe('2026-10-25T00:00:00.000Z');

    const patched = await env.api().patch(`/api/tasks/${task._id}`).set(env.auth(alice)).send({ dueDate: '2026-12-31' });
    expect(patched.body.task.dueDate).toBe('2026-12-31T00:00:00.000Z');

    const cleared = await env.api().patch(`/api/tasks/${task._id}`).set(env.auth(alice)).send({ dueDate: null });
    expect(cleared.body.task.dueDate).toBeNull();
  });
});

describe('deleting a task', () => {
  test('removes its comments and notifications', async () => {
    const alice = await env.register('Alice');
    const bob = await env.register('Bob');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, bob);
    const task = await env.createTask(alice, project._id, { assignee: bob.id });
    await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'x' });
    await env.api().delete(`/api/tasks/${task._id}`).set(env.auth(alice)).expect(200);
    expect(await Comment.countDocuments({ task: task._id })).toBe(0);
    expect(await Notification.countDocuments({ task: task._id })).toBe(0);
  });
});
