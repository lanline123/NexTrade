# PC Semi（Next.js + React + Semi）

PC 商城新前端。只迁移新版装修模块（`pcHome` kebab-case），旧版 `pcBanner` / `pcCatProductNormal` 等不再进入新渲染器。

## 技术栈

```text
Next.js App Router
React 18
TypeScript
Semi Design
SCSS
```

## 启动

```bash
cd rust/web/pc-semi
npm install
npm run dev
```

默认端口：

```text
http://127.0.0.1:3004
```

后端默认代理到：

```text
https://battery.recy.cc
```

可用环境变量覆盖：

```bash
PC_API_BASE=https://battery.recy.cc npm run dev
```

## 当前范围

线上：

```text
https://battery.recy.cc/      新版 PC
https://battery.recy.cc/pc/   旧版 PC（保留回滚）
```

已完成：

```text
Next.js App Router + SSR
18 个 pcHome 装修模块注册与渲染
首页 / 商品详情 / 搜索 + 排序 + 价格筛选
购物车 / 结算 / 支付页
订单列表 / 订单详情 / 订单取消
会员中心 / 地址 / 优惠券 / 收藏 / 积分 / 余额 / 售后
登录 / 领券中心 / 帮助 / 注册入口
移动端基础适配
```

待补齐：

```text
支付渠道 SDK（后端支付创建未迁移）
文章内容页
短信注册完整流程
IM / OAuth / 多语言 / sitemap
装修模块极细节样式 parity
```

---

## 第二轮修复（2026-11-07）

对照旧版 `java-b2b2c-overseas-v5.8.61/view/pc`（v5.8.61 跨境版）补齐 P0 断链。
commit：`b6190740`（批次 1-3）、`0f48e5fc`（静态审查修正）。

### 已修

```text
首页旧链 16 个模块全部不渲染（被静态 LegacyHome 顶替）    → 接回 DecorateRenderer
店铺装修 16 个模块全部降级（modules.tsx 组件全闲置）       → 接回统一渲染器
pcBanner2 错指 GroupBanner（旧版实为 slideNum 多图轮播）  → 改指 Banner2
店铺卡片 7 种版式退化为同一网格                           → 按 module.style 分发
卡片可配置字段被读取但未落到渲染层                        → 7 个字段全部生效
旧链首页 .home-warp 两列并排布局丢失                       → 恢复 flex 换行容器
切规格不刷新价格库存（用静态 skuPrice）                   → getProductAvailability 实时优先
B2B 批量采购模式缺失                                     → Tab + 逐 SKU 数量 + getProductAmount
带价附加属性（attr_type=2）丢失                           → 渲染 + 选中提交
搜索「全部筛选」浮层面板缺失                             → SearchAllFilterPanel
滑块行为验证码缺失（verifyToken 恒空）                    → 手写 AES-128-ECB + VerifySlide
社交登录三入口缺失（后端与回调页本就绪）                   → oauth/useOauthLogin
预售步骤条缺失（仅一行文字说明）                          → PresaleSteps（定金三段/全款两段）
会员中心 9 个弹窗缺失                                     → 取消原因/物流/地址/拼团/评论/券/删除/筛选/认领
购物车 limit_number 缺失（限购不生效，后端）              → 已补
购物车 activityInfo 恒空（活动标签不显示，后端）           → 已补，含店铺维度过滤
```

### 店铺卡片版式映射（写代码直接查）

```text
module.style = 1 / 2 / 3 → OneRowProductX（竖排）         → ShopProductCard variant=standard
module.style = 4        → OneBig2Small（一大两小，3 个一组）→ chunk(products,3)
module.style = 5        → OneRowProductX direction="land"   → ShopProductCard variant=land
module.style = 6        → OneRowProductX direction="slide"  → ShopProductCard variant=slide
module.style = 7        → OneRow3Carousel（每屏 3 个轮播）    → chunk(products,3) + carousel-page
```

### 审计误判（核实后确认不改，不是缺口）

```text
CheckTotalVO.giftCardAmount 恒 0      → Java OrderCheckServiceImpl:2109 同样 setGiftCardAmount(ZERO)（仅礼品卡支付场景 :2166 覆盖）
购物车 gift 恒空                     → Java CartServiceImpl:945 同样 new ArrayList<>()
购物车优惠字段全 0                   → ⚠️ 误判已推翻：Java :986-993 只是初始化 0，:999-1020 会按 usedPromotion 真实累加 → Rust 侧是 P0 缺失（见下表）
装修 token 差 165 条                  → Vue SFC 中文注释噪音，164 条疑似文案全部有等价实现
```

### 未完成（按优先级接手）

| 优先级 | 项 | 落点 / 说明 |
|---|---|---|
| P0 | 购物车 `extraAttrIds` 后端未接收 | `crates/api/public/src/lib.rs:359 CartAddDTO` 加 `extra_attr_ids`；前端已传但被 serde 丢弃。参考代购链路 `crates/core/src/models/trade/proxy_shopping_product.rs:52`（已实现） |
| P0 | 优惠引擎未完整迁移 | 秒杀/限时折扣已有 `resolve_prices`；**优惠券/拼团/满减/赠品 4 类缺价格计算**。Rust 侧 `discounts`/`discount_coupon_amount` 恒 0、`used_promotions` 恒空；Java `CartServiceImpl:999-1020` 会按 usedPromotion 真实累加 → **用户勾选优惠后看不到任何优惠、订单按原价走**。独立工程，先出设计文档 |
| P1 | 店铺装修仍缺 30+ 字段 | `src/decorate/components/contract.ts` 适配器补透传 → `modules.tsx` 消费。仍缺：`color2`/`logo`/`enTitle`/`shortTitle`/`childCategoryIds`（分类系）、`goodsNameRow`/`groupType`（秒杀拼团系） |
| P1 | `pcCustomAd1` 三列版式未还原 | 旧版 `components/home/CustomAd1.vue`（`每日推荐` 第 25 行 / `热销精品` 第 65 行 / `GO >>` 第 115、120 行）→ 新版 `ContractCustomAd` 仍是三组图平铺 |
| P1 | 头部装修预览态缺失 | 旧版 `pcHeaderRuntime` 4 组件 + `decorateRuntime` store 的 previewId 缓存/并发去重；新版只有 `PcHeader` 单一组件 + 逐页 `getPcHeader()` |
| P2 | 首屏未做懒加载 | 旧版 `critical-module-count=4`（前 4 个同步、其余懒加载）；新版全部同步 import，`src/decorate/components/modules.tsx` 单文件 164K |

### 验证口径（本轮明确不跑完整 next build）

```text
npx tsc --noEmit                          → 0 错误
cargo check -p tigshop-services           → 0 错误
npx sass <单文件>（5 个改动 SCSS）         → 全部编译通过
openssl enc -aes-128-ecb 交叉验证 AES     → 3 例密文完全一致
node scripts/audit-pc-coverage.mjs        → 通过
node scripts/audit-i18n-coverage.mjs      → 通过
node scripts/check-links.mjs              → 通过
```

**未验证项（必须人工过一遍）**：起 `npm run dev`（:3004）后目视核对
① 首页旧链模块渲染与两列布局；② 店铺装修 7 种卡片版式；③ 滑块验证码拖拽手感；
④ 搜索筛选浮层点选后 URL 与结果；⑤ 商品详情切规格价格刷新；⑥ 预售步骤条三段文案。

> 教训：tsc 通过 ≠ 运行时正确。本轮 verifyToken 的 React 批处理问题、
> attr 参数 `名称::值1|值2` 格式问题，都是 tsc 查不出来的。
> 不要在没跑 dev server 的情况下继续堆改动。

详细底稿：`docs/PC-HANDOVER-2026-11-07.md`（本地）、
`docs/PC-PARITY-GAP-2026-11-07.md`（差距报告）、
`scratch/audit-*.md`（5 个域的审计底稿）。

---

## 装修契约

首页数据来自：

```text
GET /api/home/home/pcIndex
GET /api/home/home/pcIndex?previewId=<id>
```

字段：

```text
pageModule
moduleList[].type
moduleList[].url
moduleList[].moduleIndex
moduleList[].isShow
moduleList[].module
```

注册表：

```text
src/decorate/components/modules.tsx
PC_MODULE_REGISTRY
```

新增模块步骤：

```text
1. src/decorate/components/modules.tsx 增加组件
2. PC_MODULE_REGISTRY 注册 type
3. 用真实装修数据验证
4. 补响应式样式
```

## 只保留新编辑器

新模块 type 为 kebab-case，例如：

```text
pc-home-hero
pc-image-ad
pc-product
pc-home-coupon
pc-home-seckill
pc-category-nav
```

旧模块 camelCase 不再实现：

```text
pcBanner
pcCatProductNormal
pcSeckill
...
```

如果历史页面仍是旧版，由 Admin 重新发布为新版后才会进入本渲染器。

## 目录

```text
app/
  layout.tsx
  page.tsx
  globals.scss
src/
  components/PcHeader.tsx
  decorate/
    types.ts
    components/common.tsx
    components/modules.tsx
  lib/api.ts
```

## 部署

线上已部署到 `https://battery.recy.cc/`，旧 PC 保留 `/pc/`。详见 [DEPLOY.md](./DEPLOY.md)。
