# Rust 后端 v5.8.61 交接文档

更新时间：2026-10-31  
适用版本：build-135  
生产域名：https://battery.recy.cc

---

## 1. 一句话结论

Rust 后端已完成 v5.8.61 主要功能迁移并通过全量测试，生产已部署 build-135；  
但支付渠道、图搜开关、前端 admin-semi、真实回调与核心业务 E2E 仍未做真实环境验证。

```text
代码/编译/单测/构建/部署：完成
真实渠道与业务闭环验证：未完成
```

---

## 2. 代码与基准

### Java 基准

```text
D:\tigshop\java-b2b2c-overseas-v5.8.61-d0fd28bcce96-4b28228ec4ff43febb4caff86778577c
```

### Rust 工作区

```text
D:\tigshop\java-b2b2b-pro-v5.8.57\rust\crates
```

主要 crate：

```text
tigshop-server       程序入口
tigshop-api          前台 API
tigshop-admin-api    管理端 API
tigshop-services     业务服务
tigshop-infrastructure  仓储/SQL
tigshop-core         模型/实体/契约
tigshop-security     JWT/密码
```

### 前端

```text
D:\tigshop\java-b2b2b-pro-v5.8.57\rust\web\admin-semi
```

当前状态：

```text
本地 npm run build 通过
生产 /admin/ 仍是旧 Vue 后台
/admin-semi/ 返回的是旧 /admin 的 SPA fallback
/seller/ 404
```

结论：admin-semi **尚未正式发布到生产**。

---

## 3. 当前生产

```text
版本：build-135
commit：35f0efa08e37f1ca8bbec950df991ec154a02617
binary：52,609,560 bytes
sha256：c4f05fbf61736f4c08c911650fd795d84f248470d545701211edc2db09a1118d
```

部署信息：

```text
systemd：tigshop
WorkingDirectory：/www/wwwroot/tigshop-rust
ExecStart：/www/wwwroot/tigshop-rust/tigshop
备份：/www/backup/tigshop.preB135.bak
```

部署校验：

```text
b135.bin: OK
HTTP=200 ACTIVE=active
sha256 一致
DONE
```

---

## 4. 测试与冒烟

### 全量测试

```text
cargo test --workspace -j 1
约 4562 passed / 0 failed / 1 ignored
```

### 路由契约

```text
python tools/route-diff-v5861.py
java_routes=1743 / rust_routes=2120 / missing=0 / extra=381
```

### 线上冒烟

```text
/                                         200
/api/health                               200
/adminapi/health                          200
/api/product/product/list                 200
/api/home/home/pcIndex                    200
/api/search/image/capabilities            200
/admin/                                   200
```

### 火山翻译真实验证

已写入生产配置：

```text
langVolcengineAccessKey
langVolcengineSecret
```

调用：

```text
GET /adminapi/setting/seo/translateToSeoIdentification
    ?chineseText=测试商品标题
```

返回：

```text
test-product-title
```

结论：火山翻译 AK/SK、签名、翻译、SEO 格式化均真实通过。

---

## 5. 构建流程

### 触发方式

GitHub Actions：

```text
workflow：build-rust-backend
文件：.github/workflows/build-rust.yml
分支：main
手动 workflow_dispatch
```

Release：

```text
tag：build-<run_number>
资产：rustshop、rustshop.sha256
```

### 注意

```text
1. 只手动触发，不要每次 push 都构建
2. 构建使用 remote main，不是本地未提交文件
3. 构建成功后再下载 Release 资产
```

---

## 6. 部署流程

### 服务器入口

宝塔面板辅助脚本：

```text
C:\Users\Public\bt2api.ps1
```

该脚本提供：

```text
Invoke-BTPost
$script:base
```

### 上传二进制

```powershell
cd D:\tigshop\java-b2b2b-pro-v5.8.57

.\tools\upload-to-bt.ps1 `
  -File C:\Users\...\rustshop `
  -RemoteDir /www/backup/ `
  -ChunkSizeMB 4 `
  -PartPrefix b135_
```

### 部署计划任务

通过宝塔 `crontab?action=AddCrontab` 添加一次性任务：

```text
cat b135_* > b135.bin
sha256sum -c
systemctl stop tigshop
cp 当前 tigshop -> /www/backup/tigshop.preB135.bak
cp b135.bin -> /www/wwwroot/tigshop-rust/tigshop
chmod +x
systemctl start tigshop
curl /adminapi/health
失败自动回滚
成功写 /www/backup/b135done
```

检查：

```text
/www/backup/b135.log
```

部署成功后删除计划任务：

```text
crontab?action=DelCrontab
```

### 回滚

```bash
systemctl stop tigshop
cp -f /www/backup/tigshop.preB135.bak /www/wwwroot/tigshop-rust/tigshop
chmod +x /www/wwwroot/tigshop-rust/tigshop
systemctl start tigshop
```

---

## 7. 已实现范围

### 支付

```text
微信 v3 下单
支付宝 page/wap/app 下单
PayPal 下单
Stripe Checkout
Xendit Invoice
Antom createPaymentSession
Apple Pay 可配置收单
充值支付
预售定金支付
退款：微信/支付宝/Stripe/PayPal/Xendit/Antom
退款回调：微信/Stripe/Xendit/PayPal/Antom
子商户绑定（可选归属校验）
分账提交/完结适配器
通用网关适配器：汇付/拉卡拉/易宝/YabandPay/YunPay
```

### 商户

```text
入驻申请
人工审核通过开店
免审核直接开店
开店初始化：
  merchant / admin_user / shop / merchant_user
  admin_user_shop / admin_role / employee role
  merchant_account / shipping_tpl / decorate
审核结果通知 webhook
```

### 商户进件

```text
submit / apply / approve / refresh
媒体上传（本地存储）
媒体预览（配置渠道代理）
```

### 内容/直播

```text
微信直播回调自动建单
order / order_item / paylog
wechat_live_order_rel
出站日志 ORDER_CREATED / ORDER_PAID
promotion_data 直播上下文快照
```

### 其他

```text
阿里云图搜（OSS 上传/检索/图库构建/同步/删除）
AI 图片翻译/消除/OCR
供应链
POS 桌台
多门店/店铺分组
Excel 导入导出
SEO 火山翻译
JWT 登出吊销
```

---

## 8. 生产配置状态（需重点关注）

### 阿里云图搜

```text
enabled=false
appEnabled=false
pcEnabled=false
h5Enabled=false
shopEnabled=true
indexName=batterysearch
regionId=cn-beijing
AK/SK 已保存
```

结论：**生产未启用图搜**。

### 支付开关

```text
useWechat=0
useAlipay=0
usePaypal=0
useStripe=0
useXendit=0
useAntom=0
```

已知占位/空值：

```text
wechatPayKey / AppId 多处 YouKey 占位
paypalClientId YouKey 占位
stripeSecretKey / webhookSecret 空
xenditSecretKey / webhookToken 空
antomClientId / 私钥 / 公钥空
```

结论：**支付渠道全部处于关闭状态，不能做真实支付验证**。

---

## 9. 未验证清单

### 支付

```text
微信真实下单/退款/回调
支付宝真实下单/退款/回调
PayPal 真实下单/capture/退款
Stripe 真实 Checkout/退款回调
Xendit 真实 Invoice/退款回调
Antom 真实下单/退款回调
Apple Pay validateMerchant/confirm
子商户绑定真实渠道
分账真实渠道
汇付/拉卡拉/易宝等真实网关
```

### 图搜

```text
生产图库构建
商品变更自动同步
删除商品清图
前台以图搜图
```

### 业务 E2E

```text
商户入驻 -> 审核 -> 开店 -> 登录后台
预售定金
充值
微信直播自动建单
商户进件 submit/approve/refresh
分账 submitBatch/manualFinish
POS 收银
多门店/多商户隔离
Excel 导入导出
AI 图片翻译/消除
短信/邮件/钉钉/企微通知
```

### 前端

```text
admin-semi 生产发布
真实浏览器登录/交互回归
223 页生产冒烟
```

### 基础设施

```text
JWT 黑名单为进程内内存，多实例不一致
未接 Redis 黑名单
通用支付网关回调为共享密钥，不是渠道真实签名
退款并发/幂等未压测
订单库存并发未回归
生产库是否完整升级到 v5.8.61 未重新核对
```

---

## 10. 关键代码位置

```text
支付下单/退款：
  rust/crates/services/src/payment/pay.rs

支付回调：
  rust/crates/api/public/src/routes/payment/paylog.rs

支付配置/渠道：
  rust/crates/services/src/payment/channels.rs

退款审核：
  rust/crates/services/src/payment/refund_apply.rs

商户开店：
  rust/crates/services/src/merchant/merchant_apply.rs

商户进件：
  rust/crates/services/src/payment/merchant_application.rs

微信直播：
  rust/crates/services/src/content/wechat_live_sync_callback.rs

图搜：
  rust/crates/api/public/src/routes/catalog/image_search.rs
  rust/crates/api/admin/src/routes/system/image_search.rs

火山翻译：
  rust/crates/services/src/content/volcengine_translate.rs
  rust/crates/services/src/content/seo.rs

前端：
  rust/web/admin-semi
```

---

## 11. 常见坑

```text
1. 本地工作区 git HEAD 可能与 remote main 不一致；
   构建前确认 remote main 包含最新代码。

2. GitHub git push 经常被重置；
   可用 http.curloptResolve 指定 IP，或 GitHub REST API 直推。

3. GitHub Release 资产下载可能失败；
   用 GitHub API asset URL + Accept: application/octet-stream 下载。

4. 服务器不能 SSH；
   部署走宝塔文件上传 + crontab 一次性任务。

5. 宝塔任务必须写完成标记并在成功后删除，
   否则每分钟重复执行。

6. cargo test 并行编译可能 OOM；
   使用 -j 1。

7. admin 登录：
   POST /adminapi/login/signin
   {"username":"admin","password":"admin123"}

8. 生产 /admin/ 仍是旧 Vue；
   /admin-semi/ 不是新 React 产物。
```

---

## 12. 下一阶段建议

按优先级：

```text
1. 开启阿里云图搜，构建生产图库，验证前台以图搜图
2. 开启支付宝，做 1 笔小额支付 + 退款
3. 商户入驻 -> 审核 -> 开店 -> 后台登录
4. 预售定金、充值各跑一笔
5. 配置真实短信/邮件
6. 发布 admin-semi 并做生产浏览器冒烟
7. 再验证微信/PayPal/Stripe/Xendit/Antom
8. 最后补 JWT Redis 黑名单、退款并发、库存并发
```

---

## 13. 交付物

```text
build-135 部署记录：
  docs/rust-v5.8.61-deploy-build135.md

build-132 部署记录：
  docs/rust-v5.8.61-deploy-build132.md

主流程文档：
  docs/rust-v5.8.61-b8-main-flow.md

缺口登记：
  docs/rust-v5.8.61-full-gap-register.md
```

---

## 20. 2026-11-01 最新进展（build-143）

> 本节覆盖前面 build-135 的旧结论，以本节为准。

### 生产版本

```text
Rust：build-143
sha256：9b5d753df1add611cf382622c4552c43550556cd91acca00f2b630888ff8bf8f
备份：/www/backup/tigshop.preB143.bak
PC：pc-semi 最新构建已发布
```

### 已验证完成

```text
图搜：已启用，阿里云实例连通
图搜：全量图库构建 64 商品，62 入库
图搜：真实图片上传返回相似商品
图搜：PC /search/image 页面真实浏览器通过
支付宝：useAlipay=1
支付宝：裸 Base64 / PKCS#1 / PKCS#8 私钥兼容
支付宝：真实订单创建支付单成功
支付宝：支付宝网关接受 RSA2 签名，返回收银台
PC：支付页显示支付宝，点击拉起 openapi.alipay.com
订单：真实会员下单成功（测试订单 40）
会员：注册空 username 唯一键问题修复
会员：真实注册/登录/会员页浏览器回归通过
PC：购物车 -> 结算 -> 确认订单浏览器回归通过
PC：公开页 13 页、登录态会员页 8 页浏览器回归通过
PC：图搜页、站内消息、留言反馈已上线
PC：全站运行时 i18n 翻译层
```

### 外部配置阻塞

```text
Google OAuth：
  redirect_uri_mismatch
  Google Console 未登记 https://battery.recy.cc/oauth/callback

Facebook OAuth：
  client_id=32132 是占位值
  返回 PLATFORM__INVALID_APP_ID
```

说明 OAuth 前后端跳转链路正常，阻塞在第三方控制台配置。

### 仍未验证

```text
支付宝真实付款/回调/退款（需实际付款或沙箱）
微信支付 / PayPal / Stripe / Xendit / Antom 真实渠道
动态分类/商品/装修内容多语言
PC 装修模块逐项视觉 parity
admin-semi 生产部署
```

### 关键新增提交

```text
1469d3f4 fix(pc): translate nav labels with suffix symbols
bbb66f50 fix(pc): render string payment method list
9b5d753  fix(payment): support PKCS1 alipay keys
fix(image-search): remove duplicate RegionId
fix(member): set username on mobile registration
```
