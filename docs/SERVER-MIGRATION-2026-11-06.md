# 站点重建：battery.recy.cc + admin.recy.cc（2026-11-06）

目标结构：

```text
PC / 商城        https://battery.recy.cc   根目录 /www/wwwroot/battery.recy.cc
后台             https://admin.recy.cc     根目录 /www/wwwroot/admin.recy.cc（admin-semi，base=/）
Rust 后端        systemd nextrade          127.0.0.1:8080（/adminapi）与 8181（/api /static）
PC SSR           systemd nextrade-pc       127.0.0.1:3005
删除             /www/wwwroot/shop.recy.cc（旧站根 + /admin/ Vue 后台 + 子路径 /admin-semi/）
```

执行顺序不能颠倒：**先建新目录、部署、切换 nginx、验证通过，最后才处理旧目录**。
旧目录很可能同时是 battery.recy.cc 当前的 root，直接删会让商城和后台一起 404。

---

## 0. 前置检查（只读，不改任何东西）

```bash
# 1) 旧目录里到底有什么
du -sh /www/wwwroot/shop.recy.cc
ls -la /www/wwwroot/shop.recy.cc /www/wwwroot/shop.recy.cc/public 2>/dev/null | head -40

# 2) 当前 nginx 的 server_name 与 root 对应关系（最关键）
nginx -T | grep -nE "server_name|root |alias " | head -60

# 3) 哪些 location 指向旧目录
nginx -T | grep -n "shop.recy.cc" | head -40

# 4) 服务与端口
systemctl list-units --type=service | grep -E 'nextrade|tigshop'
ss -lntp | grep -E ':3005|:8080|:8181'

# 5) 有没有定时任务会覆盖部署
crontab -l
ls -la /www/server/cron/ 2>/dev/null | head -20
grep -rl "/www/backup/.*\.sh" /www/server/cron/ 2>/dev/null
```

必须确认三件事，再往下走：

1. `battery.recy.cc` 当前的 `root` 是不是 `/www/wwwroot/shop.recy.cc/public`（若是，删目录 = 删站）。
2. `/mobile/`（H5）和 `/pc/`（旧静态 PC）是否也在这个目录里，需要先迁走。
3. `crontab` / 宝塔计划任务里有没有引用 `/www/backup/*.sh` 的任务（历史坑：每分钟回滚一次部署）。

把第 2 步的输出贴出来，可以直接得到两个站点的完整 location 清单，后面新配置照抄改 root 即可。

---

## 1. DNS 与证书

`admin.recy.cc` 的 A 记录已解析（用户确认）。在宝塔里给两个域名分别：

```text
站点 → 域名管理 → 添加 battery.recy.cc / admin.recy.cc
SSL → Let's Encrypt → 申请 → 开启强制 HTTPS
```

验证：

```bash
curl -sI https://admin.recy.cc | head -3
curl -sI https://battery.recy.cc | head -3
```

`admin.recy.cc` 必须能正常握手，否则后台加载不出来，且 SSE 会反复重连。

---

## 2. 建目录

```bash
mkdir -p /www/wwwroot/battery.recy.cc
mkdir -p /www/wwwroot/admin.recy.cc
chown -R www:www /www/wwwroot/battery.recy.cc /www/wwwroot/admin.recy.cc
```

不要用 `chmod 777`。Next 运行时只需要读权限，`www` 属主即可。

---

## 3. 部署 PC 到 /www/wwwroot/battery.recy.cc

取最新 `pc-build-<n>` 的 `nextrade-pc.tgz`（约 2.5 MB）与 `.sha256`：

```bash
cd /www/backup
curl -fL -o pc-runtime.tgz \
  https://github.com/lanline123/NexTrade/releases/download/pc-build-9/nextrade-pc.tgz
curl -fL -o pc-runtime.tgz.sha256 \
  https://github.com/lanline123/NexTrade/releases/download/pc-build-9/nextrade-pc.tgz.sha256
sha256sum -c pc-runtime.tgz.sha256

# 解到临时目录，确认无误再切换
rm -rf /www/wwwroot/battery.recy.cc.new
mkdir -p /www/wwwroot/battery.recy.cc.new
tar -xzf pc-runtime.tgz -C /www/wwwroot/battery.recy.cc.new
chown -R www:www /www/wwwroot/battery.recy.cc.new
```

如果是首次建站，直接把 `.new` 改名为正式目录；如果已有旧版本：

```bash
systemctl stop nextrade-pc
mv /www/wwwroot/battery.recy.cc /www/wwwroot/battery.recy.cc.bak.$(date +%Y%m%d%H%M)
mv /www/wwwroot/battery.recy.cc.new /www/wwwroot/battery.recy.cc
systemctl start nextrade-pc
```

systemd 单元（`/etc/systemd/system/nextrade-pc.service`）：

```ini
[Unit]
Description=nextrade-pc (Next.js SSR)
After=network.target

[Service]
Type=simple
WorkingDirectory=/www/wwwroot/battery.recy.cc
Environment=NODE_ENV=production
Environment=PC_API_BASE=https://battery.recy.cc
ExecStart=/www/server/nodejs/v24.19.0/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3005
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now nextrade-pc
systemctl restart nextrade-pc
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3005/
```

> `PC_API_BASE` 是构建期变量（rewrites 编译进 `.next/routes-manifest.json`），
> 这里再写一遍只是保持与构建一致，改它不会改代理目标。

### 3.1 迁移 H5 与旧静态 PC

如果第 0 步确认 `/mobile/`、`/pc/` 在旧目录内：

```bash
rsync -a /www/wwwroot/shop.recy.cc/public/mobile/ /www/wwwroot/battery.recy.cc/mobile/
rsync -a /www/wwwroot/shop.recy.cc/public/pc/     /www/wwwroot/battery.recy.cc/pc/
chown -R www:www /www/wwwroot/battery.recy.cc/mobile /www/wwwroot/battery.recy.cc/pc
```

路径以第 0 步的实际输出为准，不要照抄。

---

## 4. 部署 admin-semi 到 /www/wwwroot/admin.recy.cc

本地构建（独立域名根目录，**不要**加 `--base=/admin-semi/`）：

```bash
cd rust/web/admin-semi
npm install
npm run build          # tsc -b && vite build
```

产物在 `dist/`。上传到服务器后：

```bash
cd /www/wwwroot
rm -rf admin.recy.cc.new
mkdir -p admin.recy.cc.new
# 解压/上传 dist 内容到 admin.recy.cc.new
chown -R www:www admin.recy.cc.new

# 首次：直接改名
mv admin.recy.cc.new admin.recy.cc

# 已有版本：先备份再换
# mv admin.recy.cc admin.recy.cc.bak.$(date +%Y%m%d%H%M)
# mv admin.recy.cc.new admin.recy.cc
```

为什么这次用独立域名：源码里 9 处 `window.location.origin + '/?page=...'` 没有带子路径前缀，
放在 `/admin-semi/` 下会跳到商城首页；放在 `admin.recy.cc` 根目录后这些跳转恰好正确。
以后若再改回子路径，必须先把这些跳转改成 `import.meta.env.BASE_URL` 或相对路径。

---

## 5. Nginx

### 5.1 battery.recy.cc

```nginx
server {
    listen 80;
    server_name battery.recy.cc;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name battery.recy.cc;

    ssl_certificate     /www/server/panel/vhost/cert/battery.recy.cc/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/battery.recy.cc/privkey.pem;

    root /www/wwwroot/battery.recy.cc;
    client_max_body_size 100m;

    # 后台 API（Rust 8080），SSE 必须关缓冲
    location /adminapi/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # 前台 API 与静态资源（Rust 8181）
    location /api/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_set_header Host $host;
        expires 7d;
    }

    # H5
    location /mobile/ {
        try_files $uri $uri/ /mobile/index.html;
    }

    # 旧静态 PC（稳定后可删）
    location /pc/ {
        try_files $uri $uri/ =404;
    }

    # PC SSR
    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 admin.recy.cc

```nginx
server {
    listen 80;
    server_name admin.recy.cc;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.recy.cc;

    ssl_certificate     /www/server/panel/vhost/cert/admin.recy.cc/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/admin.recy.cc/privkey.pem;

    root /www/wwwroot/admin.recy.cc;
    index index.html;
    client_max_body_size 100m;

    location /adminapi/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    location /static/ {
        proxy_pass http://127.0.0.1:8181;
        proxy_set_header Host $host;
    }

    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
nginx -t && nginx -s reload
```

---

## 6. 验证清单

按顺序过一遍，任何一项失败就先停在这里，不要删旧目录。

```text
[ ] https://battery.recy.cc/                   200，首页正常渲染
[ ] https://battery.recy.cc/api/health         200 UP
[ ] https://battery.recy.cc/adminapi/health    200 UP
[ ] 商品列表 → 详情 → 加购 → 下单页          无 404/500
[ ] https://battery.recy.cc/mobile/            H5 首页正常
[ ] https://admin.recy.cc/                     登录页，静态资源 /assets/ 全部 200
[ ] 登录 admin / admin123 + 组织「管理后台」   进入仪表盘
[ ] 后台抽查 5 个菜单页                        无 pageerror
[ ] 装修编辑器 → 保存草稿 → 「返回装修管理」   回到后台，不跳商城（本次改造的关键点）
[ ] 后台消息中心 SSE                          Network 里 adminMsg/msgCount 处于 pending/流式
[ ] 上传一张图片                              返回 URL 可访问
[ ] 8 语种首页切换                            html lang 正确
```

浏览器控制台要看两项：`/admin-semi/` 开头的旧资源请求必须为 0（有则说明浏览器缓存了旧 HTML），
以及没有跳转到 `battery.recy.cc/?page=...` 的导航。

---

## 7. 下线旧目录

确认第 6 步全部通过、并已观察至少半天后：

```bash
# 1) 先让旧站点不再被访问：注释/删除 shop.recy.cc 的 server 块或把 server_name 改掉
nginx -t && nginx -s reload

# 2) 改名备份，不要立刻 rm
mv /www/wwwroot/shop.recy.cc /www/wwwroot/shop.recy.cc.bak.$(date +%Y%m%d%H%M)

# 3) 复查
curl -sI https://battery.recy.cc/ | head -3
curl -sI https://admin.recy.cc/ | head -3

# 4) 确认无进程/计划任务引用旧路径
grep -rl "shop.recy.cc" /www/server/panel/vhost/nginx/ /www/server/cron/ /etc/systemd/system/ 2>/dev/null
```

观察 3–7 天无异常后再删：

```bash
rm -rf /www/wwwroot/shop.recy.cc.bak.YYYYMMDDHHMM
```

`rm -rf` 之前把要删的路径 `echo` 一遍，确认没有多打一个字符。

---

## 8. 回滚

旧目录改回名字、nginx 恢复旧 server 块即可，Rust 服务不受影响：

```bash
mv /www/wwwroot/shop.recy.cc.bak.YYYYMMDDHHMM /www/wwwroot/shop.recy.cc
# 恢复旧 server 块中的 root / server_name
nginx -t && nginx -s reload
```

后台回滚：

```bash
cd /www/wwwroot
mv admin.recy.cc admin.recy.cc.failed
mv admin.recy.cc.bak.YYYYMMDDHHMM admin.recy.cc
nginx -s reload
```

PC 回滚：

```bash
systemctl stop nextrade-pc
mv battery.recy.cc battery.recy.cc.failed
mv battery.recy.cc.bak.YYYYMMDDHHMM battery.recy.cc
systemctl start nextrade-pc
```

---

## 9. 换域名后容易漏的外部配置

```text
1. 微信支付/公众号：JS 接口安全域名、网页授权域名、支付授权目录里是否写了 shop.recy.cc 或 /admin/
2. 支付宝：应用网关、授权回调地址
3. Google / Facebook OAuth 回调（当前本来就没配通，顺手一起改）
4. 后台「全局设置」里的商城地址、客服链接、logo 绝对 URL（globalSettings 存的是完整 URL）
5. 商品/文章里手工填过的绝对链接
6. 宝塔防火墙、云厂商安全组是否需要放行 admin.recy.cc
7. 搜索引擎站长平台改域名、sitemap 与 robots 里的域名（SEO 会掉一段时间，属正常）
8. 任何写死 `shop.recy.cc` 的脚本、计划任务、监控探活
```

其中第 4 项最容易漏：后台设置里若存了 `https://shop.recy.cc` 的绝对地址，换域名后前台图片/跳转会指向旧域名。

---

## 10. 与交接文档的关系

- 站点结构与部署步骤已写进 `docs/HANDOVER.md` §0、§10。
- 本次核查发现的其它不一致（仓库名、二进制资产名、脚本路径）见 `docs/DEPLOY-AUDIT-2026-11-06.md`。
- 迁移完成后，把本文第 6 步的实际结果补到 HANDOVER §11 的待办里勾掉对应项。

---

## 11. 执行记录（2026-11-06 已完成）

```text
新目录
  /www/wwwroot/battery.recy.cc      155M（PC 运行时 + mobile + pc + oauth + cycleCard）
  /www/wwwroot/admin.recy.cc        9.2M（admin-semi，base=/，本地 09:51 构建）

systemd
  nextrade-pc  WorkingDirectory=/www/wwwroot/battery.recy.cc（原 nextrade-pc 目录保留未删）

nginx
  html_shop.recy.cc.conf   重写：root 指向新目录，去掉 extension 引用与旧 /admin location，
                           /admin 与 /admin-semi/* 统一 301 到 https://admin.recy.cc/
  html_admin.recy.cc.conf  新增：80 → 443，/adminapi（关缓冲）、/static、/im、/ws 反代

证书
  admin.recy.cc  acme.sh + Let's Encrypt，有效期至 2027-02-04，已装 cron 自动续期
  battery.recy.cc 沿用原 cert/shop.recy.cc 下的证书（CN=battery.recy.cc，独立域名未变）

宝塔
  site.db 中 id=3 的 path 已改为 /www/wwwroot/battery.recy.cc（站名未改，避免影响面板按名生成配置）
  备份：/www/backup/nginx-20261106/site.db.bak 与 html_shop.recy.cc.conf.*

旧目录
  已改名为 /www/wwwroot/shop.recy.cc.bak.202611061607，未删除（1.9G）

验证结果
  battery：/ 、/api/health、/adminapi/health、/pc/、/mobile/、/oauth/callback、/cycleCard 全部 200
  admin：/ 与 index 引用的 6 个 assets 全部 200，/admin-assets/* 200
  /admin-semi/、/admin-semi/foo 均 301 到 admin.recy.cc
  登录链路：csrf/create → login/signin 返回 token → 带 token 请求 homeSummary 返回真实未读数
```

### 2026-11-06 16:14 面板建站后的调整

用户在宝塔面板为 admin.recy.cc 建站（site id=27，root `/www/wwwroot/admin.recy.cc`），面板生成的主配置覆盖了手写版本（只有 80、无 API 反代）。已按面板结构重新拆分：

```text
主配置  html_admin.recy.cc.conf
        保留面板的敏感文件规则、静态缓存、日志与 include 结构，
        手工补回 listen 443 + 证书块（cert/admin.recy.cc/）+ HTTP 跳转

扩展    extension/admin.recy.cc/custom.conf
        client_max_body_size、/adminapi（关缓冲）、/static、/im、/ws、
        /assets 与 /admin-assets 30 天缓存、SPA 回退 try_files → /index.html
        面板重新生成主配置时这段不会丢
```

验证：`/`、`/adminapi/health`、`/assets/*`、`/admin-assets/*`、`/?page=orders`、任意深链 200；
`http://` 301 到 `https://`；证书 CN=admin.recy.cc；登录 + homeSummary 正常。

### 2026-11-06 16:20 面板重建 battery 站点

用户在面板新建 battery.recy.cc（site id=28），面板生成了默认静态配置、写入了默认 `index.html`，
旧的 `html_shop.recy.cc.conf` 与 site id=3 一并消失，站点回到「恭喜，站点创建成功」页面。
处理方式与 admin 相同：

```text
主配置  html_battery.recy.cc.conf（面板生成）
        自带 80/443、证书 cert/battery.recy.cc（面板新签，到期 2027-02-04）、HTTP 跳转
扩展    extension/battery.recy.cc/custom.conf
        / → 3005、/api /static → 8181、/adminapi → 8080（关缓冲）、/im、/ws、
        /pc/ /pcMobile /mobile /oauth/callback /cycleCard、/admin* → admin.recy.cc 301
默认页  /www/wwwroot/battery.recy.cc/index.html 已移到
        /www/backup/nginx-20261106/bt-default-index.html
```

⚠️ 关键坑：面板主配置里的 `location ~ .*\.(js|css)?$` 会把 `/_next/` 下的构建产物当本地文件处理，
返回 404 —— 表现是 HTML 能打开但 JS/CSS 全挂、页面白屏。`custom.conf` 里必须有：

```nginx
location ^~ /_next/ {
    proxy_pass http://127.0.0.1:3005;
}
```

验证：首页标题正确、`/_next/` 下 12 个 chunk 与 3 个 CSS 全 200、`/product/SN0000104`、`/search`、
`/cart`、`/login` 均 200，`/admin-semi/` 301 到新后台，`http://` 301 到 `https://`。

遗留事项：

```text
1. 旧目录观察 3–7 天后执行 rm -rf（先 echo 确认路径）
2. admin.recy.cc 已在面板站点列表（id=27）；证书仍由 acme.sh 的 cron 续期。
   若在面板点「SSL → 强制 HTTPS」，面板会重写主配置的 SSL 段，证书路径保持一致，
   重写后跑一次 nginx -t 并确认 custom.conf 仍被 include
3. battery.recy.cc 已在面板站点列表（id=28），证书由面板签发与管理（到期 2027-02-04）
4. 部署的 admin 构建是本地 2026-11-06 09:51 产物，标题为「NexTrade · 数字化交易底座」，
   与迁移前线上标题「万物新生 · 运营管理后台」不同；如需回退到旧构建，用备份目录重新上传
5. 微信/支付宝/OAuth 等外部白名单仍需按第 9 节逐项核对
```
