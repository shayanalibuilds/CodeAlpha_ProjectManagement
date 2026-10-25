/**
 * Seeds demo data so you can explore TaskFlow immediately.
 *   npm run seed
 * Demo login:  demo@taskflow.dev / demo1234
 * Teammates:   alex@taskflow.dev / demo1234, maya@taskflow.dev / demo1234
 */
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');

async function seed() {
  await connectDB();

  if (!process.env.MONGODB_URI) {
    console.log('\n⚠️  NOTE: MONGODB_URI is not set, so this is seeding an IN-MEMORY database.');
    console.log('   In-memory data is lost when the server restarts.');
    console.log('   For a persistent demo, set MONGODB_URI in server/.env first.\n');
  }

  // Clean slate
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const pass = await bcrypt.hash('demo1234', 10);
  const [demo, alex, maya] = await User.create([
    { name: 'Demo User', email: 'demo@taskflow.dev', passwordHash: pass },
    { name: 'Alex Rivera', email: 'alex@taskflow.dev', passwordHash: pass },
    { name: 'Maya Chen', email: 'maya@taskflow.dev', passwordHash: pass },
  ]);

  const website = await Project.create({
    name: 'Website Redesign',
    description: 'Refresh the company website: new design system, faster pages, better SEO.',
    color: 'emerald',
    owner: demo._id,
    members: [demo._id, alex._id, maya._id],
  });

  const mobile = await Project.create({
    name: 'Mobile App Launch',
    description: 'Plan and ship the v1.0 release of the companion mobile app.',
    color: 'violet',
    owner: demo._id,
    members: [demo._id, maya._id],
  });

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const tasks = await Task.create([
    {
      title: 'Design new landing page hero',
      description: 'Create 3 hero concepts with updated brand palette. Include mobile mockups.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date(now + 3 * day),
      position: 1,
      project: website._id,
      assignee: maya._id,
      creator: demo._id,
    },
    {
      title: 'Audit current site SEO',
      description: 'Run Lighthouse on top 10 pages, list broken links and missing meta tags.',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: new Date(now + 6 * day),
      position: 1,
      project: website._id,
      assignee: alex._id,
      creator: demo._id,
    },
    {
      title: 'Set up CMS content model',
      description: 'Define collections for blog posts, case studies and team members.',
      status: 'TODO',
      priority: 'LOW',
      position: 2,
      project: website._id,
      assignee: demo._id,
      creator: demo._id,
    },
    {
      title: 'Migrate blog articles',
      description: 'Move 48 articles, fix internal links, add redirects for changed URLs.',
      status: 'TODO',
      priority: 'HIGH',
      position: 3,
      project: website._id,
      creator: maya._id,
    },
    {
      title: 'Choose hosting provider',
      description: 'Compare Vercel vs Netlify pricing, edge functions and preview deploys.',
      status: 'DONE',
      priority: 'MEDIUM',
      position: 1,
      project: website._id,
      assignee: demo._id,
      creator: demo._id,
    },
    {
      title: 'Write launch announcement',
      description: 'Draft the Product Hunt post and email newsletter for the v1.0 launch.',
      status: 'TODO',
      priority: 'URGENT',
      dueDate: new Date(now + 2 * day),
      position: 1,
      project: mobile._id,
      assignee: maya._id,
      creator: demo._id,
    },
    {
      title: 'Prepare App Store assets',
      description: 'Screenshots for 6.7" and 5.5" displays, app icon, feature graphic.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      dueDate: new Date(now + 5 * day),
      position: 1,
      project: mobile._id,
      assignee: demo._id,
      creator: demo._id,
    },
  ]);

  await Comment.create([
    {
      content: 'Concept 2 is my favorite — the gradient feels modern but still accessible.',
      task: tasks[0]._id,
      author: demo._id,
    },
    {
      content: 'Agreed! I will prepare the dark-mode variant of concept 2 next.',
      task: tasks[0]._id,
      author: maya._id,
    },
    {
      content: 'Hosting decision done: going with Vercel, preview deploys are a huge win.',
      task: tasks[4]._id,
      author: demo._id,
    },
  ]);

  await Notification.create([
    {
      user: demo._id,
      type: 'COMMENT_ADDED',
      message: 'Maya Chen commented on "Design new landing page hero"',
      project: website._id,
      task: tasks[0]._id,
    },
    {
      user: demo._id,
      type: 'TASK_STATUS',
      message: 'Maya Chen moved "Design new landing page hero" to In-Progress.',
      project: website._id,
      task: tasks[0]._id,
    },
    {
      user: alex._id,
      type: 'TASK_ASSIGNED',
      message: 'Demo User assigned you a task: "Audit current site SEO" (Website Redesign).',
      project: website._id,
      task: tasks[1]._id,
    },
  ]);

  console.log('Seed complete.');
  console.log('  demo@taskflow.dev / demo1234   (project owner)');
  console.log('  alex@taskflow.dev / demo1234   (member)');
  console.log('  maya@taskflow.dev / demo1234   (member)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
