# PC Semi 部署说明

当前线上地址：`https://battery.recy.cc/`

旧 PC 静态站保留：`https://battery.recy.cc/pc/`

## 服务器结构

```text
/www/wwwroot/pc-semi          Next.js standalone 运行目录
/etc/systemd/system/pc-semi.service
127.0.0.1:3005                Next.js 监听端口
/www/backup/pc-min.tar.gz     最近一次可回滚部署包
```

## systemd

```ini
[Unit]
Description=PC Semi Next.js
After=network.target

[Service]
Type=simple
WorkingDirectory=/www/wwwroot/pc-semi
Environment=NODE_ENV=production
Environment=PORT=3005
Environment=HOSTNAME=127.0.0.1
ExecStart=/www/server/nodejs/v24.19.0/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable pc-semi
systemctl restart pc-semi
systemctl status pc-semi
```

## Nginx

站点配置：`/www/server/panel/vhost/nginx/html_shop.recy.cc.conf`

```nginx
location / {
  proxy_pass http://127.0.0.1:3005;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location = /pc { return 302 /pc/; }
location ^~ /pc/ { try_files $uri $uri/ /pc/index.html; }
location ^~ /pcMobile { try_files $uri $uri/ /pc/index.html; }
```

`/api`、`/adminapi`、`/static`、`/admin` 原有 location 保持不变。

## 打包

```bash
cd rust/web/pc-semi
npm run build:next      # 只要 .next 产物（部署用，最快）
# 或
npm run build           # .next + out/ 静态预览快照（多花几分钟，预览/检查用）
```

`npm run build` 会在 `.next` 之后额外跑 `scripts/static-snapshot.mjs`：临时把应用起在
127.0.0.1 的环回端口，逐条路由抓渲染好的 HTML 写进 `out/`，再把 `.next/static`、`public/`
拷过去，最后关掉进程。它只用于本地预览/自动化检查，**不要上传 `out/`**，线上仍是 server.js 常驻。

打包内容：

```text
.next/server + .next/static
server.js
最小生产依赖：next / react / react-dom
```

不要把整个 `node_modules` 上传。

## 更新

```bash
tar -xzf pc-min.tar.gz -C /www/wwwroot/pc-semi
systemctl restart pc-semi
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3005/
```

## 回滚

```bash
systemctl stop pc-semi
# 恢复上一版 /www/wwwroot/pc-semi
systemctl start pc-semi
# Nginx 回滚旧 PC：
# location / { try_files $uri /pc/$uri /pc/index.html; }
```

## 验证

```text
/                   200
/product/1528       200
/search             200
/cart               200
/login              200
/pc/                200 旧版
/admin/             200 后台
/api/home/home/pcIndex 200
```
