# PC / Admin 迁移状态（2026-11）

基准：

- PC 旧版：`java-b2b2c-overseas-v5.8.61/view/pc`
- PC 新版：`rust/web/pc-semi`（Next.js 14 + React 18 + Semi）
- Admin 旧版：`java-b2b2c-overseas-v5.8.61/view/admin`
- Admin 新版：`rust/web/admin-semi`（React + Semi + Vite）

## 一、PC 前台

### 已完成

```text
pcHome 装修模块：20/20 已注册
业务路由：静态页面 117 个
路由审计：business missing 0；13 个 activity 内部组件路径不计入业务缺页，由 /activity/[...slug] 兜底
路由兼容：order 支付渠道、member 登录/注册、pin、旧内部路由均已映射
i18next：全量接入，中文原文作 key
语言包：zh_cn 230 条，en_us 1692 条
静态文案覆盖率：97.8%（剩余 21 条为动态插值模板，已由正则兜底）
动态格式：错误码/评分/拼团人数/订单号/图片序号等已支持
语言切换：无需刷新，同步 html lang 和 document.title
SEO：metadataBase/OG/Twitter、Organization/WebSite/Product/Store/Article/Breadcrumb JSON-LD
私密页：member/order/cart/login/register/install 已 noindex
登录守卫：chat/cart/order/check/order/pay/join/intro/joining/groupByInvited/member/**
IconPark：header 搜索/账户/购物车/移动端菜单/关闭图标
站点图标：app/icon.png、apple-icon.png、manifest.webmanifest
响应式：390px 无横向溢出，移动端导航抽屉
```

### 验证命令

```bash
cd rust/web/pc-semi
npm run typecheck
npm run build
npm run audit:pc
npm run audit:i18n
npm run audit:links
```

最近结果：

```text
typecheck：通过
build：通过
静态路由 SSR：91/91 通过（早期批次）
路由巡检：109 个，异常均为预期 307 重定向或无效测试 ID
最新路由审计：117 个新路由，business missing 0；13 个 activity 内部组件路径由 catch-all 承载
i18n 静态覆盖率：97.8%
站内链接：12 个入口页、88 条内部链接、0 死链
运行时：20 个关键页面、0 pageerror
```

### 未完成

```text
装修模块与旧版极细节样式尚未逐像素对齐
SSR 阶段仍以中文输出，语言切换发生在客户端
存量页面仍依赖 I18nTranslator DOM 兼容层，未全部改为 useTranslation()
IM 已接 WebSocket，但图片/商品/订单卡片、已读回执、在线状态未完成
activity 旧版内部组件没有独立路由渲染
真实登录态全链路 E2E 未覆盖
```

## 二、Admin 后台

### 已完成

```text
PageSpec：210/210 通过
npm run build：通过
verify:config：通过
verify:ui：通过
verify:pages：275 个 knownPages，0 pageerror / 0 空白页
i18n：100%
页面级静态审计：175 个可对照页面中 10 个动态 config-* 存在标签差异
```

### 验证命令

```bash
cd rust/web/admin-semi
npm run build
npm run verify:config
npm run verify:ui
npm run verify:pages
```

静态审计：

```bash
cd ../..
node tools/audit-page-spec.mjs rust/web/admin-semi/src/pages/specs/<spec>.json
node tools/audit-admin-page.mjs <旧页面路径> rust/web/admin-semi/src/pages/<新页面>.tsx
```

### 动态 config-* 说明

`config-basic/global/kefu/login/map/notice/order/personalized/product/shopping` 由 `AutoConfigPage` 按后端字段动态渲染。

静态审计的“缺失标签”不少是条件字段，例如：

```text
config-global 的 CDN域名 / 存储区域
切换存储类型为七牛云 KODO 后才出现
```

已实测确认属于条件渲染，不是前端缺失。

### 未完成

```text
动态 config-* 页面仍有部分字段需要逐项切换条件核对
MCP 密钥 / MCP 连接配置 / 会员默认头像 / 客服系统域名
  是否真实缺失尚未确认
后端缺失能力对应的页面无法仅靠前端补齐
```

## 三、结论

```text
PC：路由、i18n 框架、SEO、响应式基本收口；
    尚未达到“样式/装修完全一致”。

Admin：页面、PageSpec、真实登录基础回归较完整；
       动态配置页仍需条件字段核对。

整体目标：未完成，不能标记完成。
```
