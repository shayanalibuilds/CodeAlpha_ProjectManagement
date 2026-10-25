const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');

/**
 * Starts an isolated in-memory MongoDB plus a fresh app instance.
 * Returns helpers bound to that app.
 */
async function setupTestEnv() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('taskflow-test'));
  const { app, server, io } = createApp({ serveClient: false });

  const api = () => request(app);

  async function register(name, email = `${name.toLowerCase()}@example.com`, password = 'secret123') {
    const res = await api().post('/api/auth/register').send({ name, email, password });
    if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { ...res.body.user, id: String(res.body.user.id), token: res.body.token, email };
  }

  const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

  async function createProject(owner, name = 'Project X') {
    const res = await api().post('/api/projects').set(auth(owner)).send({ name });
    if (res.status !== 201) throw new Error(`createProject failed: ${res.status}`);
    return res.body.project;
  }

  async function addMember(owner, projectId, member) {
    const res = await api()
      .post(`/api/projects/${projectId}/members`)
      .set(auth(owner))
      .send({ email: member.email });
    if (res.status !== 201) throw new Error(`addMember failed: ${res.status}`);
  }

  async function createTask(user, projectId, fields = {}) {
    const res = await api()
      .post('/api/tasks')
      .set(auth(user))
      .send({ projectId, title: 'Task', ...fields });
    if (res.status !== 201) throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.task;
  }

  async function listen() {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }

  async function teardown() {
    io.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }

  async function reset() {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  }

  return { app, server, io, api, register, auth, createProject, addMember, createTask, listen, teardown, reset };
}

module.exports = { setupTestEnv };
