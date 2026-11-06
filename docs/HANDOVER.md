# 项目交接文档（唯一入口）

> 更新时间：2026-11-03  
> 适用范围：Tigshop v5.8.61 跨境版升级、Rust 后端、admin-semi / pc-semi / H5 前端、装修系统  
> 说明：本文由原 `docs/` 下 34 份 Markdown 合并而来；历史细节可在 Git 历史中查看旧文件。

---

## 0. 当前基线

### Java 基准

```text
D:\tigshop\java-b2b2b-pro-v5.8.57\java-b2b2c-overseas-v5.8.61
```

跨境版 B2C v5.8.61 是当前升级构建的 UI / 业务基线。

### Rust 后端

```text
D:\tigshop\java-b2b2b-pro-v5.8.57\rust\crates
```

主要 crate：

```text
tigshop-server          程序入口
tigshop-api             前台 API
tigshop-admin-api       管理端 API
tigshop-services        业务服务
tigshop-infrastructure  仓储 / SQL
tigshop-core            模型 / 实体 / 契约
tigshop-security        JWT / 密码
```

### 前端

```text
rust/web/admin-semi     React 18 + Semi UI 新后台
rust/web/pc-semi        Next.js 14 PC 商城
java/view/uniapp        H5 / 小程序源
java/view/admin         旧 Vue 后台
```

> 2026-11 清理：`rust/web/{admin,pc,shared}`（Vue3 重写原型）已按
> `rust/docs/FRONTEND-1TO1-REVIEW-2026-10-25.md` 的 R3 决策删除，
> `rust/web` pnpm workspace 现只保留 `pc-semi`；`admin-semi` 使用独立 npm 管理。

### 生产状态（截至合并时）

```text
Rust 后端：build-146，systemd 服务 tigshop
PC 前端：pc-semi v20，systemd 服务 pc-semi
Admin：/admin/ 仍是旧 Vue 后台
       /admin-semi/ 尚未正式部署 React 版
H5：已部署
```

---

## 1. 目录与关键文件

### 后端

```text
rust/crates/api/admin/src/routes/       管理端路由
rust/crates/api/api/src/routes/         前台路由
rust/crates/core/src/models/            接口模型 / DTO / VO
rust/crates/services/src/               业务服务
rust/crates/infrastructure/src/db/      仓储 / SQL
```

### Admin

```text
rust/web/admin-semi/src/App.tsx             页面注册（import / knownPages / render）
rust/web/admin-semi/src/layout/AdminLayout.tsx 菜单、顶部栏、SSE、播报
rust/web/admin-semi/src/config/adminMenu.tsx  菜单与页面标题
rust/web/admin-semi/src/framework/             ListPage / FormDrawer / FieldRenderer
rust/web/admin-semi/src/pages/AutoConfigPage.tsx 配置页引擎
rust/web/admin-semi/src/pages/specs/*.json     PageSpec 页面契约
rust/web/admin-semi/src/i18n/                  i18next 中英文
rust/web/admin-semi/src/sse.ts                 消息 SSE
rust/web/admin-semi/src/voice.ts               语音播报
```

### PC

```text
rust/web/pc-semi/app/                  Next.js App Router 页面
rust/web/pc-semi/components/           PC 组件
rust/web/pc-semi/next.config.mjs       /api /adminapi /static 代理
```

### 旧系统与工具

```text
java/view/admin/src/views/       旧 Vue 后台页面
java/view/admin/src/api/         旧 API 模块
java/view/uniapp/                H5 源
java/public/pc/                  PC 旧构建产物
tools/audit-page-spec.mjs        PageSpec 审计
tools/audit-admin-page.mjs       旧页面标签 / 字段审计
tools/upload-to-bt.ps1           宝塔分片上传
```

### 非 Markdown 资料

```text
docs/admin-migration-inventory.json   旧页面 / API / 字段清单
docs/i18n-home-en-seed.sql            英文首页翻译种子
docs/i18n-home-esfrru-seed.sql        ES / FR / RU 翻译种子
docs/i18n-home-multilang-seed.sql     多语言首页种子
```

---

## 2. Admin Semi 迁移

### 2.1 现状

```text
菜单叶子页面：226 / 226 已迁移（100%）
缺口：0
挂起：3 个后端缺失项（历史会话 / 客服工作台相关）
```

装修、顶部栏、主题、消息、播报等已完成。

商品设置（`baseProductManage`）已按跨境版 v5.8.61 逐项对齐（2026-11-04）：

```text
17 个字段（含原图下载 3 项）
0/1 字段统一单选，规格图片、批量采购、库存编辑恢复选项文案
商品名称长度 0-750 取整，市场价换算保留 1 位小数
匿名评价随商品评价关闭自动归零并禁用
原图下载开启时校验渠道 / 打包范围
商品原图批量下载已按 Java ProductRawImageDownloadService 对齐（源码层）：
  initConfigSettings 下发 enabled / channels / scopes 三项用户端配置
  配置行缺失时按 Java SettingsEnum.defaultValue 回落（enabled=0 / 全渠道 / 全范围），空值行不回落
  GET /api/product/product/downloadRawImages 复刻开关、渠道、范围校验
  main / sku / detail 三类图片采集、原图 URL 归一化、分目录 ZIP、整体失败语义
  PC 商品详情页新增「素材下载」按钮；H5 / 小程序沿用 X-Client-Type 请求头
  生产需重新构建部署并实测接口后才算闭环
```

### 2.2 迁移引擎

```text
ListPage.tsx        普通列表页
FormDrawer.tsx      表单抽屉
FieldRenderer.tsx   字段渲染
AutoConfigPage.tsx  配置页
```

页面类型选择：

```text
普通 CRUD      → ListPage + FormDrawer
配置页         → AutoConfigPage
复杂控件       → 自绘组件 + PageSpec widgets
```

参考实现：

```text
FriendLinks.tsx / TaxRates.tsx / ShippingTypes.tsx   简单 CRUD
Coupons.tsx                                          复杂表单
StockWarnings.tsx / Authorities.tsx                  自绘表格 / 树
CreditPages.tsx / FinanceMoreLists.tsx               多页聚合
PaymentSettings.tsx                                  多 Tab 配置
```

### 2.3 单页迁移流程

1. 读旧源码：`java/view/admin/src/views/<模块>`
2. 核对 Rust 端点：`rust/crates/api/admin/src/routes/<域>`
3. 选择页面类型并实现
4. 在 `App.tsx` 三处注册：import、`knownPages`、render 分支
5. 写 `src/pages/specs/<name>.json`
6. 过门槛并做真实登录冒烟

### 2.4 完成门槛（不可跳过）

```bash
cd rust/web/admin-semi
npm run build

cd ../..
node tools/audit-page-spec.mjs rust/web/admin-semi/src/pages/specs/<spec>.json
node tools/audit-admin-page.mjs <旧页面路径不带.vue> rust/web/admin-semi/src/pages/<页面>.tsx

# 配置页额外
cd rust/web/admin-semi
VERIFY_BASE=http://127.0.0.1:3003 npm run verify:config
```

要求：

```text
build 成功
PageSpec PASS
旧标签 / 字段缺失为 0
真实登录页面可打开、无 pageerror
```

### 2.5 常见坑

#### Semi UI

```text
Select 没有 clearable
Switch / Tag 没有 title
Space 没有 Space.Compact
Table rowKey 仅支持字符串
InputNumber onChange 可能为 null
unknown 字段用 String(value)
```

#### 审计

```text
audit-admin-page 要求旧中文标签在新源码逐字出现
补不进 UI 的标签用 title / 注释记录
自定义筛选页 filters 留空，写 notes
PageSpec 用 python json.dumps 生成，避免裸换行
```

#### 后端差异

```text
updateField 的字段名是 val，不是 value
omitempty 可能不返回空字段，AutoConfigPage 用 defaults 补
时间字段有 Unix 秒 / 字符串两种
列表响应有 {records,total} 和包一层两种
camelCase / snake_case 双格式需归一化
```

---

## 3. Admin 顶部栏 / i18n / 消息 / 播报

### 3.1 顶部栏

对齐跨境版：

```text
Logo
功能搜索（菜单直达）
授权信息
消息中心
语音播报
查看商城
切换语言
用户菜单（切换组织 / 管理账号 / 清除缓存 / 退出）
```

关键文件：

```text
src/layout/AdminLayout.tsx
src/components/MenuSearch.tsx
src/components/AdminMessageCenter.tsx
src/components/VoiceBroadcast.tsx
src/components/VoiceBroadcastTip.tsx
src/components/LicensedBadge.tsx
src/components/SelectShopModal.tsx
```

### 3.2 i18n

架构：

```text
i18next + react-i18next
语言注册表：src/i18n/config.ts
资源加载器：src/i18n/loader.ts
格式化工具：src/i18n/format.ts
Provider：src/i18n/index.tsx
翻译资源：src/i18n/resources/{locale}/translation.json
存量页面回退层：src/i18n/legacyAutoTranslate.tsx
```

当前语言：

```text
zh-CN  简体中文
en     English
```

注册表中已经预留：

```text
zh-Hant / ja / ko / es / fr / ru / ar
```

新增语言：

1. 新建 `src/i18n/resources/<code>/translation.json`
2. 在 `src/i18n/config.ts` 的 LOCALES 中登记该语言，`translated: true`
3. 不需要改 Provider、语言菜单或 Semi locale 逻辑

行为：

```text
JSON 资源按语言懒加载，不进入主包
localStorage.app-locale
html lang / dir 同步
BroadcastChannel 跨标签页
Semi ConfigProvider locale 随语言切换
Intl 金额 / 日期 / 数字格式化
缺失 key 回退 en → zh-CN
```

说明：

- 新页面必须用 `useI18n().t()`。
- 页面/组件已全部迁移到 t()，DOM 过渡翻译层已删除；新增页面不得再引入 DOM 文本替换。
- 语言菜单只展示 `translated: true` 的语言，避免展示未翻译语言。
- 资源自检：`npm run i18n:check`。

### 3.3 消息 SSE

`src/sse.ts`：

```text
fetch 流读取 SSE（EventSource 不能带 Authorization）
Authorization / x-admin-type / x-shop-id
5 秒重连
```

接口：

```text
GET /adminapi/msg/adminMsg/msgCount?startTime=   SSE
GET /adminapi/msg/adminMsg/homeSummary           兜底未读
GET /adminapi/msg/adminMsg/msgTypeArr            分类
GET /adminapi/msg/adminMsg/list                  列表
POST /adminapi/msg/adminMsg/setReaded            单条已读
POST /adminapi/msg/adminMsg/setAllReaded         全部已读
GET /adminapi/msg/adminMsg/broadcastList         播报记录
```

当前生产 `msgCount` 测试无推送数据，未读数走 `homeSummary` 初始 + 30 秒轮询；后端 SSE 恢复后自动接管。

### 3.4 播报

```text
localStorage.admin_voice_broadcast_v1
5 类开关 + activated + popupEnabled
浏览器 SpeechSynthesis
SSE 增量 → 播报 + Notification
右侧 440px 设置抽屉
顶部首次引导条
```

已知限制：

```text
语音真实发声需人工用 Chrome/Edge 验证
生产 SSE 无数据时不会触发实时播报
当前账号未授权时授权图标隐藏
```

---

## 4. PC 装修机制（摘要）

原版不是在线写 HTML，而是：

```text
Admin 编辑器
→ pageModule + moduleList JSON
→ decorate.draft_data（草稿）
→ decorate.data（发布）
→ PC 公开接口读取
→ 按 module.type 找组件渲染
```

核心表：

```text
decorate
```

关键字段：

```text
decorate_id / decorate_title / decorate_type
data / draft_data
```

接口：

```text
/adminapi/decorate/*
/api/home/home/*
```

编辑器实现：

```text
rust/web/admin-semi/src/pages/PcDecorateEditor.tsx
rust/web/admin-semi/src/pages/MobileDecorateEditor.tsx
```

重要行为：

```text
加载优先 draftData
保存草稿 saveDraft
保存并发布 publish
保存必须携带真实 pageType / decorateType
```

详细旧版链路分析已合并到本节；原 `admin-pc-decoration-java-analysis.md` 已删除。源码参考：

```text
java/view/admin/src/views/decorate/
java/view/admin/src/views/decorate/pcDecorate/
```

---

## 5. Rust 后端 v5.8.61

### 5.1 结论

```text
代码 / 编译 / 单测 / 构建 / 部署：完成
真实支付渠道 / 外部 OAuth / 业务闭环：部分未完成
```

### 5.2 生产

```text
域名：https://battery.recy.cc
Rust：build-146
systemd：tigshop
目录：/www/wwwroot/tigshop-rust
备份示例：/www/backup/tigshop.preB135.bak
```

健康检查：

```text
/api/health
/adminapi/health
```

### 5.3 测试

```text
cargo test --workspace -j 1
约 4562 passed / 0 failed / 1 ignored

python tools/route-diff-v5861.py
java_routes=1743 / rust_routes=2120 / missing=0 / extra=381
```

### 5.4 构建

```text
GitHub Actions：build-rust-backend
文件：.github/workflows/build-rust.yml
分支：main，手动 workflow_dispatch
Release：build-<run_number>
资产：rustshop / rustshop.sha256
```

注意：

```text
不要每次 push 都构建
构建使用 remote main
先下载 Release 资产再部署
```

### 5.5 部署与回滚

宝塔分片上传：

```powershell
.\tools\upload-to-bt.ps1 `
  -File <rustshop路径> `
  -RemoteDir /www/backup/ `
  -ChunkSizeMB 4 `
  -PartPrefix bXXX_
```

服务器计划任务：

```text
cat bXXX_* > bXXX.bin
sha256sum -c
systemctl stop tigshop
cp 当前 tigshop -> /www/backup/tigshop.preBXXX.bak
cp bXXX.bin -> /www/wwwroot/tigshop-rust/tigshop
chmod +x
systemctl start tigshop
curl /adminapi/health
失败回滚
```

回滚：

```bash
systemctl stop tigshop
cp -f /www/backup/tigshop.preBXXX.bak /www/wwwroot/tigshop-rust/tigshop
chmod +x /www/wwwroot/tigshop-rust/tigshop
systemctl start tigshop
```

### 5.6 已实现范围

```text
微信 v3 / 支付宝 page/wap/app / PayPal / Stripe / Xendit / Antom
Apple Pay 配置收单 / 充值 / 预售定金 / 退款及回调
子商户绑定 / 分账适配器 / 通用支付网关
商户入驻 / 审核 / 开店初始化 / 进件
微信直播建单 / 订单/支付日志 / 出站事件
阿里云图搜 / AI 图片翻译/消除/OCR
供应链 / POS / 多门店 / Excel 导入导出
SEO 火山翻译 / JWT 登出吊销
```

### 5.7 已知缺口

```text
Google OAuth：控制台未登记回调（redirect_uri_mismatch）
Facebook OAuth：client_id 占位值
支付宝：真实付款 / 异步回调 / 退款未执行
动态分类 / 商品 / 装修内容多语言未完成
PC 装修逐模块视觉 parity 未逐条核对
```

---

## 6. 前端 H5 / PC 状态

```text
H5 源：java/view/uniapp
PC 源：java/public/pc、java/view/Tigshop-Pc
Admin 源：java/view/admin
H5 线上：https://battery.recy.cc/mobile/
PC：pc-semi v20 已部署
```

已做过的 H5 补齐包括服务人员个人中心、配送员端等；PC 已完成公开页、会员页、图搜、IM、支付页冒烟。

8 语种首页回归通过：

```text
zh / en / ko / ja / zh-Hant / es / fr / ru
HTTP 200，html lang 正确，0 JS 错误
```

翻译种子见 `docs/i18n-home-*.sql`。

---

## 7. 本地运行

### 7.1 环境

```text
Node.js 18+（建议 22）
npm / pnpm
可访问 https://battery.recy.cc
```

### 7.2 Admin

```bash
cd rust/web/admin-semi
npm install
npm run dev -- --host 127.0.0.1 --port 3003
```

```text
http://127.0.0.1:3003/
admin / admin123
组织选择：管理后台
```

Vite 代理：

```text
/adminapi → https://battery.recy.cc
/static   → https://battery.recy.cc
```

### 7.3 PC

```bash
cd rust/web/pc-semi
npm install
npm run dev
```

```text
http://127.0.0.1:3004/
```

`next.config.mjs` 默认代理 `PC_API_BASE=https://battery.recy.cc`。

### 7.4 本地 Rust 后端（可选）

```bash
cd rust
cargo build -p tigshop-server
./crates/target/debug/tigshop
```

接口：

```text
http://127.0.0.1:8080/adminapi/*
http://127.0.0.1:8181/api/*
```

---

## 8. 构建与验证

### Admin

```bash
cd rust/web/admin-semi
npm run build
```

部署到子路径 `/admin-semi/` 时需：

```bash
npx tsc -b
npx vite build --base=/admin-semi/
```

### PC

```bash
cd rust/web/pc-semi
npm run build
```

Next standalone 产物：

```text
.next/standalone
.next/static
public
```

### Rust

```bash
cargo test --workspace -j 1
cargo check -p api-admin
python tools/route-diff-v5861.py
```

### PageSpec / 旧页面审计

```bash
node tools/audit-page-spec.mjs rust/web/admin-semi/src/pages/specs/<spec>.json
node tools/audit-admin-page.mjs <旧页面路径> rust/web/admin-semi/src/pages/<页面>.tsx
```

---

## 9. GitHub 同步

```text
仓库：https://github.com/lanline123/rustshop
分支：main
```

标准流程：

```bash
cd D:\tigshop\java-b2b2b-pro-v5.8.57
git fetch origin main
git status
git diff --stat origin/main

git add <files>
git commit -m "feat/fix: ..."
git push origin main
```

注意：

```text
本地历史曾与远端分叉，接手先 fetch 对齐
不要提交 node_modules、.next、dist、截图、二进制、临时脚本
本地未跟踪目录：java/、java-b2b2c-overseas-v5.8.61/、证书等不要误提交
```

网络无法 push 时可用 GitHub REST API：

```text
GET   /repos/{owner}/{repo}/git/ref/heads/main
POST  /repos/{owner}/{repo}/git/blobs
POST  /repos/{owner}/{repo}/git/trees
POST  /repos/{owner}/{repo}/git/commits
PATCH /repos/{owner}/{repo}/git/refs/heads/main
```

Token 通过本机凭据管理器获取，不写入仓库。

---

## 10. 宝塔部署

### 10.1 当前生产结构

```text
站点根：/www/wwwroot/shop.recy.cc/public
Nginx：/www/server/panel/vhost/nginx/html_shop.recy.cc.conf
/admin/        旧 Vue 后台
/adminapi      → 127.0.0.1:8080
/              → 127.0.0.1:3005
```

### 10.2 Admin 静态部署

构建：

```bash
cd rust/web/admin-semi
npx tsc -b
npx vite build --base=/admin-semi/
```

上传 `dist/` 到：

```text
/www/wwwroot/shop.recy.cc/public/admin-semi/
```

Nginx：

```nginx
location /admin-semi/ {
    alias /www/wwwroot/shop.recy.cc/public/admin-semi/;
    index index.html;
    try_files $uri $uri/ /admin-semi/index.html;
}

location /admin-semi/assets/ {
    alias /www/wwwroot/shop.recy.cc/public/admin-semi/assets/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

API 代理：

```nginx
location /adminapi/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

SSE 需关闭缓冲：

```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
```

重载：

```bash
nginx -t
nginx -s reload
```

### 10.3 PC 部署

```bash
cd rust/web/pc-semi
npm install
npm run build
```

把 `.next/static`、`public` 放入 standalone 目录，然后：

```bash
PC_API_BASE=https://battery.recy.cc node server.js
```

宝塔 Node 项目：

```text
目录：/www/wwwroot/shop.recy.cc/pc-semi
启动：node server.js
端口：3004
环境变量：PC_API_BASE=https://battery.recy.cc
```

Nginx 反向代理 `/` → `127.0.0.1:3004`。

### 10.4 回滚

```bash
cd /www/wwwroot/shop.recy.cc/public
rm -rf admin-semi
mv admin-semi.bak.YYYYMMDDHHMM admin-semi
nginx -s reload
```

---

## 11. 已知问题 / 待办

```text
1. admin-semi 尚未部署到生产 /admin-semi/
2. 生产消息 SSE 当前无推送，未读数走 homeSummary 轮询
3. 语音播报真实发声未人工验证
4. 页面级 i18n 已完成；ja / ko / es / fr / ru / ar 仍待提供翻译资源
5. Google / Facebook OAuth 外部配置未完成
6. 支付宝真实付款/回调/退款未执行
7. PC 装修逐模块视觉 parity 未逐条核对
8. 3 个后端缺失页面挂起：历史会话、客服工作台
9. 动态分类/商品/装修内容多语言未完成
10. 商品设置已对齐跨境版；生产 Rust 需重新构建部署后，/admin-semi 才会返回「商品图片下载」3 个字段
11. 商品原图批量下载已在源码层补齐（配置下发 + ZIP 打包服务 + PC 按钮），生产需重新构建部署并实测：
    GET /api/common/config/initConfigSettings 返回 3 项配置
    GET /api/product/product/downloadRawImages?id=<商品ID> 带 X-Client-Type / Authorization 返回 ZIP
    Content-Disposition / Content-Length 需经代理保留可读取（handler 已设 Access-Control-Expose-Headers）
    全局 CompressionLayer 已排除 application/zip 等已压缩二进制，避免二次 gzip 抹掉 Content-Length
```

---

## 12. 原文档合并说明

以下 34 份 Markdown 已合并进本文并从 `docs/` 删除；旧内容仍可在 Git 历史中查看：

```text
admin-semi-migration-handover.md
admin-semi-migration-engine.md
admin-semi-migration-strategy.md
admin-semi-migration-tracker.md
admin-semi-cross-border-topbar-handover.md
admin-pc-decoration-java-analysis.md
frontend-batches.md
rust-api-audit.md
rust-api-batches.md
rust-v5.8.61-handover.md
rust-v5.8.61-acceptance.md
rust-v5.8.61-gap-assessment.md
rust-v5.8.61-full-gap-register.md
rust-v5.8.61-code-status-r20.md
rust-v5.8.61-db-upgrade-20261031.md
rust-v5.8.61-final-smoke.md
rust-v5.8.61-oauth-setup.md
rust-v5.8.61-payment-readiness.md
rust-v5.8.61-regression-20261031.md
rust-v5.8.61-b1-product-sale.md
rust-v5.8.61-b2-volumetric-freight.md
rust-v5.8.61-b3-offline-payment-claim.md
rust-v5.8.61-b4-image-search.md
rust-v5.8.61-b5-language.md
rust-v5.8.61-b6-supply-chain.md
rust-v5.8.61-b7-shop-group.md
rust-v5.8.61-b8-main-flow.md
rust-v5.8.61-b9-pos.md
rust-v5.8.61-deploy-build123.md
rust-v5.8.61-deploy-build124.md
rust-v5.8.61-deploy-build126.md
rust-v5.8.61-deploy-build132.md
rust-v5.8.61-deploy-build133.md
rust-v5.8.61-deploy-build135.md
```

保留的非 Markdown 资料：

```text
docs/admin-migration-inventory.json
docs/i18n-home-en-seed.sql
docs/i18n-home-esfrru-seed.sql
docs/i18n-home-multilang-seed.sql
```

---

## 13. 快速命令

```bash
# Admin 本地
cd rust/web/admin-semi
npm install
npm run dev -- --host 127.0.0.1 --port 3003

# PC 本地
cd rust/web/pc-semi
npm install
npm run dev

# Admin 构建
cd rust/web/admin-semi
npm run build

# 子路径构建
npx tsc -b && npx vite build --base=/admin-semi/

# Rust 测试
cd rust
cargo test --workspace -j 1

# GitHub
cd D:\tigshop\java-b2b2b-pro-v5.8.57
git fetch origin main
git status
```
