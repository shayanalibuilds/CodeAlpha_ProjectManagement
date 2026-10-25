# TaskFlow — Collaborative Project Management Tool

A Trello-style project management application built with the **MERN stack** (MongoDB, Express.js, React, Node.js) featuring Kanban boards, group projects, task assignments, task comments, and **real-time updates over WebSockets (Socket.io)**.

> **CodeAlpha Full Stack Development Internship — Task 3: Project Management Tool**

---

## ✨ Features

### Core requirements (Task 3)

| Requirement | Implementation |
|---|---|
| **Auth system** | Register / login with hashed passwords (bcryptjs) and JWT sessions |
| **Create group projects** | Create projects with name, description and color; invite members by email |
| **Project boards** | Three-column Kanban board: To-Do / In-Progress / Done |
| **Assign tasks** | Assign any project member to a task; avatar shown on the card |
| **Task cards** | Title, description, priority (Low → Urgent), due date, drag & drop between columns |
| **Comment & communicate within tasks** | Threaded comment section inside each task's detail modal |
| **Backend: users, projects, tasks, comments** | Full REST API with Express + Mongoose (MongoDB) |

### Bonus features

- 🔔 **Notifications** — in-app bell with unread badge: task assigned, task status changed, new comment, added to a project
- ⚡ **Real-time updates (WebSockets)** — Socket.io room per project: every create/move/comment appears instantly for all members; JWT-authenticated handshake; live "online members" presence
- 🖱️ **Drag & drop** — native HTML5 drag & drop with optimistic UI updates
- 🔎 **Filters & search** — search tasks, filter by assignee and priority
- 📊 **Dashboard stats** — projects, total tasks, completed; per-project progress bars

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Lucide icons, Vite |
| Backend | Node.js, Express.js 4 |
| Database | MongoDB with Mongoose ODM |
| Realtime | Socket.io 4 (rooms, presence, event broadcast) |
| Auth | JWT (jsonwebtoken) + bcryptjs password hashing |

---

## 🚀 Getting started

### Prerequisites

- **Node.js 18+**
- **MongoDB** — either a local instance **or** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.
  *No MongoDB yet? The server auto-starts an **in-memory MongoDB** when `MONGODB_URI` is empty — perfect for a quick demo (data resets on restart).*

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

- API + Socket.io → **http://localhost:5000**
- React app (Vite, proxies `/api` & `/socket.io` to the server) → **http://localhost:5173**

### 4. Seed demo data (optional but recommended)

```bash
npm run seed
```

Demo accounts (all password `demo1234`):

| Account | Role |
|---|---|
| `demo@taskflow.dev` | Project owner |
| `alex@taskflow.dev` | Member |
| `maya@taskflow.dev` | Member |

The seed creates two projects ("Website Redesign", "Mobile App Launch") with tasks in every column and sample comments — ideal for a demo video.

### Production build

```bash
npm run build          # builds the React client into client/dist
npm start --prefix server   # Express serves the API and the built client on one port
```

---

## 🧭 How to use

1. **Sign up** (or use the demo account) — you land on the dashboard.
2. **Create a project** from the dashboard.
3. **Invite teammates** (owner only) via the *Invite* button using their TaskFlow email.
4. **Add tasks** to columns with the "+ Add task" composer.
5. **Open a task** to edit status/priority/due date, assign a member, and **discuss in comments**.
6. **Drag cards** between columns — everyone on the board sees the change instantly.
7. Watch the **🔔 bell** — assignments, comments and status changes generate notifications.

**Try real-time with two browsers:** sign in as `demo@taskflow.dev` in one and `maya@taskflow.dev` in the other, open the same project, and move a task — it updates live in both windows.

---

## 📡 REST API overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Sign in, returns JWT |
| GET | `/api/auth/me` | Current user (auth) |
| GET / POST | `/api/projects` | List my projects / create project |
| GET / PATCH / DELETE | `/api/projects/:id` | Board data / update (owner) / delete (owner) |
| POST | `/api/projects/:id/members` | Add member by email (owner) |
| DELETE | `/api/projects/:id/members/:userId` | Remove member (owner) |
| POST | `/api/tasks` | Create task |
| PATCH / DELETE | `/api/tasks/:id` | Update / delete task |
| GET / POST | `/api/tasks/:id/comments` | List / add comments |
| GET | `/api/notifications` | Latest notifications + unread count |
| POST | `/api/notifications/read-all` | Mark all read |

## 🔌 Socket.io events

| Direction | Event | Purpose |
|---|---|---|
| client → server | `project:join` / `project:leave` | Join/leave a board room |
| server → client | `presence:update` | Online members of the board |
| server → client | `task:created` / `task:updated` / `task:deleted` | Live board sync |
| server → client | `comment:added` | Live comments |
| server → client | `member:joined` / `member:left` | Team changes |
| server → client | `notification:new` | Personal notifications |

---

## 📁 Project structure

```
CodeAlpha_ProjectManagement/
├── server/                     # Express + MongoDB + Socket.io
│   ├── src/
│   │   ├── index.js            # App entry: routes, static client, socket init
│   │   ├── config/db.js        # MongoDB connection (in-memory fallback)
│   │   ├── models/             # User, Project, Task, Comment, Notification
│   │   ├── middleware/auth.js  # JWT verification + membership guards
│   │   ├── routes/             # auth, projects, tasks, comments, notifications
│   │   ├── realtime/index.js   # Socket.io: auth handshake, rooms, presence
│   │   ├── utils/notify.js     # Notification creation + realtime push
│   │   └── seed/seed.js        # Demo data seeder
│   └── .env.example
└── client/                     # React (Vite) + Tailwind CSS
    └── src/
        ├── App.jsx             # Routes: /login, /, /project/:id
        ├── context/            # AuthContext, SocketContext
        ├── lib/                # axios instance, shared constants
        └── components/         # AuthPage, Navbar, Dashboard, Board,
            │                    # TaskCard, TaskModal + ui primitives
```

## 🔒 Security notes

- Passwords hashed with bcrypt (10 rounds) — never stored or returned in plain text
- JWT-based stateless auth; socket connections require a valid token
- Route-level authorization: only project members can access board data; only owners can invite/remove members or delete projects
- CORS restricted to the configured client origin
