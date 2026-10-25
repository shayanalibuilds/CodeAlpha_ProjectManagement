const { io: ioClient } = require('socket.io-client');
const { setupTestEnv } = require('./helpers');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(url, user) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: { token: user.token },
      transports: ['websocket'],
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const join = (socket, projectId) =>
  new Promise((resolve) => socket.emit('project:join', { projectId }, resolve));

/** Collects every event of the given names received by a socket. */
function record(socket, names) {
  const events = [];
  for (const name of names) socket.on(name, (payload) => events.push({ name, payload }));
  return events;
}

describe('Socket.io project rooms', () => {
  let env;
  let url;
  const sockets = [];

  beforeAll(async () => {
    env = await setupTestEnv();
    url = await env.listen();
  });
  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.disconnect());
    await env.reset();
  });
  afterAll(() => env.teardown());

  test('a non-member cannot join a project room or receive its events (#1)', async () => {
    const alice = await env.register('Alice');
    const mallory = await env.register('Mallory');
    const project = await env.createProject(alice);

    const malSock = await connect(url, mallory);
    sockets.push(malSock);
    const events = record(malSock, ['task:created', 'comment:added', 'presence:update']);

    const ack = await join(malSock, project._id);
    expect(ack).toEqual({ ok: false, error: 'You are not a member of this project.' });

    const task = await env.createTask(alice, project._id, { title: 'Confidential' });
    await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'Offer is $2M' });
    await wait(150);

    expect(events).toEqual([]);
  });

  test('joining with an invalid project id is rejected (#1)', async () => {
    const alice = await env.register('Alice');
    const s = await connect(url, alice);
    sockets.push(s);
    expect(await join(s, 'not-an-id')).toEqual({ ok: false, error: 'Invalid project id.' });
  });

  test('a member can join and receives live events (#1)', async () => {
    const alice = await env.register('Alice');
    const bob = await env.register('Bob');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, bob);

    const bobSock = await connect(url, bob);
    sockets.push(bobSock);
    const events = record(bobSock, ['task:created']);
    expect(await join(bobSock, project._id)).toEqual({ ok: true });

    await env.createTask(alice, project._id, { title: 'Visible' });
    await wait(150);
    expect(events.map((e) => e.payload.task.title)).toEqual(['Visible']);
  });

  test('a removed member stops receiving project events immediately (#1, #4)', async () => {
    const alice = await env.register('Alice');
    const carol = await env.register('Carol');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, carol);

    const carolSock = await connect(url, carol);
    sockets.push(carolSock);
    const events = record(carolSock, ['task:created', 'member:left']);
    expect(await join(carolSock, project._id)).toEqual({ ok: true });

    const res = await env
      .api()
      .delete(`/api/projects/${project._id}/members/${carol.id}`)
      .set(env.auth(alice));
    expect(res.status).toBe(200);
    await wait(100);

    await env.createTask(alice, project._id, { title: 'After removal' });
    await wait(150);
    expect(events.map((e) => e.name)).toEqual(['member:left']);

    // ...and cannot rejoin.
    expect((await join(carolSock, project._id)).ok).toBe(false);
  });

  test('sockets are removed from the room when the project is deleted (#5)', async () => {
    const alice = await env.register('Alice');
    const bob = await env.register('Bob');
    const project = await env.createProject(alice);
    await env.addMember(alice, project._id, bob);
    const bobSock = await connect(url, bob);
    sockets.push(bobSock);
    const events = record(bobSock, ['project:deleted']);
    await join(bobSock, project._id);

    await env.api().delete(`/api/projects/${project._id}`).set(env.auth(alice)).expect(200);
    await wait(150);
    expect(events.map((e) => e.payload.projectId)).toEqual([project._id]);
    expect(env.io.of('/').adapter.rooms.get(`project:${project._id}`)).toBeUndefined();
  });

  test('re-joining on reconnect restores live updates (#7)', async () => {
    const alice = await env.register('Alice');
    const project = await env.createProject(alice);

    const s = await connect(url, alice);
    sockets.push(s);
    // Same pattern the Board uses: (re)join on every connect.
    const rejoin = () => s.emit('project:join', { projectId: project._id });
    s.on('connect', rejoin);
    await join(s, project._id);
    const events = record(s, ['task:created']);

    const reconnected = new Promise((resolve) => s.io.once('reconnect', resolve));
    s.io.engine.close(); // force a transport drop; the client reconnects automatically
    await reconnected;
    await wait(200);

    await env.createTask(alice, project._id, { title: 'After reconnect' });
    await wait(150);
    expect(events.map((e) => e.payload.task.title)).toEqual(['After reconnect']);
  });

  test('task:updated payloads keep the comment count (#8)', async () => {
    const alice = await env.register('Alice');
    const project = await env.createProject(alice);
    const task = await env.createTask(alice, project._id);
    await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'one' });

    const s = await connect(url, alice);
    sockets.push(s);
    await join(s, project._id);
    const events = record(s, ['task:updated', 'comment:added']);

    await env.api().patch(`/api/tasks/${task._id}`).set(env.auth(alice)).send({ status: 'DONE' }).expect(200);
    await env.api().post(`/api/tasks/${task._id}/comments`).set(env.auth(alice)).send({ content: 'two' });
    await wait(150);

    expect(events.find((e) => e.name === 'task:updated').payload.task.commentCount).toBe(1);
    // The author receives comment:added once, carrying the authoritative total.
    const added = events.filter((e) => e.name === 'comment:added');
    expect(added).toHaveLength(1);
    expect(added[0].payload.commentCount).toBe(2);
  });
});
