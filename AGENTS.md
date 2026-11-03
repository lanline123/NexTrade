# Agent 指引

本项目包含 Admin Semi 迁移引擎。开始任何后台页面迁移前，先读：

```text
docs/HANDOVER.md   ← 唯一交接文档(项目基线/迁移/运行/构建/部署/已知问题)
```

快速启动：

```bash
cd rust/web/admin-semi
npm install
npm run dev -- --host 127.0.0.1 --port 3002
```

登录：`admin / admin123`。

页面迁移完成必须执行：

```bash
cd rust/web/admin-semi && npm run build
cd ../.. && node tools/audit-page-spec.mjs rust/web/admin-semi/src/pages/specs/<spec>.json
node tools/audit-admin-page.mjs <旧页面路径> rust/web/admin-semi/src/pages/<新页面>.tsx
```

配置页额外执行：

```bash
cd rust/web/admin-semi && npm run verify:config
```

不要跳过 PageSpec、审计、真实登录验证和交互回归。
