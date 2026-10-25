process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-suite-secret';

const request = require('supertest');
const { io: Client } = require('socket.io-client');
const { createApp } = require('../src/app');
const { signToken } = require('../src/middleware/auth');
const User = require('../src/models/User');
const { setupDB, teardownDB, clearDB, createUser, bearerFor, wait, collector } = require('./helpers');

describe('Socket.io room authorization', () => {
  let app;
  let server;
  let url;
  let owner; // alice
  let member; // bob
  let outsider; // mallory
  const clients = new Set();

  beforeAll(async () => {
    await setupDB();
    ({ app, server } = createApp());
    await new Promise((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  beforeEach(async () => {
    await clearDB();
    owner = await createUser('Alice Owner', 'alice@test.dev');
    member = await createUser('Bob Member', 'bob@test.dev');
    outsider = await createUser('Mallory Outsider', 'mallory@test.dev');
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients.clear();
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await teardownDB();
  });

  function connect(user) {
    const socket = Client(url, {
      auth: { token: signToken(user) },
      transports: ['websocket'],
    });
    clients.add(socket);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('socket connect timeout')), 10000);
      socket.on('connect', () => {
        clearTimeout(t);
        resolve(socket);
      });
      socket.on('connect_error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });
  }

  async function createProject() {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', bearerFor(owner))
      .send({ name: 'Socket Project' });
    expect(res.status).toBe(201);
    const projectId = res.body.project._id;
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', bearerFor(owner))
      .send({ email: 'bob@test.dev' });
    return projectId;
  }

  it('rejects an invalid handshake token', async () => {
    const socket = Client(url, { auth: { token: 'not-a-token' }, transports: ['websocket'] });
    clients.add(socket);
    const outcome = await new Promise((resolve) => {
      socket.on('connect', () => resolve('connected'));
      socket.on('connect_error', (err) => resolve(err.message));
    });
    expect(outcome).not.toBe('connected');
  });

  it('lets a member join and receive live board events', async () => {
    const projectId = await createProject();
    const bob = await connect(member);
    const created = collector(bob, 'task:created');

    bob.emit('project:join', { projectId });
    await wait(200);

    await request(app)
      .post('/api/tasks')
      .set('Authorization', bearerFor(owner))
      .send({ projectId, title: 'Live task' });

    await wait(300);
    expect(created).toHaveLength(1);
    expect(created[0].task.title).toBe('Live task');
    expect(created[0].projectId).toBe(projectId.toString());
  });

  it('keeps an outsider out of the room even with a valid token', async () => {
    const projectId = await createProject();
    const mallory = await connect(outsider);
    const created = collector(mallory, 'task:created');
    const joinErrors = collector(mallory, 'project:error');

    mallory.emit('project:join', { projectId });
    await wait(200);

    // Mallory was refused instead of silently joining
    expect(joinErrors).toHaveLength(1);
    expect(joinErrors[0].projectId).toBe(projectId.toString());

    await request(app)
      .post('/api/tasks')
      .set('Authorization', bearerFor(owner))
      .send({ projectId, title: 'Confidential task' });

    await wait(300);
    expect(created).toHaveLength(0);
  });

  it('stops sending events to a member removed from the project', async () => {
    const projectId = await createProject();
    const bob = await connect(member);
    const created = collector(bob, 'task:created');
    const leftEvents = collector(bob, 'member:left');

    bob.emit('project:join', { projectId });
    await wait(200);

    // Owner removes bob via the REST API
    const bobUser = await User.findOne({ email: 'bob@test.dev' });
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${bobUser._id}`)
      .set('Authorization', bearerFor(owner));
    expect(res.status).toBe(200);
    await wait(200);
    expect(leftEvents).toHaveLength(1);

    // Bob's sockets were evicted from the room: no more live events
    await request(app)
      .post('/api/tasks')
      .set('Authorization', bearerFor(owner))
      .send({ projectId, title: 'After removal' });

    await wait(300);
    expect(created).toHaveLength(0);
  });

  it('tells every socket when the project is deleted', async () => {
    const projectId = await createProject();
    const bob = await connect(member);
    const deleted = collector(bob, 'project:deleted');

    bob.emit('project:join', { projectId });
    await wait(200);

    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', bearerFor(owner));
    expect(res.status).toBe(200);

    await wait(300);
    expect(deleted).toHaveLength(1);
    expect(deleted[0].projectId).toBe(projectId.toString());
  });
});
