# 部署链路核查报告（2026-11-06）

核查对象：`docs/HANDOVER.md` 第 5.4 / 5.5 / 8 / 9 / 10 节，以及 `tools/` 下部署脚本。
核查方式：读本地源码 + GitHub API（仓库、Release、workflow）+ 线上探测（battery.recy.cc）。

## 0. 结论

推送 → 构建 → 下载 → 宝塔部署这条链路是存在的，主干命令可用，但**交接文档与脚本已经不同步**，照抄会踩三个硬坑：

1. `tools/deploy-rust-bt.ps1`、`commit-api.ps1`、`commit-pc-api.ps1`、`sync-api.ps1` 都把工作目录写死在 `D:\tigshop\java-b2b2b-pro-v5.8.57`，当前仓库在 `D:\tigshop\NexTrade`，脚本第一步就抛错。
2. Rust 部署脚本里的目录和服务名仍是 `tigshop-rust` / `tigshop`，而文档最新口径（2026-11-06 07:08 提交 `8ae2b1b`「update handover for nextrade naming」）已是 `/www/wwwroot/nextrade` / `nextrade`。
3. admin-semi 文档写「尚未部署」，实际 `https://battery.recy.cc/admin-semi/` 已返回 200 并加载 `/admin-semi/assets/`；同时源码里 `window.location.origin}/?page=...` 的子路径跳转是坏的（见第 5 节）。

## 1. GitHub 推送

| 项目 | 文档 | 核查结果 |
| --- | --- | --- |
| 仓库 | `lanline123/rustshop` | 实际为 **`lanline123/NexTrade`**（GitHub API 确认，public，默认分支 main，2026-10-20 创建，2026-11-06 07:08 仍有 push） |
| 分支 | main | 一致 |
| 提交方式 | git 命令 + REST API 兜底 | 一致；`tools/commit-api.ps1` 等三个脚本已指向 NexTrade |

`rustshop` 这个旧名是 10 月的仓库名，GitHub 会对改名后的旧地址做重定向，但文档、脚本注释都应统一到 `NexTrade`，否则新人会去 clone 一个被重定向的地址。

脚本阻塞点：`commit-api.ps1:7`、`commit-pc-api.ps1:5`、`sync-api.ps1:12` 都是 `Set-Location 'D:\tigshop\java-b2b2b-pro-v5.8.57'`。该目录在当前机器上不存在，PowerShell 会直接报 `Cannot find path` 并终止。改成 `$PSScriptRoot\..` 更稳。

## 2. 构建（GitHub Actions）

线上共 4 个 workflow：`build-rust-backend`、`build-pc-frontend`、`build-rust-staging`、`check-rust`。全部 `workflow_dispatch` 手动触发，没有 push 触发，符合文档「不要每次 push 都构建」。

### 2.1 Rust 后端

`build-rust.yml` 与本地一致：rockylinux:8 容器、glibc 2.28、sccache 缓存、Release tag `build-<GITHUB_RUN_NUMBER>`。

**但产物名正在变更，文档只写了旧的一半：**

- 最新 Release `build-150`（2026-11-06 02:31 构建，02:48 发布）资产是 `rustshop`（52,928,040 字节）与 `rustshop.sha256`。
- 当前 `build-rust.yml`（本地与 remote main 均已改）打包名是 `nextrade` / `nextrade.sha256`。
- 结论：改名发生在 build-150 之后，**下一次构建起资产名才是 nextrade**。取二进制时以 Release 实际资产名为准，别按文档硬编码。

### 2.2 PC 前端

`build-pc.yml` 产出 `nextrade-pc.tgz` + `nextrade-pc.tgz.sha256`，tag 为 `pc-build-<n>`（文档未写这条规则）。今天已出 `pc-build-3`、`pc-build-7`、`pc-build-9`，最新 `pc-build-9`（04:41）包体 **2,620,159 字节（约 2.5 MB）**，不是文档 §10.3 写的「约 26 MB」。包内是 strip 过的 .next + 精简依赖（next/react/react-dom 在 CI 里 `npm install` 后一并打进包），所以体积小是正常的，文档数字过期。

文档 §6 写「PC：pc-semi v20 已部署」，但仓库里 PC workflow 是 2026-11-06 03:38 才创建的，run number 才到 9，v20 属于改名前的旧仓库口径，无法从当前 Release 复核。

### 2.3 admin-semi

GitHub 上没有 admin-semi 工作流。文档「本地 `npm run build` → 上传 dist」是唯一路径，这点正确。

### 2.4 staging / check

`build-staging.yml` 产出 artifact `rustshop-staging`（thin LTO，只上传 artifact 不发 Release），`check-rust.yml` 做 cargo check。两份文档都没提，交接时应补一句，否则接手人看到多出来的 workflow 会困惑。

## 3. 下载与部署（Rust 后端）

文档 §5.5 的服务器侧命令链是正确的（合并 → 校验 → 停服 → 备份 → 替换 → 起服 → 探活 → 失败回滚）。问题在工具脚本和校验细节：

1. `tools/deploy-rust-bt.ps1:7` 同样写死旧目录，且第 68–105 行全程使用 `/www/wwwroot/tigshop-rust/tigshop` 与服务名 `tigshop`。按文档最新口径应为 `/www/wwwroot/nextrade/nextrade` 与 `nextrade`。**脚本未改之前不能直接用。**
2. 脚本合并完成后**没有做远端 sha256 比对**：第 26 行算了 `$hash`，但只用于最后一行 `Write-Host`，没有和服务器上的文件比对。与文档「必须 sha256sum 校验」的要求不一致，等于把最关键的一步交给人工。
3. 文档 §5.5 写 `sha256sum -c`，但 Release 的 `nextrade.sha256` 内容形如 `<hash>  nextrade`；上传分片在服务器合并成 `bXXX.bin` 后直接 `-c` 会报「no such file」。要么合并时就叫 `nextrade`，要么改成 `sha256sum bXXX.bin` 后手工比对那串 hash。
4. 文档自己的服务名没统一：§0/§5.5/§10 写 `nextrade`，§5.2 写 `systemd：tigshop`。以 2026-11-06 的提交说明为准应取 `nextrade`，但上线前仍需在服务器 `systemctl list-units | grep -E 'tigshop|nextrade'` 确认一次。

## 4. 宝塔面板

写对的部分：nginx 反代、`try_files` 回退、assets 长缓存、SSE 关 buffering、PC 用 `next start -H 127.0.0.1 -p 3005`、`/www/backup/pc-*.sh` 定时任务会把部署回滚成旧包的坑，都是真实且关键的。

需要修正或补充的部分：

1. **域名/站点根没有对齐**。§10.1 写站点根 `/www/wwwroot/shop.recy.cc/public`、Nginx 配置 `html_shop.recy.cc.conf`；但线上可访问的是 `battery.recy.cc`（`/api/health`、`/adminapi/health` 均 200）。`shop.recy.cc` 直接访问返回 `ERR_CERT_AUTHORITY_INVALID`。两个域名的关系（同一站点多 server_name 还是两套站点）文档没交代，部署前必须确认 nginx 的实际 `server_name` 与 `root`。
2. **admin-semi 已经在线上**。`https://battery.recy.cc/admin-semi/` 返回 200，HTML 引用 `/admin-semi/assets/index-BBstRfbz.js` 等，说明已按 `--base=/admin-semi/` 构建并部署。§0 与 §11 第 1 条「尚未正式部署」已过期。
3. **PC 部署缺回滚**。Rust 有备份+回滚，PC 的步骤是 `rm -rf /www/wwwroot/nextrade-pc` 直接覆盖，没有 `mv` 备份。建议改成解到 `nextrade-pc.new`，切换软链或改名，失败可退回。
4. **`Environment=PC_API_BASE` 在 systemd 里其实不起作用**。`next.config.mjs` 的 `rewrites()` 在 build 时编译进 `routes-manifest.json`，运行时改环境变量不会改代理目标（`build-pc.yml` 构建期也设了同一个值，所以现在无影响）。要换 API 域名必须重新构建，不是改 unit。

## 5. 代码层问题：admin-semi 部署到子路径后的跳转

部署在 `/admin-semi/` 时，以下位置用 `window.location.origin` 拼绝对根路径，会跳出后台：

```text
src/App.tsx:836 / 849 / 862
src/pages/DecoratePcPages.tsx:391 / 1860
src/pages/PcDecorateEditor.tsx:1342 / 1360
src/pages/DecorateMobilePages.tsx:339
```

实测 `https://battery.recy.cc/?page=pcDecorateManage` 返回的是 PC 商城页（title「万物新生 · 退役动力电池循环利用产业服务平台」），不是 admin-semi。也就是说从装修编辑器点「返回装修管理」或「预览」，会离开后台落到商城首页。

修法：统一改成相对当前文档的 `?page=...`（保留 pathname），或用 `${import.meta.env.BASE_URL}` 拼前缀。注意 `src/components/SelectShopModal.tsx:221` 已经是 `${window.location.pathname}?page=pos0` 的正确写法，可作参照。

其余静态资源已经用 `import.meta.env.BASE_URL`（`Login.tsx`、`AdminLayout.tsx`、`PcDecorateEditor.tsx:4029`），这块没问题。

## 6. 修正后的 Rust 部署步骤（可执行）

以 `build-XXX` 为例，资产名先按 Release 实际值确认（build-150 是 `rustshop`，之后是 `nextrade`）。

```bash
# 服务器侧，直接下载 Release 资产（国内网络慢时再退回宝塔分片上传）
cd /www/backup
curl -fL -o nextrade.new \
  https://github.com/lanline123/NexTrade/releases/download/build-XXX/nextrade
curl -fL -o nextrade.sha256 \
  https://github.com/lanline123/NexTrade/releases/download/build-XXX/nextrade.sha256

# 校验：先对齐文件名，再 -c
mv nextrade.new nextrade && sha256sum -c nextrade.sha256
mv nextrade nextrade.new

# 切换（停服 → 备份 → 替换 → 起服）
systemctl stop nextrade
cp -a /www/wwwroot/nextrade/nextrade /www/backup/nextrade.preBXXX.bak
rm -f /www/wwwroot/nextrade/nextrade          # 运行中的二进制不能直接覆盖
cp nextrade.new /www/wwwroot/nextrade/nextrade
chmod 755 /www/wwwroot/nextrade/nextrade
systemctl start nextrade
sleep 5
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/adminapi/health
```

回滚：

```bash
systemctl stop nextrade
cp -f /www/backup/nextrade.preBXXX.bak /www/wwwroot/nextrade/nextrade
chmod 755 /www/wwwroot/nextrade/nextrade
systemctl start nextrade
```

如果必须走宝塔分片：上传后 `cat bXXX_* > nextrade.bin`，`sha256sum nextrade.bin` 与 Release 的 `.sha256` 首段人工比对，再按上面从 `systemctl stop` 开始执行。不要用 `sha256sum -c`（文件名不匹配）。

## 7. 待人工确认

1. 生产 `systemctl` 单元名与二进制目录到底是 `nextrade` 还是 `tigshop`（文档自相矛盾，脚本仍是旧值）。
2. nginx 实际 `server_name` / `root`：`battery.recy.cc` 与 `shop.recy.cc` 是同一站点还是两套，站点根到底是哪个路径。
3. 线上 `/admin-semi/` 当前构建对应哪个提交，是否已包含第 5 节的绝对路径跳转；打开装修编辑器点一次「返回装修管理」即可验证。
4. PC 线上版本与 `pc-build-9` 是否一致（文档的 v20 无法用当前 Release 复核）。
