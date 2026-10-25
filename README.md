# TaskFlow - Collaborative Project Management Tool

[![CI](https://github.com/shayanalibuilds/CodeAlpha_ProjectManagement/actions/workflows/ci.yml/badge.svg)](https://github.com/shayanalibuilds/CodeAlpha_ProjectManagement/actions/workflows/ci.yml)

A Trello-style project management application built with the **MERN stack** (MongoDB, Express.js, React, Node.js), featuring Kanban boards, group projects, task assignments, task comments, and real-time updates over WebSockets (Socket.io).

> CodeAlpha Full Stack Development Internship - Task 3: Project Management Tool

## Features

| Requirement | Implementation |
|---|---|
| **Auth system** | Register / login with hashed passwords (bcryptjs) and JWT sessions |
| **Group projects** | Create projects with name, description and color; invite members by email |
| **Project boards** | Three-column Kanban board: To-Do / In-Progress / Done |
| **Task assignment** | Assign any project member; assignee avatar on each card |
| **Task cards** | Title, description, priority (Low-Urgent), UTC-safe due dates, drag & drop |
| **Comments** | Comment thread inside each task's detail modal with live comment counts |
| **REST API** | Express + Mongoose with member/owner authorization on every route |

Bonus features:

- **Notifications** - in-app bell with unread badge (assignments, status changes, comments, invites)
- **Real-time updates** - Socket.io room per project with JWT-authenticated handshake, membership-checked joins and live presence
- **Drag & drop** - native HTML5 drag & drop with optimistic UI
- **Filters & search** - search tasks, filter by assignee and priority
- **Dashboard stats** - project, task and completion totals with progress bars
- **Accessibility** - keyboard-operable task cards, focus-managed dialogs, inline errors

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Lucide icons, Vite |
| Backend | Node.js, Express.js 4 |
| Database | MongoDB with Mongoose ODM |
| Realtime | Socket.io 4 (rooms, presence, event broadcast) |
| Auth | JWT (jsonwebtoken) + bcryptjs password hashing |
| Tooling | Jest, Supertest, mongodb-memory-server, ESLint, GitHub Actions |

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB - a local instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. No MongoDB yet? The server auto-starts an in-memory MongoDB when `MONGODB_URI` is empty (dev only, data resets on restart).

### 1. Install dependencies

```bash
npm install              # root: installs `concurrently`
npm run install-all      # installs server + client dependencies
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
```

```env
PORT=5000
MONGODB_URI=                          # empty = in-memory Mongo (dev only)
JWT_SECRET=                           # REQUIRED for any non-local deployment
CLIENT_URL=http://localhost:5173
```

> **JWT_SECRET is mandatory outside local development.** The server refuses to start when
> `NODE_ENV=production` and `JWT_SECRET` is missing (or still the `.env.example` placeholder),
> so a deployment can never silently sign tokens with a publicly known key.

### 3. Run the app (dev mode)

```bash
npm run dev
```

This starts both processes with `concurrently`:

- API + Socket.io - **http://localhost:5000**
- React app (Vite, proxies `/api` and `/socket.io` to the server) - **http://localhost:5173**

### 4. Demo data

**Default setup (no `MONGODB_URI`):** the server seeds its own in-memory database automatically on first start, so the demo accounts below work immediately - including the "Explore with the demo account" button on the login page (hidden automatically when no demo account exists). Data resets on restart.

**Persistent database (`MONGODB_URI` set):** seeding is opt-in and wipes existing data:

```bash
npm run seed
```

Demo accounts (all password `demo1234`):

| Account | Role |
|---|---|
| `demo@taskflow.dev` | Project owner |
| `alex@taskflow.dev` | Member |
| `maya@taskflow.dev` | Member |

### Tests, lint and build

```bash
npm test               # server: Jest + Supertest + mongodb-memory-server (58 tests)
npm run lint           # client: ESLint with react / react-hooks / jsx-a11y
npm run build          # client: production build into client/dist
```

### Production build

```bash
npm run build          # builds the React client into client/dist
npm start --prefix server   # Express serves the API and the built client on one port
```

CI (GitHub Actions) runs the server test suite plus the client lint and build on every push and pull request.

## How to use

1. **Sign up** (or use the demo account) - you land on the dashboard.
2. **Create a project** from the dashboard.
3. **Invite teammates** (owner only) via the *Invite* button using their TaskFlow email; manage or remove members under *Members*.
4. **Add tasks** to columns with the "+ Add task" composer.
5. **Open a task** (click or press Enter) to edit status/priority/due date, assign a member, and discuss in comments.
6. **Drag cards** between columns - everyone on the board sees the change instantly.

**Try real-time with two browsers:** sign in as `demo@taskflow.dev` in one and `maya@taskflow.dev` in the other, open the same project, and move a task - it updates live in both windows.

## REST API overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Sign in, returns JWT |
| GET | `/api/auth/me` | Current user (auth) |
| GET | `/api/auth/demo-status` | Whether the demo account exists |
| GET / POST | `/api/projects` | List my projects / create project |
| GET / PATCH / DELETE | `/api/projects/:id` | Board data / update (owner) / delete with cascade (owner) |
| POST | `/api/projects/:id/members` | Add member by email (owner) |
| DELETE | `/api/projects/:id/members/:userId` | Remove member, unassigns their tasks (owner) |
| POST | `/api/tasks` | Create task |
| PATCH / DELETE | `/api/tasks/:id` | Update (includes live comment count) / delete task |
| GET / POST | `/api/tasks/:id/comments` | List / add comments |
| GET | `/api/notifications` | Latest notifications + unread count |
| POST | `/api/notifications/read-all` | Mark all read |

## Socket.io events

| Direction | Event | Purpose |
|---|---|---|
| client -> server | `project:join` / `project:leave` | Join/leave a board room (members only) |
| server -> client | `project:error` | Join refused (invalid id or not a member) |
| server -> client | `presence:update` | Online members of the board |
| server -> client | `task:created` / `task:updated` / `task:deleted` | Live board sync |
| server -> client | `comment:added` | Live comments |
| server -> client | `member:joined` / `member:left` | Team changes |
| server -> client | `project:deleted` | Board closed (room disbanded) |
| server -> client | `notification:new` | Personal notifications |

## Project structure

```
CodeAlpha_ProjectManagement/
├── .github/workflows/ci.yml    # CI: server tests + client lint/build
├── server/                     # Express + MongoDB + Socket.io
│   ├── src/
│   │   ├── index.js            # Entry point: connect DB, auto-seed, listen
│   │   ├── app.js              # createApp(): routes, static client, socket init
│   │   ├── config/             # db connection (in-memory fallback), JWT config
│   │   ├── models/             # User, Project, Task, Comment, Notification
│   │   ├── middleware/auth.js  # JWT verification + membership guards
│   │   ├── routes/             # auth, projects, tasks, comments, notifications
│   │   ├── realtime/index.js   # Socket.io: auth handshake, member-only rooms
│   │   ├── utils/              # validation helpers, notification helper
│   │   └── seed/               # demo data seeder + startup auto-seed
│   ├── tests/                  # Jest + Supertest + socket.io-client suite
│   └── .env.example
└── client/                     # React (Vite) + Tailwind CSS
    └── src/
        ├── App.jsx             # Routes: /login, /, /project/:id
        ├── context/            # AuthContext, SocketContext
        ├── lib/                # axios instance, dates, shared constants
        └── components/         # AuthPage, Navbar, Dashboard, Board,
            │                    # TaskCard, TaskModal + ui primitives
```

## Security notes

- Passwords hashed with bcrypt (10 rounds) - never stored or returned in plain text
- JWT secret required outside local development; no hard-coded fallback is ever used
- Route-level authorization: only project members can access board data; only owners can invite/remove members or delete projects
- Socket.io rooms are membership-checked on join; removed members are evicted immediately
- CORS restricted to the configured client origin
- Invalid client input returns 400 with a clear message (never a leaked 500 stack)
