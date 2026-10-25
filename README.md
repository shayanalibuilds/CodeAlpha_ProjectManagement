# TaskFlow: Collaborative Project Management

[![CI](https://github.com/shayanalibuilds/CodeAlpha_ProjectManagement/actions/workflows/ci.yml/badge.svg)](https://github.com/shayanalibuilds/CodeAlpha_ProjectManagement/actions/workflows/ci.yml)

A Trello-style project management app built with the MERN stack (MongoDB, Express, React, Node.js): Kanban boards, team projects, task assignment, comments, notifications and real-time updates over Socket.io.

Built for the CodeAlpha Full Stack Development Internship, Task 3: Project Management Tool.

## Features

| Area | Implementation |
|---|---|
| Authentication | Register and sign in with bcrypt-hashed passwords and JWT sessions |
| Projects | Create projects with a name, description and color; invite members by email |
| Boards | Three-column Kanban board (To-Do, In-Progress, Done) with drag and drop |
| Tasks | Title, description, priority, due date and assignee |
| Comments | Comment thread inside each task |
| Notifications | In-app bell for assignments, status changes, comments and project invites |
| Real-time | Per-project Socket.io rooms (members only), live board sync and online presence |
| Search and filters | Search tasks, filter by assignee and priority |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite |
| Backend | Node.js, Express 4 |
| Database | MongoDB with Mongoose |
| Real-time | Socket.io 4 |
| Auth | jsonwebtoken, bcryptjs |
| Quality | Jest, Supertest, mongodb-memory-server, ESLint, GitHub Actions |

## Getting started

Requirements: Node.js 18+ (20 recommended). MongoDB is optional for local development.

### 1. Install dependencies

```bash
npm install            # root: installs concurrently
npm run install-all    # server and client dependencies
```

### 2. Configure the server (required)

```bash
cp server/.env.example server/.env
```

| Variable | Description |
|---|---|
| `JWT_SECRET` | Required. The server will not start without it. The example placeholder is accepted for local development only; with `NODE_ENV=production` the server requires a random secret of at least 32 characters. |
| `MONGODB_URI` | Leave empty to use an in-memory MongoDB for local development (data resets on restart). Required in production. |
| `CLIENT_URL` | Allowed CORS origin, default `http://localhost:5173`. |
| `PORT` | API port, default `5000`. |
| `SEED_ON_START` | Seed demo data on startup when none exists. Defaults to `true` for the in-memory database. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Run in development

```bash
npm run dev
```

- API and Socket.io: http://localhost:5000
- React app (Vite, proxies `/api` and `/socket.io`): http://localhost:5173

### 4. Demo data

With the default configuration (empty `MONGODB_URI`) the server seeds the demo accounts into its in-memory database on startup, so the "Explore with the demo account" button works straight away.

To seed a persistent database, set `MONGODB_URI` and run:

```bash
npm run seed
```

`npm run seed` exits with an error when `MONGODB_URI` is empty, because there is no persistent database to seed.

| Account | Password | Role |
|---|---|---|
| `demo@taskflow.dev` | `demo1234` | Project owner |
| `alex@taskflow.dev` | `demo1234` | Member |
| `maya@taskflow.dev` | `demo1234` | Member |

### Production

```bash
npm run build                                   # builds client/dist
NODE_ENV=production npm start --prefix server   # serves the API and the built client on one port
```

Set `JWT_SECRET` and `MONGODB_URI` in the deployment environment. The server refuses to start in production if either is missing or the secret is the example placeholder.

## Testing and linting

```bash
npm test        # server API and socket tests, client date tests
npm run lint    # ESLint for server and client
```

Server tests use Jest, Supertest and mongodb-memory-server, so no external database is needed. They cover authentication, membership and owner checks, socket room authorization, member removal, cascading deletes, input validation, comment counts and due-date storage. CI runs install, lint, tests and the client build on every push and pull request.

## Usage

1. Sign up, or use the demo account.
2. Create a project from the dashboard.
3. Invite teammates by email (owner only); manage the team from the Members dialog.
4. Add tasks with the "Add task" composer in any column.
5. Open a task (click, or Enter/Space on a focused card) to edit status, priority, due date and assignee, and to comment.
6. Drag cards between columns; everyone on the board sees changes instantly.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns a JWT |
| POST | `/api/auth/login` | Sign in, returns a JWT |
| GET | `/api/auth/me` | Current user |
| GET, POST | `/api/projects` | List my projects, create a project |
| GET, PATCH, DELETE | `/api/projects/:id` | Board data, update (owner), delete with tasks, comments and notifications (owner) |
| POST | `/api/projects/:id/members` | Add a member by email (owner) |
| DELETE | `/api/projects/:id/members/:userId` | Remove a member and unassign their tasks (owner) |
| POST | `/api/tasks` | Create a task |
| PATCH, DELETE | `/api/tasks/:id` | Update or delete a task |
| GET, POST | `/api/tasks/:id/comments` | List or add comments |
| GET | `/api/notifications` | Latest notifications and unread count |
| POST | `/api/notifications/read-all` | Mark all as read |
| GET | `/api/health` | Health check and demo availability |

Invalid input (wrong types, malformed ids or JSON, invalid dates, over-length fields) returns `400` with an `error` message.

## Socket.io events

| Direction | Event | Purpose |
|---|---|---|
| client to server | `project:join`, `project:leave` | Join or leave a board room (members only) |
| server to client | `presence:update` | Online members of the board |
| server to client | `task:created`, `task:updated`, `task:deleted` | Live board sync |
| server to client | `comment:added` | Live comments with the task's comment count |
| server to client | `member:joined`, `member:left` | Team changes |
| server to client | `project:deleted` | The project was deleted |
| server to client | `notification:new` | Personal notifications |

## Project structure

```
CodeAlpha_ProjectManagement/
├── .github/workflows/ci.yml   # Lint, test and build on push and PR
├── server/                    # Express + MongoDB + Socket.io
│   ├── src/
│   │   ├── index.js           # Entry point: config checks, DB, optional seed, listen
│   │   ├── app.js             # Express app, routes, Socket.io, error handler
│   │   ├── config/            # Environment (JWT secret) and database connection
│   │   ├── middleware/        # Auth and membership guards, error handler
│   │   ├── models/            # User, Project, Task, Comment, Notification
│   │   ├── routes/            # auth, projects, tasks, comments, notifications
│   │   ├── realtime/          # Socket.io auth, rooms, presence
│   │   ├── utils/             # Validation helpers, notifications
│   │   └── seed/              # Demo data and seed script
│   └── tests/                 # Jest + Supertest + Socket.io client tests
└── client/                    # React (Vite) + Tailwind CSS
    ├── src/
    │   ├── components/        # Pages, board, task card and modal, UI primitives
    │   ├── context/           # Auth and socket providers
    │   └── lib/               # API client, constants, date helpers
    └── tests/                 # Date handling tests (node:test)
```

## Security

- Passwords are hashed with bcrypt and never returned by the API.
- JWT auth for HTTP and socket connections; the server will not start without a configured secret.
- Only project members can read board data or join a project's real-time room; removed members are disconnected from the room immediately.
- Only owners can invite or remove members and delete projects.
- CORS is restricted to the configured client origin.
