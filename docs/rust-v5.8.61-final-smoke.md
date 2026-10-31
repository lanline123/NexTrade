# Rust v5.8.61 统一部署冒烟认证

生成时间：2026-11-01  
生产域名：https://battery.recy.cc

## 部署版本

```text
Rust 后端：build-145
PC 前端：pc-semi v19
数据库：tigshopmall
```

## 健康检查

```text
GET /api/health               200
GET /adminapi/health          200
systemctl is-active tigshop   active
PC systemctl is-active pc-semi active
```

## 浏览器回归（Playwright Chromium）

公开页 15 个：

```text
/                         200
/product/1521             200
/search                   200
/search/image             200
/cart                     200
/order/check              200
/order/pay                200
/login                    200
/register                 200
/article                  200
/help                     200
/coupon/list              200
/member                   200
/sitemap.xml              200
/robots.txt               200
```

会员页 6 个（真实会员 token）：

```text
/member                   200
/member/order/list        200
/member/address           200
/member/userMessage/list  200
/member/feedback/list     200
/member/profile           200
无登录重定向
无 pageerror
```

## 功能冒烟

```text
图搜：上传商品图 -> 返回 VoltBot-E1，接口 200
IM：客服窗口显示历史消息，HTML 标签已清理
支付：/order/pay?id=40 显示支付宝，点击拉起 openapi.alipay.com
支付宝：/api/order/pay/create 返回已签名 HTML 表单
图库：64 商品，62 入库
```

## 已知未完成

```text
Google OAuth：控制台未登记回调地址（redirect_uri_mismatch）
Facebook OAuth：client_id=32132 为占位值（PLATFORM__INVALID_APP_ID）
支付宝：真实付款/异步回调/退款未执行
动态分类/商品/装修内容多语言未完成
PC 装修模块逐项视觉 parity 未逐条核对
```

## 结论

```text
当前 Rust 后端 + PC 前端已统一部署
公开页/会员页/图搜/IM/支付页冒烟通过
剩余主要是外部渠道配置、真实付款和内容级 parity
```

---

## 多语言回归（2026-11-01）

8 个语种首页真实浏览器检查：

| locale | HTTP | html lang | JS 错误 | 购物车文案 |
| --- | --- | --- | --- | --- |
| zh | 200 | zh-CN | 0 | 已翻译/默认 |
| en | 200 | en | 0 | My Cart |
| ko | 200 | ko | 0 | 장바구니 |
| ja | 200 | ja | 0 | カート |
| zh-Hant | 200 | zh-Hant | 0 | 購物車 |
| es | 200 | es | 0 | Carrito |
| fr | 200 | fr | 0 | panier |
| ru | 200 | ru | 0 | Корзина |

翻译数据来源：

```text
translations_data
en / ko / ja / zh-Hant / es / fr / ru
```

种子文件：

```text
docs/i18n-home-en-seed.sql
docs/i18n-home-multilang-seed.sql
docs/i18n-home-esfrru-seed.sql
```

## 装修模块回归

```text
/preview/decorate 共 25 个模块
9 个自制 kebab 模块
16 个 Java 契约模块
pageerror = 0
Fallback = 0
```

修复：

```text
图片广告 3:1 高度约束
分组轮播 3:1 高度约束
页面高度 3340 -> 1917
```

## 当前部署

```text
Rust：build-145
PC：v19
```


## 最终统一构建

```text
build-145
sha256：f45c566da9ae195d947ed053cda7873b4902985cdde81036f0da293f06af134c
备份：/www/backup/tigshop.preB145.bak
HTTP=200 ACTIVE=active
```
