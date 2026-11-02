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
