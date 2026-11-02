// 批量任务调度面板 — Express + JWT + Redis 队列状态
// ponytail: 内存 Map 存任务，重启丢数据。上限：单机 demo。升级：接 MySQL/SQLite 时换 DAO 层。
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
// ponytail: 单用户写死。上限：demo 无注册流。升级：接用户表 + bcrypt 时删这里。

const users = [{ id: 1, username: 'admin', password: 'admin123', role: 'admin' }];
const tasks = new Map(); // id -> task

function makeToken(u) {
  return jwt.sign({ sub: u.id, username: u.username, role: u.role }, SECRET, { expiresIn: '2h' });
}

function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'missing token' });
  jwt.verify(token, SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'invalid token' });
    req.user = payload;
    next();
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// ---- auth ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = users.find(x => x.username === username && x.password === password);
  if (!u) return res.status(401).json({ error: 'bad credentials' });
  res.json({ token: makeToken(u), user: { id: u.id, username: u.username, role: u.role } });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

// ---- tasks CRUD ----
app.get('/api/tasks', requireAuth, (req, res) =>
  res.json({ tasks: [...tasks.values()] })
);

app.post('/api/tasks', requireAuth, (req, res) => {
  const { name, type = 'check-in', payload = {} } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const t = {
    id: crypto.randomUUID(), name, type, payload,
    status: 'queued', createdAt: Date.now(), createdBy: req.user.username
  };
  tasks.set(t.id, t);
  res.status(201).json({ task: t });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  if (!tasks.delete(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

// ---- queue 状态：有 Redis 读 Redis，没有降级内存 ----
// ponytail: 队列状态伪造。上限：demo 无真实 worker。升级：接 BullMQ 时 LLEN 换真队列。
app.get('/api/queue/stats', requireAuth, async (req, res) => {
  if (global.redis) {
    const [depth, done] = await Promise.all([
      global.redis.llen('queue:tasks'),
      global.redis.llen('queue:done')
    ]).catch(() => [null, null]);
    if (depth !== null) return res.json({ source: 'redis', depth, done });
  }
  res.json({
    source: 'memory',
    depth: [...tasks.values()].filter(t => t.status === 'queued').length,
    done: [...tasks.values()].filter(t => t.status !== 'queued').length
  });
});

app.use(express.static('public'));

app.listen(PORT, () => console.log(`batch-task-panel on http://localhost:${PORT}`));
