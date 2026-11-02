# batch-task-panel

批量任务调度面板 — Express + JWT + Redis 的最小可运行实现。

前端登录后创建/管理批量任务，后端提供任务 CRUD 与队列状态查询；Redis 可用时读取真实队列深度，不可用时自动降级内存计数。

## 架构

```
浏览器 (public/index.html, 原生 JS)
   │  Authorization: Bearer <JWT>
   ▼
Express (server.js)
   ├── POST /api/login        → 签发 JWT (2h)
   ├── GET  /api/me           → 鉴权中间件验证
   ├── GET/POST/DELETE /api/tasks → 任务 CRUD (内存 Map)
   └── GET  /api/queue/stats  → Redis llen / 内存降级
```

## 运行

```bash
npm install
npm start        # http://localhost:3000  (admin / admin123)
npm run smoke    # 11 条断言的冒烟自检
```

可选：`PORT=4000`、`JWT_SECRET=xxx` 环境变量。

## 技术点

- **JWT 鉴权链**：登录签发 → `Authorization: Bearer` → 中间件 `jwt.verify` 挂载 `req.user`，未带/无效 token 一律 401 早退
- **输入校验**：任务名缺失返回 400；删除不存在返回 404；信任边界上不做任何静默容错
- **优雅降级**：Redis 不可达时队列状态接口自动切内存计数，服务不中断
- **零前端依赖**：单文件原生 JS 面板，60 行
- **自检**：`smoke.js` 覆盖 401/400/404/201/204 全部状态码路径，`node smoke.js` 一条命令验证整条链路

## 已知简化

demo 定位，任务存内存 Map、队列数据伪造、单用户。升级路径在代码中以 `ponytail:` 注释标记（接 MySQL、BullMQ 时的改造点）。
