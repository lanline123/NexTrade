# 部署说明（Rust 版）

## 1. Docker Compose（推荐先在有 Docker 的机器验证）

```bash
cd rust
docker compose up -d --build
```

- MySQL 首次启动只执行 `deploy/mysql-init/00-pure.sql`（由
  `python tools/compat/prepare_docker_mysql.py` 从 `../java/database/pure.sql`
  生成，已去除 `INT UNSIGNED`，避免 sqlx 解码失败）。
- 如需重新初始化数据库，删除 `mysql-data` volume 后重启。
- 应用默认端口：管理端 `8080`、C 端 `8181`；健康检查 `/adminapi/health`，
  指标 `/metrics`。

> 注意：本仓库开发机没有 Docker，compose 文件已修正但尚未实际拉起验证；
> 首次部署请保留 `docker compose logs -f mysql app` 观察初始化与迁移。

## 2. 前端 / Nginx

- `deploy/nginx.conf` 是参考反代配置：`/adminapi`、`/im`、`/static`、
  `/adminws` → 8080；`/api`、`/ws` → 8181；`/metrics` → 8080。
- **后端 8181 只提供 `/api` JSON，不返回任何 HTML**。PC 前端是独立 SPA，必须由 nginx 静态托管。
  （历史上的 Leptos SSR fallback 已于 2026-10-20 下线，见 `rust/crates/bin/src/main.rs` 注释。）
- **Rust 打包不包含前端**：`cargo build --release` / `Dockerfile` 只产出
  `tigshop` 后端二进制与 `config.yaml`、`migrations`、`template`；前端 `dist`
  必须单独构建并由 nginx（或对象存储/CDN）托管。

### 前端构建与部署（2026-11 更新）

当前前端只有两套 React 工程，均为独立 npm 安装（`admin-semi` 也有 `package-lock.json`）：

```bash
# 管理端：Vite + React + Semi
cd rust/web/admin-semi
npm install
npx tsc -b && npx vite build --base=/admin-semi/

# PC 商城：Next.js 14
cd rust/web/pc-semi
npm install
npm run build
```

| 端 | 源码 | 产物 | 部署到 |
|---|---|---|---|
| 管理端 | `rust/web/admin-semi` | `dist/` | 静态托管 `/admin-semi/`（宝塔：`/www/wwwroot/<站点>/public/admin-semi/`） |
| PC 商城 | `rust/web/pc-semi` | `.next` + `public` | Node 服务 `node server.js`（端口 3004），nginx 反向代理 `/` |

- `rust/web` 仍是 pnpm workspace 根，但 `packages` 只保留 `pc-semi`。
- 2026-11 已移除旧的 Vue3 重写原型 `rust/web/{admin,pc,shared}`（依据
  `rust/docs/FRONTEND-1TO1-REVIEW-2026-10-25.md` 的 R3 决策），不要再按旧文档构建。
- 原版前端 `java/view/{admin,Tigshop-Pc}` 仅作对照基准，不是部署来源。

- 本地开发也可用 `nginx -c /path/to/deploy/nginx.conf` 验证路由。
- 开发期各有 dev server：admin-semi `:3002`（代理 `/adminapi`、`/static`→8080）、
  pc-semi `:3004`（`PC_API_BASE` 指定后端）。

## 3. 环境变量（关键）

| 变量 | 说明 |
|---|---|
| `TIG_DATASOURCE__URL` | MySQL URL（compose 已注入） |
| `TIG_REDIS__HOST` / `TIG_RABBITMQ__HOST` | Redis / RabbitMQ |
| `TIG_JWT__SECRET` | 生产必须替换默认值 |
| `TIG_SERVER__ADMIN_PORT` / `TIG_SERVER__API_PORT` | 8080 / 8181 |
| `TIG_SCHEDULER__ENABLED` | 是否启用轮询任务 |
| `OPEN_TEMPLATE_BASE_URL` | 装修模板 OpenTemplate API（缺省 `https://api.tigshop.com/index`） |

## 4. 验收清单

1. `curl http://127.0.0.1:8080/adminapi/health` → `{"data":"UP",...}`
2. `curl http://127.0.0.1:8080/metrics` → Prometheus 文本
3. 管理端登录（`admin/admin123`）→ token/adminType 正常
4. 前端经 nginx 登录、商品列表、下单、支付回调、IM WS 正常
5. `docker compose ps` 中 mysql/app 为 healthy/running
