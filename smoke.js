// 冒烟自检：node smoke.js — 全绿说明整条链路（JWT → CRUD → 队列状态）活着
const assert = require('assert');

process.env.PORT = '3999';
require('./server.js');
const BASE = 'http://localhost:3999';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(500);

  let r = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' })
  });
  assert.strictEqual(r.status, 401, 'bad password must 401');

  r = await fetch(`${BASE}/api/tasks`); // 无 token
  assert.strictEqual(r.status, 401, 'no token must 401');

  r = await fetch(`${BASE}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  assert.strictEqual(r.status, 200);
  const { token } = await r.json();
  assert.ok(token, 'token returned');
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  r = await fetch(`${BASE}/api/tasks`, { headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual((await r.json()).tasks, [], 'empty task list');

  r = await fetch(`${BASE}/api/tasks`, {
    method: 'POST', headers: H, body: JSON.stringify({ name: 'galxe-daily', type: 'check-in' })
  });
  assert.strictEqual(r.status, 201);
  const { task } = await r.json();
  assert.strictEqual(task.status, 'queued');

  r = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  assert.strictEqual(r.status, 400, 'missing name must 400');

  r = await fetch(`${BASE}/api/queue/stats`, { headers: H });
  assert.strictEqual(r.status, 200);
  const stats = await r.json();
  assert.strictEqual(stats.source, 'memory', 'no redis -> memory fallback');
  assert.strictEqual(stats.depth, 1);

  r = await fetch(`${BASE}/api/tasks/${task.id}`, { method: 'DELETE', headers: H });
  assert.strictEqual(r.status, 204);
  r = await fetch(`${BASE}/api/tasks/${task.id}`, { method: 'DELETE', headers: H });
  assert.strictEqual(r.status, 404, 'double delete -> 404');

  console.log('ALL SMOKE TESTS PASS');
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
