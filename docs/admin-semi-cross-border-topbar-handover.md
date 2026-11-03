# 跨境版后台顶部栏 1:1 复刻交接文档

> 交接时间：2026-11-02
> 交接范围：`admin-semi`（React + Semi UI）顶部栏，对齐跨境版 `java-b2b2c-overseas-v5.8.61/view/admin`
> 当前状态：代码已完成，**未构建、未部署**；仅同步 GitHub。

---

## 1. 本次改造以什么为基础

### 1.1 UI / 行为基线

以跨境版 Vue 后台为准：

```text
java-b2b2c-overseas-v5.8.61/view/admin
```

重点参考文件：

```text
src/layouts/base/lib/components/src/pageTopBar.vue
src/layouts/base/lib/src/MsgCount.vue
src/layouts/base/lib/src/VoiceBroadcast/VoiceBroadcastEntry.vue
src/layouts/base/lib/src/VoiceBroadcast/VoiceBroadcastPanel.vue
src/layouts/base/lib/src/VoiceBroadcast/VoiceBroadcastRecordDrawer.vue
src/layouts/base/lib/src/VoiceBroadcast/VoiceBroadcastTip.vue
src/layouts/base/lib/components/src/LocaleSwitcher.vue
src/layouts/base/lib/src/Licensed.vue
src/i18n/index.ts
src/i18n/locales/zh.ts
src/i18n/locales/en.ts
```

顶部栏原始功能：

```text
Logo
当前店铺名称 / 状态
功能搜索（菜单直达）
授权信息
消息中心（未读、新订单）
语音播报（记录 + 设置 + 语音提醒）
查看商城
切换语言（中文 / English）
用户下拉（切换组织 / 管理账号 / 清除缓存 / 退出登录）
```

### 1.2 重构后的技术栈

目标项目：

```text
rust/web/admin-semi
```

技术栈：

```text
React 18
Semi UI
Vite 6
TypeScript 5
i18next + react-i18next
```

说明：

- 跨境版是 Vue 3 + Element Plus + Ant Design Vue + vue-i18n。
- React 端不能直接复用 vue-i18n 运行时，但**完整复用了跨境版 zh/en 翻译词典**。
- 顶部栏布局按跨境版重新排列，不再沿用 admin-semi 原有面包屑式顶部栏。

### 1.3 后端接口基线

接口来自 Rust 后台（生产测试域名 `https://battery.recy.cc`）：

```text
GET  /adminapi/panel/panel/searchMenu?keyword=
GET  /adminapi/msg/adminMsg/msgCount?startTime=   (SSE)
GET  /adminapi/msg/adminMsg/homeSummary
GET  /adminapi/msg/adminMsg/msgTypeArr
GET  /adminapi/msg/adminMsg/list
POST /adminapi/msg/adminMsg/setReaded
POST /adminapi/msg/adminMsg/setAllReaded
GET  /adminapi/msg/adminMsg/broadcastList
GET  /adminapi/setting/licensed/index
```

---

## 2. 重构后的文件在哪里

根目录：

```text
D:\tigshop\java-b2b2b-pro-v5.8.57
```

### 2.1 核心文件

| 文件 | 作用 |
|---|---|
| `rust/web/admin-semi/src/layout/AdminLayout.tsx` | 顶部栏布局、消息/播报/授权/语言/用户菜单、SSE 接线 |
| `rust/web/admin-semi/src/components/MenuSearch.tsx` | 功能搜索、菜单匹配与跳转 |
| `rust/web/admin-semi/src/components/AdminMessageCenter.tsx` | 消息中心、分类 Tab、已读、加载更多 |
| `rust/web/admin-semi/src/components/VoiceBroadcast.tsx` | 播报入口、播报记录抽屉、播报设置抽屉 |
| `rust/web/admin-semi/src/components/VoiceBroadcastTip.tsx` | 顶部语音播报首次引导条 |
| `rust/web/admin-semi/src/components/LicensedBadge.tsx` | 授权信息图标与弹窗 |
| `rust/web/admin-semi/src/i18n/index.tsx` | i18next 初始化、语言切换、持久化 |
| `rust/web/admin-semi/src/i18n/locales/zh.ts` | 中文词典（来自跨境版） |
| `rust/web/admin-semi/src/i18n/locales/en.ts` | 英文词典（来自跨境版） |
| `rust/web/admin-semi/src/i18n/locales/en-extra.ts` | 顶部栏新增英文词条 |
| `rust/web/admin-semi/src/sse.ts` | 消息 SSE（fetch 流）、未读兜底 |
| `rust/web/admin-semi/src/voice.ts` | 播报设置、语音队列、SSE 增量分发 |
| `rust/web/admin-semi/src/main.tsx` | 挂载 I18nProvider |
| `rust/web/admin-semi/src/styles.css` | 顶部栏、消息中心、播报、授权相关样式 |
| `rust/web/admin-semi/package.json` | 新增 i18next / react-i18next |
| `rust/web/admin-semi/package-lock.json` | 依赖锁 |

### 2.2 关键实现说明

#### i18n

```text
i18next
react-i18next
keySeparator: false
nsSeparator: false
interpolation prefix/suffix: { }
localStorage: app-locale
html lang 同步
BroadcastChannel: app-locale-sync
```

使用方式：

```tsx
const { t, locale, setLocale } = useI18n();
t('消息')
setLocale('en')
```

翻译词典来自：

```text
java-b2b2c-overseas-v5.8.61/view/admin/src/i18n/locales/zh.ts
java-b2b2c-overseas-v5.8.61/view/admin/src/i18n/locales/en.ts
```

#### SSE

```text
EventSource 无法携带 Authorization
改用 fetch + ReadableStream 读取 SSE
Authorization: Bearer <token>
x-admin-type / x-shop-id（按租户上下文）
5 秒断线重连
组件卸载 abort
```

生产接口当前测试没有推送数据，因此增加：

```text
GET /msg/adminMsg/homeSummary 初始拉取
每 30 秒轮询一次
```

SSE 恢复后实时帧会自动覆盖轮询值。

#### 语音播报

```text
localStorage.admin_voice_broadcast_v1
```

默认设置：

```text
newOrder     false
paidOrder    true
aftersale    true
cancelOrder  false
customerMsg  true
activated    false
popupEnabled false
```

流程：

```text
顶部“播报” → 播报记录抽屉
右上角齿轮 → 语音播报设置抽屉（右侧 440px）
顶部黄色引导条 → 立即开启
SSE 增量 → speechSynthesis 播报 + Notification
```

---

## 3. 如何同步到 GitHub

仓库：

```text
https://github.com/lanline123/rustshop
分支：main
```

### 3.1 重要：本地 Git 历史与远端不一致

交接时检查结果：

```text
本地 HEAD: 1f7f6969
该提交不在 GitHub 上（API 查询 422）
远端 main 已包含后续通过 GitHub API 提交的版本
```

但本地工作区中装修/顶部栏相关文件内容与远端一致。

接手后先做：

```bash
cd D:\tigshop\java-b2b2b-pro-v5.8.57

git fetch origin main
git status
git diff --stat origin/main
```

确认没有未提交的业务代码后，再把本地分支对齐远端：

```bash
git reset --mixed origin/main
```

> `--mixed` 只移动 HEAD 和索引，不会删除未跟踪文件；
> 未跟踪的 `java/`、`java-b2b2c-overseas-v5.8.61/`、证书目录等不会被删除。

### 3.2 标准 Git 提交流程

```bash
git add rust/web/admin-semi/src/layout/AdminLayout.tsx
git add rust/web/admin-semi/src/components/MenuSearch.tsx
git add rust/web/admin-semi/src/components/AdminMessageCenter.tsx
git add rust/web/admin-semi/src/components/VoiceBroadcast.tsx
git add rust/web/admin-semi/src/components/VoiceBroadcastTip.tsx
git add rust/web/admin-semi/src/components/LicensedBadge.tsx
git add rust/web/admin-semi/src/i18n
git add rust/web/admin-semi/src/sse.ts
git add rust/web/admin-semi/src/voice.ts
git add rust/web/admin-semi/src/main.tsx
git add rust/web/admin-semi/src/styles.css
git add rust/web/admin-semi/package.json
git add rust/web/admin-semi/package-lock.json

git commit -m "feat(admin): cross-border topbar with i18n, messages and voice broadcast"
git push origin main
```

### 3.3 网络无法 push 时的 API 方式

本次会话中 `git push` 多次被网络重置，最终使用 GitHub REST API 提交：

```text
GET   /repos/{owner}/{repo}/git/ref/heads/main
GET   /repos/{owner}/{repo}/git/commits/{sha}
POST  /repos/{owner}/{repo}/git/blobs
POST  /repos/{owner}/{repo}/git/trees
POST  /repos/{owner}/{repo}/git/commits
PATCH /repos/{owner}/{repo}/git/refs/heads/main
```

步骤：

1. 读取远端 `main` 当前 commit 和 tree
2. 每个文件转 Base64 创建 blob
3. 以远端 tree 为 `base_tree` 创建新 tree
4. 创建 commit，parent 为远端 main
5. 更新 `refs/heads/main`

注意：

- 不要把 GitHub Token 写进仓库或文档。
- Token 可通过 `git credential fill` 或系统凭据管理器获取。
- 提交后再 `git fetch origin && git reset --mixed origin/main` 对齐本地。

### 3.4 交接时的关键提交

```text
c541bedd style(admin): match original voice broadcast settings drawer
be56c8e6 fix(admin): voice broadcast settings as right drawer
b640f4b7 feat(admin): responsive topbar and message category filtering
c16b062e feat(admin): message type tabs and voice popup notifications
2abb8d91 feat(admin): polish topbar english copy and message text
34c23f4c feat(admin): voice broadcast entry records and settings
f4aed733 feat(admin): topbar menu search message center mall and user menu
34b9f2b9 feat(admin): add i18next foundation and admin msg SSE fallback
```

---

## 4. 如何本地运行

### 4.1 环境要求

```text
Node.js 18+（本次使用 Node v22）
npm
可访问 https://battery.recy.cc 的网络
```

后端不需要本地启动，开发服务器会代理到远程测试环境。

### 4.2 Admin 后台

```bash
cd D:\tigshop\java-b2b2b-pro-v5.8.57\rust\web\admin-semi
npm install
npm run dev -- --host 127.0.0.1 --port 3003
```

访问：

```text
http://127.0.0.1:3003/
```

登录：

```text
admin / admin123
```

如果出现组织选择，选择「管理后台」。

说明：

- Vite 默认端口是 3002；本地统一用 3003，避免与其他实例冲突。
- Vite 代理配置在 `rust/web/admin-semi/vite.config.ts`：

```text
/adminapi  → https://battery.recy.cc
/static    → https://battery.recy.cc
```

### 4.3 PC 商城端

```bash
cd D:\tigshop\java-b2b2b-pro-v5.8.57\rust\web\pc-semi
npm install
npm run dev
```

访问：

```text
http://127.0.0.1:3004/
```

API 代理配置在 `next.config.mjs`：

```text
PC_API_BASE 默认 https://battery.recy.cc
/api、/adminapi、/static 反向代理到 PC_API_BASE
```

### 4.4 常见问题

#### PC 启动报 EPERM / `.next` 权限错误

```powershell
cd D:\tigshop\java-b2b2b-pro-v5.8.57\rust\web\pc-semi
Remove-Item .next -Recurse -Force
npm run dev
```

#### 语言切换后仍是中文

检查：

```text
localStorage.app-locale
```

清空后刷新：

```js
localStorage.removeItem('app-locale');
location.reload();
```

#### 顶部未读数不更新

当前生产 SSE 没有推送，先看兜底接口：

```text
GET /adminapi/msg/adminMsg/homeSummary
```

如果该接口正常，未读数会显示；SSE 恢复后自动改走实时帧。

#### 语音不发声

需要：

```text
Chrome / Edge
点击顶部黄色引导条「立即开启」
允许浏览器声音播放
```

无头浏览器只能验证激活状态，不能验证真实音频输出。

---

## 5. 如何部署到宝塔

### 5.1 当前生产结构（交接时）

```text
站点根目录：/www/wwwroot/shop.recy.cc/public
Nginx 配置：/www/server/panel/vhost/nginx/html_shop.recy.cc.conf
/admin/       旧 Vue 后台
/admin-semi/  交接时仍为旧 Vue fallback（未部署 React 版）
/adminapi     代理到 127.0.0.1:8080
/             代理到 127.0.0.1:3005
```

部署前务必确认生产现状，不要覆盖旧后台。

### 5.2 Admin 构建

先确认部署路径：

#### 情况 A：部署在 `/admin-semi/`

Vite 需要设置 base，否则资源路径会指向根目录。

```bash
cd /www/wwwroot/shop.recy.cc/public/../..
# 或在本地构建后上传
cd D:\tigshop\java-b2b2b-pro-v5.8.57\rust\web\admin-semi

npx tsc -b
npx vite build --base=/admin-semi/
```

产物：

```text
rust/web/admin-semi/dist/
```

#### 情况 B：部署在独立域名根路径

```bash
cd D:\tigshop\java-b2b2b-pro-v5.8.57\rust\web\admin-semi
npm run build
```

产物同样在 `dist/`，base 为 `/`。

### 5.3 上传到宝塔

本地构建后，把 `dist/` 内容上传到：

```text
/www/wwwroot/shop.recy.cc/public/admin-semi/
```

建议先备份旧目录：

```bash
cd /www/wwwroot/shop.recy.cc/public
cp -a admin-semi admin-semi.bak.$(date +%Y%m%d%H%M)
```

上传方式：

- 宝塔文件管理器上传 zip 后解压
- 或 `scp -r dist/* root@server:/www/wwwroot/shop.recy.cc/public/admin-semi/`

确保属主：

```bash
chown -R www:www /www/wwwroot/shop.recy.cc/public/admin-semi
```

### 5.4 Nginx 配置

在宝塔站点配置中加入：

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

注意：

- 如果使用 `root` 而不是 `alias`，路径要写成 `root /www/wwwroot/shop.recy.cc/public;`，并让 URL `/admin-semi/` 对应目录。
- `index.html` 不要长缓存，避免发版后仍加载旧入口。
- `/adminapi` 继续代理到后端：

```nginx
location /adminapi/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

如果 SSE 需要经过 Nginx：

```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 3600s;
```

否则 `/msg/adminMsg/msgCount` 可能被缓冲，前端收不到实时帧。

### 5.5 重载 Nginx

```bash
nginx -t
nginx -s reload
```

宝塔面板也可以直接“重载配置”。

### 5.6 PC 端部署（Next.js）

PC 端是 Next.js 14，`output: 'standalone'`。

本地/服务器构建：

```bash
cd rust/web/pc-semi
npm install
npm run build
```

产物：

```text
.next/standalone/
.next/static/
public/
```

部署目录示例：

```text
/www/wwwroot/shop.recy.cc/pc-semi/
```

需要把：

```text
.next/static  → .next/standalone/pc-semi/.next/static
public        → .next/standalone/pc-semi/public
```

然后：

```bash
cd /www/wwwroot/shop.recy.cc/pc-semi
PC_API_BASE=https://battery.recy.cc node server.js
```

默认端口 3004。

宝塔可使用“Node 项目”管理器：

```text
项目目录：/www/wwwroot/shop.recy.cc/pc-semi
启动命令：node server.js
端口：3004
环境变量：PC_API_BASE=https://battery.recy.cc
```

Nginx 反向代理：

```nginx
location / {
    proxy_pass http://127.0.0.1:3004;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 5.7 SSL

宝塔站点设置 → SSL：

```text
申请 Let's Encrypt
或上传已有证书
开启强制 HTTPS
```

`SpeechSynthesis` 和部分浏览器权限在 HTTPS 下更稳定。

### 5.8 部署后验证

```text
1. https://域名/admin-semi/ 返回 200
2. 登录 admin/admin123
3. 顶部栏显示：搜索 / 消息 / 播报 / 查看商城 / 语言 / 用户菜单
4. 切换 English 后菜单和顶部栏变化
5. 搜索“商品”能跳转
6. 消息中心打开、分类 Tab 正常
7. 播报设置抽屉宽度 440、右侧打开
8. /adminapi/msg/adminMsg/homeSummary 正常返回
9. 浏览器控制台 0 pageerror
```

### 5.9 回滚

```bash
cd /www/wwwroot/shop.recy.cc/public
rm -rf admin-semi
mv admin-semi.bak.YYYYMMDDHHMM admin-semi
nginx -s reload
```

---

## 6. 当前已知差异 / 待办

```text
1. 生产 /msg/adminMsg/msgCount SSE 当前无推送数据，未读数走 homeSummary 轮询。
   后端部署新版 SSE 并关闭 Nginx 缓冲后才会实时。

2. 语音播报真实音频未在无头浏览器验证，仅验证了激活状态、开关、弹窗和增量分发。
   需要人工用 Chrome/Edge 打开声音验证。

3. 消息“单条已读 / 全部已读”接口已接入，但交接时未在真实数据上点击，避免改动线上消息状态。

4. 当前登录账号未授权，授权图标按跨境版逻辑隐藏；有授权数据时显示。

5. 全站页面级 i18n 尚未完成：
   目前翻译覆盖顶部栏、左侧菜单、面包屑、页面标题；
   页面内部表单/表格文案仍以中文为主，需要逐页替换 t('中文原文')。

6. 跨境版“试听”使用耳机图标，Semi 图标库没有耳机图标，当前用播放圆形图标替代。
```

---

## 6.1 2026-11-02 修复：已读后未读数立刻变化 + 角标颜色

### 问题

用户在消息中心把「交易消息 → 订单完成」里的未读消息读掉后：

- 分类 Tab 仍显示「交易消息 (1)」、子类型仍显示「订单完成 (1)」；
- 顶部铃铛角标也不变；
- 未读数胶囊颜色偏淡，不够醒目。

### 根因

1. `AdminMessageCenter.tsx` 只在**弹窗打开那一次**拉 `/msg/adminMsg/msgTypeArr`，
   单条 `setReaded` 成功后没有重新拉分类树，`catId` 也不参与列表请求，
   所以 Tab / 子类型角标是打开时的静态快照。
2. 顶部 `msgCount` 只靠 `homeSummary` + SSE 更新；`onRead` 触发的 `homeSummary`
   在 `setReaded` 尚未被服务端提交时就会返回旧值，把角标顶回原数。
3. Tab 上的未读数原先只是括号文本 `(1)`，颜色是继承文字色，所以不鲜艳。

### 修复（`src/components/AdminMessageCenter.tsx`、`src/layout/AdminLayout.tsx`、`src/styles.css`）

```text
1. 抽出 loadTypes()，单条已读 / 全部已读成功后都重新拉 msgTypeArr 与服务端对齐。
2. 单条已读做本地乐观更新 applyLocalRead()：对应子类型与所属分类 unreadCount 同时 -1，
   点击瞬间 Tab 角标就变，不等接口。
3. onRead(unread?) 协议：
   - 传数字 = 只做顶部角标乐观更新（不请求，避免旧值顶回）；
   - 不传 = 已读落库后再拉 homeSummary 对齐。
4. 未读数改为红底白字胶囊 .admin-msg-num（#fa4350 / #fff，圆角 8px），
   分类 Tab 与「全部类型/子类型」Tag 都带胶囊；「全部消息」Tab 显示总未读。
5. 列表项按已读/未读区分：未读有红点 + 标题加粗；已读底色 #fafafa、标题 #8f959e。
6. 全部已读按钮在无未读时置灰。
```

### 验证（真实登录 + 接口打桩，不动线上消息状态）

`tmp/msg-final-regression.cjs` 拦截 `msgTypeArr / list / setReaded / setAllReaded / homeSummary` 打桩后跑无头 Edge：

```text
BEFORE    : 铃铛 3 / 全部消息 3 / 交易消息 2 / 商品消息 1 / 订单完成 1
点 1 条未读后 80ms:
IMMEDIATE : 铃铛 2 / 全部消息 2 / 交易消息 1 / 商品消息 1 / 订单完成 (无)
SETTLED   : 同上（与服务端一致）
全部已读后 80ms: 铃铛 0，所有 Tab / 子类型胶囊消失
pageerror: 0
```

胶囊计算样式实测：`background: rgb(250,67,80)`、`color: rgb(255,255,255)`。

真实后端只读走查（`tmp/msg-real-check.cjs`）：
分类树 7 个 Tab 正常、「共 78 条消息」正常、`msgTypeArr` + `list` 各 1 次请求、无 pageerror。

### 6.1.1 「新订单 N」角标：一度删除，后按原版完整恢复

顶部消息按钮里有橙色小标签 `新订单8`（`admin-msg-order-count`），数据源是 SSE 帧的 `newOrderMsgCount`。

**曾经的问题（不是标签本身的错，是缺了原版的配套逻辑）：**

```text
后端 newOrderMsgCount 口径（rust/crates/infrastructure/src/db/repo/system/admin_msg.rs:184-190）：
  COUNT(*) FROM admin_msg
  WHERE ... AND is_broadcast = 1 AND send_time >= ? AND msg_type IN (11,12,31,32)
  —— 其中 ? 就是 lastOpenTime（sse.ts::readStartTime）

原版 MsgCount.vue 有 3 处会写 lastOpenTime 并重连 SSE：
  1. markAsRead()      —— 点击顶部消息按钮时
  2. handleDialogClose —— 消息中心弹窗关闭时
  3. AdminMsg.vue onMounted —— 消息中心组件挂载时

admin-semi 这三处一个都没做 → lastOpenTime 永远为空 → 窗口从 1970 年起 →
数字恒定不变，看起来像"常驻标签"，用户读完也不消失。
```

**最终处理：按原版 1:1 恢复标签，并补齐配套逻辑。**

样式（`styles.css`，逐值对齐原版 `.admin_msg-order_count`）：

```css
.admin-msg-order-count {
  display: inline-block;
  margin-left: 5px;
  padding: 2px 8px;
  font-size: 10px;
  line-height: 14px;
  color: #fff;
  background-color: #ffb53e;
  border-radius: 14px;
  white-space: nowrap;
}
```

功能（`AdminLayout.tsx`）：

```text
1. openMessageCenter()  = 原版 markAsRead
   本地先清零 msgCount / newOrderCount → 写 lastOpenTime → 重连 SSE → 开弹窗
2. closeMessageCenter() = 原版 handleDialogClose
   关弹窗 → 写 lastOpenTime → 重连 SSE
3. restartMsgStream()   = 原版 initSSE
   prevVoiceCount 置空（跨连接不误判语音增量）+ streamEpoch++ 强制重建 SSE
4. 文案用原版 key：t('新订单{newOrderMsgCount}', { newOrderMsgCount })，
   zh/en 词典里本来就有这条，不做字符串拼接
5. 原版有 `v-if="themeInfo.layout !== 'topMenu'"` → 这里对应 `layout !== 'top'`
```

**两个本项目的坑（原版没有，必须区别处理）：**

```text
A. 兜底轮询不能挂在 streamEpoch 上
   本项目为生产 SSE 不推送的情况加了 homeSummary 30s 轮询。
   若轮询与 SSE 同一个 effect，每次重连都会立刻拉一次 homeSummary，
   把刚清零的红点用旧值顶回去。→ 已拆成两个独立 effect。

B. 读消息的乐观更新用 min，不用直接覆盖
   打开消息中心时角标已按原版清零，之后点开一条消息算出的 totalUnread-1 不能把它顶回上涨。
   → setMsgCount(current => Math.min(current, unread))
```

验证（`tmp/neworder-badge-regression.cjs`，SSE 桩按 startTime 真实计算 `newOrderMsgCount`）：

```text
初始(lastOpenTime=null) → 新订单8，样式实测：
  fontSize 10px / color rgb(255,255,255) / background rgb(255,181,62)
  lineHeight 14px / padding 2px 8px / borderRadius 14px / marginLeft 5px
  ← 与原版 LESS 逐值一致

点击「消息」+120ms → 角标消失，lastOpenTime 已写入
SSE 重连 1 次，新帧 startTime=刚写入值 → newOrderMsgCount=0（确认窗口已滚动）
关闭弹窗 → 再次刷新 lastOpenTime + 重连
刷新页面 → 角标不复现；pageerror 0
```

`tmp/neworder-not-clobbered.cjs`（专门验证坑 A）：

```text
点击后 +120ms / settled / 关闭后 / 刷新后：orderTag 均为 null
重连期间的 homeSummary 新增调用 = 0
```

### 6.1.2 语言切换按钮换成 IconPark 的 Translate 图标

原来按钮显示文字「中 / EN」。改为 IconPark 官方 React 图标：

```tsx
// 深度导入单个图标文件，而不是 import { Translate } from '@icon-park/react'
import Translate from '@icon-park/react/es/icons/Translate';

<Button
  theme="borderless"
  className="icon-btn topbar-lang-btn"
  title={t('切换语言')}
  aria-label={t('切换语言')}
  icon={<Translate theme="outline" size={24} fill="currentColor" />}
/>
```

要点：

```text
1. 新增依赖：@icon-park/react@^1.4.2（唯一新增运行时依赖）。
2. 用深度导入 @icon-park/react/es/icons/Translate：
   该包没有 exports 字段限制，可直接按路径导入单个图标文件；
   以后新增 IconPark 图标照此写 @icon-park/react/es/icons/<IconName>。
3. fill 用 currentColor 而不是硬编码 #333 —— 这样颜色跟随 .icon-btn 的
   var(--text-secondary)，与左侧「消息」「播报」图标保持一致；
   写死 #333 在深色主题/悬停态会突兀。
4. 去掉「中/EN」文字，只留图标（与跨境版 LocaleSwitcher 的纯图标形态一致）。
5. 保留 title + aria-label，中英文各自走 t('切换语言')，无障碍不退化。
6. styles.css 新增 .topbar-lang-btn：图标垂直居中、line-height:0 消除基线空隙。
```

**关于包体积的实测结论（避免误判）：**

```text
barrel 导入（import {{ Translate }} from '@icon-park/react'）与
深度导入（@icon-park/react/es/icons/Translate）
—— 构建产物 hash 完全一致（index-ftSY0GzW.js），体积相同。

原因：该包的 sideEffects 只声明了 styles/**，Rollup 对 es/ 的 ESM 产物
本来就能 tree-shake 掉未使用图标。深度导入的价值不在当前体积，
而在于：入口依赖图更小、构建更快、未来不被他人改动 sideEffects 时不再有回退风险。

已验证产物里只有 translate 一个图标：
  "translate" 出现 20 次（图标自身 + 属性名）
  抽查 add-one / add-two / alarm-clock / full-screen-one /
       shopping-cart-one / setting-two / delete-key => 均 0 次
```

验证（`tmp/lang-icon-regression.cjs`）：

```text
svg viewBox 0 0 48 48 / 实测渲染 24×24 / 按钮文本为空（无中EN）
title=切换语言、aria-label=切换语言
下拉菜单 ["中文","English"] 正常
切 English 后 title=Switch language，Messages/Voice/View store 均翻译
tsc -b 0 错误；npm run build ✓
控制台仅剩既有的 React/Semi 弃用告警，无 pageerror
```

顺带修复（同一轮发现）：Semi 的 `Badge` 在 `count=0` 时会渲染出「0」，
而原版 MsgCount.vue 是 `v-if="useStore.messageCount > 0"`。
已改为 `count={msgCount > 0 ? msgCount : undefined}`（传 undefined 才是真正不显示），
无未读时铃铛角标完全不出现。

### 6.1.3 左侧菜单去掉装饰点 + 多语言宽度自适应

#### A. 去掉菜单项装饰点

原来一级/二级菜单项前都渲染了一个 `.submenu-dot` 小圆点，跨境版 pageLeftMenu 并没有。
三级项（`menu-chider-item`）和叶子二级项（`menu-item-a`）都只有文字。

```text
AdminLayout.tsx：删掉两处 <span className="submenu-dot" />
styles.css：删掉 .submenu-dot 与 .submenu-item.is-active .submenu-dot 规则
二级叶子项加 .submenu-item-leaf 类名（不再需要为圆点预留缩进）
```

全项目已无 `submenu-dot` 残留。

#### B. 菜单宽度随语言自适应（本次核心）

固定宽度在英文下会截断：`organization`、`live streaming`、`merchandise`、
`Supply Chain`、`customer service` 都显示不全。

```css
/* styles.css 末尾的覆盖段 */
.sidebar  { width: max-content; }

.rail {
  width: max-content;
  min-width: 112px;   /* 中文不会被压窄，保持原视觉 */
  overflow-x: visible;
}

.submenu {
  flex: 0 0 auto;     /* 关键：前面有 .submenu{flex:1}，flex-basis:0 会让 width 失效 */
  width: max-content;
  min-width: 168px;
  max-width: 300px;   /* 兜底，避免超长英文把主内容区挤没 */
}

.submenu-item,
.submenu-section-title { white-space: nowrap; }  /* 父级已随内容撑开，条目不再省略 */
```

顶部栏联动：rail 变宽后，`topbar` 的 `padding-left` 和 `topbar-brand` 的固定 112px
会与新宽度错位。改成由 CSS 变量驱动：

```css
.topbar       { padding: 0 20px 0 calc(var(--rail-width, 112px) + 20px); }
.topbar-brand { width: var(--rail-width, 112px); }
```

`AdminLayout.tsx` 用 `ResizeObserver` 监听 `.rail` 实测宽度，回填
`document.documentElement.style.setProperty('--rail-width', ...)`，
依赖数组带 `[collapsed, locale]`，切换语言/折叠时重新测量。

实测结果（1440×900，17 个一级菜单逐组遍历）：

```text
中文：rail 112 / submenu 168 / sidebar 280  —— 与改前完全一致，无视觉变化
英文：rail 164 / submenu 168~237 / sidebar 332~410
      最长 rail 标签 "customer service" 98px → rail 撑到 164
      最长二级条目 "Customer Service Desk" 151px → submenu 撑到 237（未触及 300 上限）
折叠态：rail/sidebar/topbar-brand 均回到 112，来回折叠展开正常
顶部栏：brandMatchesRail=true，topbar 内容左边界 = rail右边缘 + 20px
中→英→中 往返：宽度正确收缩回 112/168
pageerror 0；tsc -b 0 错误；npm run build ✓
```

### 6.1.4 切换组织：从「空壳」补成真实可用 + 新建店铺/门店

#### A. 之前为什么切不了

```text
1. 显示条件写反：adminType !== 'admin'（平台管理员恒 false，看不到入口）
   → 已改为对齐原版 isMerchant()||isS2b2c()||isStore()
2. 点击行为是假的：只清 localStorage 再 reload，等于把用户踢回组织选择页
   → 原版 switchShop() 只是打开弹窗，真正切换在 SelectShop.vue::toIndex()
3. choose 接口入参传错（关键）
   我最初传 { type, shopId }，后端静默容忍并返回 shopView:false ——
   接口成功但完全没切换，属于最难发现的那类 bug。
   正确入参是 { adminType, id }（Rust LoginChooseParam / Java LoginChooseDTO）。
```

#### B. 现在的实现

新增 `src/components/SelectShopModal.tsx`，复刻 `IndexSelectShop.vue`：

```text
数据源   GET  /merchant/shop/myShop?sortField=lastLoginTime
         返回 { shop:{records}, vendor:{records}, userinfo }
切换     POST /merchant/shop/choose  入参 { adminType, id }
         返回 { shopView, authorities }
新建店铺 POST /merchant/shop/create          { shopTitle, shopType: 1 }
新建门店 POST /merchant/shop/create          { shopTitle, shopType: 2 }
新建供应商 POST /supplyChain/supplier/create  { vendorName }
权限判定 GET  /merchant/adminUserShop/checkIsAdmin → { isAdmin }
```

切换流程（对齐 toIndex）：

```text
1. 调 choose 让后端确认身份并下发该组织的 authorities
2. 写 localStorage：adminType / shopId / vendorId / shopTitle / shopType
   + admin_authorities（后端下发的权限位）
   + admin_shop_view（shopView，店铺视图标记）
3. lastOpenTime 重新计时（避免「新订单」角标沿用上个组织的窗口）
4. window.location.reload()，菜单由 App 按新身份重新拉取
```

新建按钮显隐（对齐 canShowCreateShopBtn / canShowCreateStoreBtn）：

```text
adminType === 'shop' && shopType === 1 && isAdmin → 显示「新建店铺」
adminType === 'shop' && shopType === 2 && isAdmin → 显示「新建门店」
```

注意 `shopType` 必须写进 localStorage —— 之前 admin-semi 从未存过它，
而原版 `getShopType()` 依赖它，否则新建按钮永远不显示。

#### C. 验证（真实后端）

```text
A) 起始:                {adminType:"admin", shopId:null}
B) 点「单机设备」卡片:
   choose 请求体:       {"adminType":"shop","id":"1667501124"}   ← 格式正确
   切换后 localStorage: {adminType:"shop", shopId:"1667501124", shopType:"1",
                        shopTitle:"单机设备", authorities:"[\"all\"]", shopView:"1"}
   新身份下后端响应:    myShop.current=1 / msgTypeArr code=0  ← 后端确实按新身份工作
   页面:                保持登录，pageTitle=概览
C) 再切回管理后台:
   localStorage:        {adminType:"admin", shopId:null, shopView:"0"}  ← 双向闭环 OK
D) 新建功能（强制 isAdmin=true 验证 UI）:
   按钮:  ["新建店铺"]
   表单:  标题「新增店铺」/ 标签「店铺名称」/ placeholder「店铺名称不能为空」
   空值提交 → Toast「店铺名称不能为空」（与原版校验文案一致）
ERRORS: 0
```

#### D. 已知限制

```text
1. 当前 admin 账号后端 checkIsAdmin 返回 false，因此新建按钮不显示（与原版一致）。
   要用真实店铺管理员账号才能看到「新建店铺/新建门店」。
2. 原版还有「pos 收银台入口」（toIndex 的 posEntry 分支），
   本项目未接入 POS 入口，故未实现；switchTo 已预留 posEntry 参数。
3. 原版切换后会先 getMenu() 再 reload；本项目菜单由 App 启动时按
   localStorage.adminType 拉取，reload 等价达成，故未单独发一次菜单请求。
```

### 6.1.5 POS 收银台入口：核查原版后改为进入后台「收银工作台」

#### A. 核查结论：原版的 posEntry 分支实际是断的

用户要求「按原版逻辑实现」，因此先做了完整核查，结论是原版该分支不可用：

```text
1. 原版 admin 源码没有 POS 页面：
   src/views/pos/ 下只有 utils/scanAddCart.ts 与 __tests__/diningTableCut.test.ts

2. POS 路由被显式注释禁用：
   src/router/index.ts:5
   // import posRouters from "@/views/pos/router/asyncRoutes/pos";

3. 全项目只有一处跳 /pos：
   src/utils/util.ts:371  router.push("/pos");
   而该路径没有对应路由定义 → 跳过去是空白/404

4. 线上 admin 产物（2.33MB entry）验证：
   "/pos" 命中 2 次，其中 1 次是上述 b.push("/pos")，另 1 次在别的字符串里；
   全文不存在 path:"/pos" 的路由声明。
   accessToken => 12 次，admin_access_token => 0 次

5. 线上 /admin/pos/ 不是独立应用：
   返回的 HTML 引用 /admin/assets/index-BYky8Jxs.js，
   与 /admin/ 完全同一个入口 —— 只是 SPA fallback，进去仍然渲染后台。
```

∴ 照抄原版只会复刻一个坏入口，所以采用可用方案（用户已确认）：

#### B. 当前实现

`SelectShopModal.tsx` 的 posEntry 分支改为进入后台自带的收银工作台页：

```ts
if (posEntry) {
  // 原版是 router.push('/pos')，但该路由在本版本已移除；
  // 本项目后台自带「收银工作台」页（pos0 → PosWorkbench），直接跳该页
  window.location.replace(`${window.location.pathname}?page=pos0`);
  return;
}
```

同时删除了上一版引入的 `admin_pending_pos_entry` 标记 + `AdminLayout` 里
`window.open('/admin/pos/')` 的逻辑 —— 那条路会打开原版 Vue POS 打包产物，
而它读的是 `accessToken`（实测 2 次），admin-semi 存的是 `admin_access_token`，
必然跳登录页。

调用方式：选择组织弹窗里，每张店铺卡片下方有「进入收银台」按钮
（`.select-shop-pos-btn`），点击即 `switchTo(shopId, 'shop', true)`。

#### C. 验证

```text
点击「进入收银台」后：
  URL:      http://127.0.0.1:3003/?page=pos0
  页面标题: 收银工作台            ← hasPosWorkbench: true
  身份:     adminType=shop / shopId=1667501124 / shopType=1
  token:    保留（未丢失）
  新开标签页: 0                   ← 不再弹外部 POS
  pageerror: 0
```

#### D. 遗留

```text
收银工作台页面内原有的「进入收银台」按钮仍指向 /admin/pos/，
那是原有设计（由 PosWorkbench::openPos 打开原版 POS 预览产物）。
如需同样改为站内页，需要先确认生产环境是否真的部署了独立 POS 应用。
```

#### E. 排障记录：dev server 白屏 `AdProduct is not defined`

排查 POS 入口时遇到 dev 白屏，报 `AdProduct is not defined`：

```text
全库 grep \bAdProduct\b => 0 处（源码里根本没有这个标识符）
结论：node_modules/.vite 依赖预构建缓存里残留了旧引用（dev server 期间崩溃过两次）
处理：删 node_modules/.vite 后重启 dev server，恢复正常
以后遇到「源码里搜不到但运行时报某个标识符未定义」，优先清 vite 缓存
```

### 仍未做


```text
1. 分类 Tab 名称（交易消息 / 商品消息 / 售后服务 / 其它消息 / 财务消息）
   由后端返回，未走 t()，英文态仍是中文；已在 en.ts 缺词条，需要补「名称→英文」映射或后端多语言。
2. 子类型名称（新订单 / 已付款订单 / 订单完成 / 发货提醒 / 商品下架…）同样是后端中文文案。
3. 真实后端点「单条已读」未在线上数据上点，避免改动生产消息状态；逻辑已用打桩回归覆盖。
```

---

## 7. 快速检查命令

```bash
# TypeScript
cd rust/web/admin-semi
npx tsc -b

# Admin 本地
npm run dev -- --host 127.0.0.1 --port 3003

# PC 本地
cd ../pc-semi
npm run dev

# Admin 构建（/admin-semi/ 子路径）
npx tsc -b
npx vite build --base=/admin-semi/

# PC 构建
cd ../pc-semi
npm run build

# Git 状态
cd D:\tigshop\java-b2b2b-pro-v5.8.57
git fetch origin main
git status
git diff --stat origin/main
```

---

## 8. 交接结论

本次已完成跨境版顶部栏的 React 复刻：

```text
i18n 中英文切换
功能搜索
消息中心（分类、已读、未读角标）
语音播报（记录、设置、引导、弹窗）
查看商城
授权信息
用户下拉菜单
SSE / homeSummary 兜底
响应式窄屏处理
```

代码在 `rust/web/admin-semi`，已同步 GitHub `main`。
生产环境未构建、未部署，部署时按本文第 5 节执行。
