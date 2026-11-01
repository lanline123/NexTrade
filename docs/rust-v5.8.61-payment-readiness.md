# 支付渠道就绪矩阵（build-146）

生成时间：2026-11-01  
生产：https://battery.recy.cc

## 摘要

```text
支付宝：已配置，支付单创建 + 网关验签通过
微信支付：未启用，密钥为占位值
PayPal：未启用，Client ID 为占位值
Stripe / Xendit / Antom：未启用，无配置
```

## 支付宝

配置：

```text
useAlipay=1
alipayAppid=2021004141601193
alipayRsaPrivateKey=SET(1588)
alipayRsaPublicKey=SET(392)
```

已验证：

```text
订单 40 创建支付单
GET /api/order/pay/create?id=40&type=alipay&code=pc
返回已签名 HTML 表单
支付宝网关 HTTP 200，返回收银台
PC 支付页显示支付宝并拉起 openapi.alipay.com
```

未验证：

```text
真实付款
异步 notify 回调
退款
```

原因：需要真实付款或沙箱买家账号。

## 微信支付

配置：

```text
useWechat=0
wechatPayMchid=1674450804
wechatPayAppId=YouKey        ← 占位
wechatPaySerialNo=258ACC...
wechatPayPrivateKey=SET(1)    ← 不是有效 PEM
wechatPayPublicKey=SET(1)     ← 不是有效 PEM
wechatPayPublicKeyId=EMPTY
wechatPayKey=SET(6)           ← APIv3 密钥应 32 字节
```

结论：不可用，需要真实商户号、AppID、证书、APIv3 密钥。

## PayPal

配置：

```text
usePaypal=0
paypalClientId=YouKey-o9SzYCRIo   ← 占位
paypalClientSecret=SET(69)
```

结论：不可用，需要真实 PayPal REST App Client ID / Secret。

## Stripe / Xendit / Antom

```text
useStripe=0
useXendit=0
useAntom=0
```

当前无可用生产配置，渠道适配器已实现但未启用。

## 启用步骤

1. 在 `config` 表写入真实渠道配置。
2. 把对应 `useXxx` 置为 1。
3. 重启 tigshop 或等待配置缓存刷新。
4. 创建测试订单，调用：

```text
GET /api/order/pay/create?id=<orderId>&type=<channel>&code=pc
```

5. 用真实/沙箱账号完成付款。
6. 验证异步 notify 和订单状态。
7. 发起退款并验证 paylog_refund。

## 配置表注意

`config` 表存在历史 `is_del=1` 的重复行（例如 useWechat 两行）。

运行时仓储已过滤：

```sql
WHERE (is_del IS NULL OR is_del = 0)
```

因此不会误读历史值。清理旧行不是必须操作。
