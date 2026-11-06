# uniapp → Taro4 + React 重构评估报告

> 生成时间：2026-11-05 · 评估范围：源码事实核查（非文档转述）
>
> 源：`java-b2b2c-overseas-v5.8.61/view/uniapp`（uni-app 3 / Vue 3.4 / Pinia / uview-plus）
> 目标：`rust/web/uniapp-react`（Taro 4.3.2 / React 18.3 / Zustand 5 / NutUI-React 3.0.20 / i18next）

---

## 一、结论摘要

**整体完成度约 88%（按有效源行数/文件数双口径一致）。基础层与主干交易链路已贯通，剩余任务集中在 IM、店铺、文章、活动、以图搜图与一批公共 tig 组件。**

| 指标 | 数值 |
|---|---|
| 有效源 `.vue` 文件（剔除废弃快照） | 413 |
| 已迁移 | **364（88.1%）** |
| 未迁移 | 49（11.9%） |
| 有效源逻辑行数 | 130,275 |
| 已迁移源行数 | **114,721（88.1%）** |
| 已注册路由 | 108 / 源声明 120（**90%**） |
| `tsc --noEmit` | ❌ **1 个错误**（`utils/websocket.ts:104`） |
| `build:weapp` | ✅ 通过（exit 0） |
| `build:h5` | ✅ 通过（exit 0） |

### 必须先处理的三件事

1. **`pages/productV1/*` 是误迁移的废弃快照**——源项目 `migrations/r1-product-fusion/README.md` 明确写着「`productV1` 是 `product` 的纯快照备份，`pages.json` 与所有跳转均未改动，**不注册路由**」。当前目标端把 4 个 `productV1` 页面注册进了 `app.config.ts`，且**全站无任何代码跳转过去**——属于死路由，同时让包体中多出约 2,200 行冗余代码。
2. **`pages/buyerShow/*` 4 个页面已写完但漏注册**——`app.config.ts` 里完全没有 `buyerShow` 条目，而 `store/tabbar.ts:156`、`utils/format.ts:204`、`pages/search/index.tsx:94` 等 7 处活跃引用会跳 `pages/buyerShow/index`。这是当前**唯一一类「代码已就绪却 100% 不可达」**的缺陷。
3. **23 个非白名单页面缺少登录守卫**——含结算/支付/优惠券/拼团等敏感链路，详见第五节风险 R3。

---

## 二、技术架构对比

### 2.1 总体形态

| 维度 | 源（uniapp） | 目标（uniapp-react） | 评价 |
|---|---|---|---|
| 框架 | uni-app 3（`@dcloudio/*` 4070620250821001） | Taro 4.3.2 + React 18.3.1 | 跨端能力从「全端」收窄到 weapp + h5 |
| 语言 | Vue 3.4 SFC（`<script setup>`） | TSX + TypeScript 5.4 | 类型化更彻底 |
| 构建 | Vite 5.2.8 + `@dcloudio/vite-plugin-uni` | webpack5 + `@tarojs/webpack5-runner` | 构建器换代，产物结构不同 |
| 目标平台 | H5 / 微信 / 支付宝 / 百度 / 抖音 / 京东 / 快手 / 飞书 / QQ / 小红书 / App(5+) / 鸿蒙 | **weapp + h5**（App/RN 与鸿蒙后置） | **能力面收缩**，见 §2.6 |
| 状态管理 | Pinia 2.2.0（setup store） | Zustand 5（`create` + `getState()`） | 心智模型接近，迁移成本低 |
| 组件库 | uview-plus 3.6.4 + uni-ui | NutUI-React 3.0.20（仅 5 个组件实际使用） | **大幅降依赖**，多数 UI 自绘 |
| 国际化 | vue-i18n 9.14.5 + 构建期 `preprocessMessages` | i18next 26 + react-i18next 17 | 见 §2.5 |
| 样式 | SFC `<style scoped lang="scss">` 内联 | 同名 `.tsx` + 独立 `.scss`（`import "./index.scss"`） | 样式外置，无 CSS Modules |
| 路由 | `pages.json` 单一清单 + 25 个分包 | `app.config.ts` + 每页 `index.config.ts`，**无分包** | **主包体积风险**，见 §2.4 |
| 权限 | `uni.addInterceptor` 全局路由拦截器 | 页面级 `usePageGuards()` hook | **语义降级**，见 §2.3 |
| 环境变量 | `import.meta.env.VITE_*` | `process.env.TARO_APP_*` | 已全量替换，0 残留 |

### 2.2 请求层（几乎 1:1 平移，质量高）

源 `utils/request.ts` 与目标 `utils/request.ts` 逐行对照，差异仅 3 处且都是必要适配：

| 变更点 | 源 | 目标 | 说明 |
|---|---|---|---|
| API 调用 | `uni.request` | `Taro.request` | 类型收窄 `as unknown as Taro.RequestTask<any>` |
| 前缀取值 | `import.meta.env.VITE_API_PREFIX` | `process.env.TARO_APP_API_PREFIX \|\| "/api/"` | 多了兜底 |
| 其余 | 加密 `Secret` 头、401 处理、`activeRequests` 取消表、`setIsInit` 重入保护 | **完全一致** | — |

请求运行时被抽成可注入的 `configureRequestRuntime({ getClientType, getLocaleCode, handleLogin, initialize })`，在 `app.ts` 的 `useLaunch` 中装配——这是比源端（模块内直接 `import pinia`）更干净的解耦，属于**架构改进**。

### 2.3 路由与权限（**架构语义发生变化，风险最高**）

这是两边差异最大、也最需要你注意的地方。

**源端**：`utils/permission.ts` 用 `uni.addInterceptor` 拦截全部 4 个路由 API（`navigateTo` / `redirectTo` / `reLaunch` / `switchTab`），**任何跳转入口都无法绕过**。

**目标端**：Taro（含 H5）的 `addInterceptor` 只作用于 `Taro.request`，**不拦截路由 API**。因此改为页面级守卫 `usePageGuards()`（`utils/pageMixin.ts`），要求每个页面自己调用。

审计结果：

```
已注册路由        : 108
白名单路由        : 16
应受登录保护      : 92
  其中已挂守卫    : 69  ✅
  ❌ 未挂守卫     : 23
```

未挂守卫的 23 个页面：

```
pages/order/check              pages/groupon/list
pages/cartJump/index           pages/groupon/mylist
pages/order/pay                pages/lottery/index
pages/order/cashier            pages/giftCard/exchange
pages/order/payStatus          pages/giftCard/transfer
pages/coupon/index             pages/giftCard/order/info
pages/coupon/detail            pages/giftCard/order/payStatus
pages/coupon/search            pages/salesman/withdrawHelp
pages/seckill/list             pages/productV1/{index,comment,consult,groupBuying}
pages/exchange/list            pages/404/index
```

这些页面经核查**既不调用 `usePageGuards()`，也不含任何 `hasPermission` / `token` 判定**。也就是说：结算、支付、收银台、优惠券、拼团、礼品卡等链路，在 Taro 版本下**入口层不再有登录门禁**（后端 401 仍会兜底拦数据，但用户体验与源端不一致：源端是「跳转即拦截并跳登录页」，目标端是「先渲染空页面再被 401 弹走」）。

> 注意：白名单判定里 `pages/productV1/*` 本就不该存在（见 §4.1），删掉后缺口收敛为 19 个。

### 2.4 包体与分包（**新增的结构性风险**）

源 `pages.json` 划分了 **25 个分包**（`pages/user` 13,346 行、`pages/salesman` 5,605 行、`pages/product` 3,755 行等）。目标 `app.config.ts` **完全没有 `subPackages`**，所有页面进主包。

实测 `build:weapp` 产物：

```
主包总计        3.13 MB      ← 微信小程序主包硬上限 2 MB
├─ pages/       1,710.7 KB
├─ common.js      661.6 KB
├─ common.wxss    280.9 KB
├─ vendors.js     248.4 KB
├─ taro.js        133.1 KB
├─ base.wxml       72.8 KB
└─ 其余            ~60 KB
```

**当前产物已超微信主包上限约 1.1 MB。** 虽然 Taro 构建本身不报错（它不做平台限额校验），但真机预览/上传会被微信开发者工具拒绝。这是「全量迁移完成后再处理」不现实的——分包越晚拆成本越高，建议在剩余批次开始前先把 `subPackages` 骨架补上。

另：`build:weapp` 与 `build:h5` 共用 `dist/` 输出目录，两者会互相覆盖（我这次验证时先跑 h5 再跑 weapp，h5 产物已被覆盖）。建议在 `config/index.ts` 里按 `process.env.TARO_ENV` 分开 `outputRoot`。

### 2.5 i18n（方案合理，但**词条有漂移**）

源端因为「小程序/App 沙箱禁用 `eval`/`new Function`」，用 `locale/index.ts` 的 `preprocessMessages()` 在构建期把 `{0}` / `{name}` 占位符改写为 Message Function。

目标端 i18next 的插值是纯字符串替换，无此限制，因此删掉预处理是正确的。`utils/i18n.ts` 保留了 `formatI18nParams` 兜底与 `setTranslationFunction` 空实现（兼容旧调用点），思路干净。

**但词条文件不一致**：

| 文件 | 源 | 目标 | 差异 |
|---|---|---|---|
| `locale/zh.json` | 8,001 B | 8,121 B | **+120 B** |
| `locale/en.json` | 8,553 B | 8,671 B | **+118 B** |

两边都不是「原样复制」。且源端 `locale/index.ts` 导出了 `localMessages`（原始字典）供 `store/i18n.ts` 合并后台下发语言包，目标端也保留了这个导出——说明合并链路还在。建议 diff 一下这两个 json，确认新增词条是有意的（例如为新增组件补的文案），而不是抄错/漏抄。

### 2.6 平台能力收缩（需要产品侧确认）

源 `package.json` 声明了 14 个平台依赖（含 `app-plus`、`app-harmony`、`mp-alipay/baidu/jd/kuaishou/lark/qq/toutiao/xhs`、`quickapp-webview`）。目标只装 `@tarojs/plugin-platform-weapp` 和 `@tarojs/plugin-platform-h5`。

配套的源码级能力也随之缺位，代码里已用 `TODO(MIGRATION)` 标记：

| 能力 | 源实现 | 目标现状 |
|---|---|---|
| App 版本管理 | `plus.runtime` × 5 处（`store/appVersion.ts`） | `TODO`，RN 端待接原生模块 |
| App 权限申请 | `utils/appPermission.ts` | **未迁移** |
| App 更新检查 | `utils/checkAppUpdate.ts`（226 行） | **未迁移** |
| App 图片下载 | `plus.downloader/io/runtime` | `downloadAppArchive` 直接 reject |
| 打印/画布 | `uni.createCanvasContext` | 已换 `Taro.createCanvasContext`，但**组件实例作用域参数丢失**（多处 `TODO` 待真机复核） |
| 地图/定位 | `utils/location.ts`、`utils/mapProvider.ts`、`components/tig/tig-map` | **均未迁移** |
| 原生插件 | `uni_modules/image-search-camera`、`license-file-picker` | **未迁移** |
| H5 高德 | 注入 `__uniConfig` | 改写 `window._AMapSecurityConfig`，**未实测** |

如果这几个平台（尤其 App 端）仍在产品范围内，需要在排期里显式预留；如果已决定砍掉，建议在 `MIGRATION.md` §3 里写明，避免后续批次反复纠结。

### 2.7 状态管理（迁移质量好，一处缩水）

13 个 Pinia store → 11 个 Zustand store。逐文件行数对比显示**迁移不是简单压缩，而是重新组织了接口**（如 `config.ts` 446L → 468L 有增）。

唯一实质性缩水是 **`store/region.ts`：364 行 → 32 行（stub）**。旧文件含 O2O 门店定位、进店规则、`currentLocationInfo` 等完整逻辑，目标端只保留了 `urlFormat` 读取需要的 3 个字段。这直接导致下游一批 `TODO`（`pages/order/check.tsx`、`pages/search/result.tsx`、`pages/productV1/groupBuying.tsx` 等）——**O2O 门店链路目前是「能跑但定位/进店判断失效」状态**。

另外 `store/imageSearch.ts`（68 行）整个缺失，与 imageSearch 批次未开始一致。

### 2.8 样式架构

```
源：  455 个 .vue  →  内联 <style scoped lang="scss">  共 54,558 行
目标：380 个 .tsx  +  364 个同名 .scss                    共 47,707 行
```

已配对文件的样式行数比（目标 scss / 源 style）= **0.87**，逻辑行数比（目标 tsx / 源逻辑）= **0.94**。考虑到 React 的 JSX 通常比 Vue 模板更啰嗦，这两个比值都偏低，但**基本合理**——因为：
- `scoped` 被去掉，`:deep()` 被平铺，行数自然下降；
- 部分通用样式被上提到 `app.scss` / `static/css/`（`modules.css`、`modulesCommon.css`、`style.css` 与源端**逐字节一致**）。

反常项值得单独看（这些是**真实的功能缺失**，不是统计误差）：

| 文件 | 源 | 目标 | 比 | 说明 |
|---|---|---|---|---|
| `pages/index/index` | 1,822L | 188L | 0.10 | 首页大量逻辑上提到了 `customPage` 装修渲染器，需确认无遗漏 |
| `components/mainHeader` | 597L(逻辑316) | 292L | 0.92 / **scss 0** | 逻辑量对得上，但**样式完全没有**（0 行 scss） |
| `components/storeSearchCard` | 510L | 34L | **0.07** | 严重缩水，疑似占位 |
| `components/imageSearchEntry` | 67L | 13L | 0.19 | 已知 TODO stub |
| `pages/article/*` | 152L | 77L | 0.51 | 未迁移，仅剩骨架 |

### 2.9 组件库降级（大量自绘，需回归重点覆盖）

NutUI-React 全程只用到 **5 个组件**：`Divider, Picker, Popup, SearchBar, Swipe`（72 个文件引入）。

其余全部自绘或改用基础组件。源端 26 个 `components/tig/*` 里只迁了 17 个，**缺 9 个**：

```
tig-button        tig-checkbox      tig-fixed-placeholder   tig-map
tig-number-stepper tig-popup        tig-qrcode              tig-slide
tig-swiper
```

这 9 个缺失组件是 `TODO(MIGRATION)` 的主要来源——**全库 122 条明确 TODO，其中约 30 条是「旧 tig-button / tig-button2 无 React 版，以样式等价 View 重写」**。这类「样式等价重写」分散在 20+ 个页面里，是视觉/交互回归的高风险面，建议集中补齐 `tig-button` 后统一替换。

---

## 三、重构进度明细

### 3.1 已完结的链路

| 链路 | 状态 |
|---|---|
| 脚手架 / 构建 / 类型检查 | ✅（tsc 1 个错误待修） |
| `types`（59 文件 7,055 行） | ✅ 整目录零改动复制 |
| `api`（56 文件 4,830 行） | ✅ 整目录复制，仅 `search/imageSearch.ts` 改 `uni→Taro` |
| 基础 utils | ✅ 45/58，缺的 15 个多为 App 端专属 |
| stores | ✅ 11 个（`region` 为 stub） |
| i18n | ✅（词条有 ±120B 漂移） |
| 装修渲染器 B1 | ✅ **42/42 类全部注册**（`registry.ts` 52 条） |
| 商品链路 B2 | ✅ search + product 详情 + productCate + SKU 弹层 + masonry |
| 交易链路 B3 | ✅ cart → cartJump → check → pay → cashier → payStatus 全链贯通 |
| 会员 B4 | ✅ login/register/member/address/langSet/reset + 装修组件 |
| 用户中心 U1–U6 | ✅ 订单/售后/账户/发票/评价/安全/认证/入驻/等级/签到等 |
| 增值 B5 | ✅ coupon/seckill/groupon/lottery/giftCard + salesman S1/S2 |
| productV1 PV1 | ⚠️ 已迁移但**本不该迁移**（源端不注册路由） |

### 3.2 剩余 49 个文件 / 15,554 行（11.9%）

按工作量降序：

| 模块 | 文件 | 行数 | 内容 |
|---|---|---|---|
| `components/product` | 4 | 3,126 | `card` / `guide` / `poster` / `specificationV1`（后 2 者应评估是否随 productV1 一并砍掉） |
| `pages/im` | 3 | **2,527** | `index`(1,882) / `list`(251) / `page`(394) —— **最大单块**，websocket 基础件已就绪但未接线 |
| `pages/search` | 5 | 1,607 | `image.vue`(744) + `imageSearch/` 4 个子组件 |
| `components/tig` | 9 | 1,507 | 见 §2.9 缺口清单 |
| `pages/activity` | 1 | **1,344** | 活动页整页 |
| `pages/customPage` | 3 | 1,024 | `modules/index.vue`(362) / `shopInfo`(484) / `shopModules`(178) |
| `pages/shop` | 5 | 913 | 店铺 index/category/list/info/license 整模块 |
| `pages/article` | 4 | 880 | 帮助中心 issue/news 共 4 页 |
| `pages/user` | 2 | 610 | `cardManagement` list/edit |
| `components/upload` | 1 | 543 | `UploadMedia` |
| `pages/imageSearch` | 1 | 431 | `captureMp`（依赖原生插件） |
| 其余小件 | 15 | 1,040 | `verifition/VerifyPoints`(278)、`SplashAd`(132)、`navbarContent`(128)、`offlinePayment`(89)、`oauth/callback`(99)、`skeleton`(63) 等 |

### 3.3 断链统计

**29 个源路由未注册**，其中 **16 个已被目标代码活跃引用（共 48 处）**——即「有入口、无落地」：

| 路由 | 源行 | 引用数 | 影响 |
|---|---|---|---|
| `pages/product/groupBuying` | 1,066 | 7 | **拼团下单断链**——check/pay/cashier 支付成功后跳不进去 |
| `pages/buyerShow/index` | 367 | 7 | 买家秀入口全断（tabbar、format、search） |
| `pages/shop/index` | 122 | 6 | **店铺页全断**——商品详情的「进店」按钮、订单门店卡片 |
| `pages/product/comment` | 308 | 4 | 商品评价页（`pages/productV1/comment` 有实现但路由不对） |
| `pages/buyerShow/buyerShowDetail` | 804 | 3 | 买家秀详情 |
| `pages/order/offlinePayment` | 89 | 3 | 线下支付（pay 页与订单列表都会跳） |
| `pages/shop/list` | 36 | 3 | 店铺列表 |
| `pages/im/index`、`pages/im/page` | 2,276 | 4 | 客服/聊天入口 |
| `pages/search/image` | 744 | 2 | 以图搜图 |
| `pages/imageSearch/capture(Mp)` | 431 | 4 | 以图搜图拍照 |
| `pages/buyerShow/{addBuyerShow,videoFeed}` | 999 | 3 | 发布/视频流 |
| `pages/product/consult` | 407 | 1 | 商品咨询 |
| `pages/article/news/detail` | 210 | 1 | 帮助中心详情 |

另有 **13 个未迁移且当前无引用**（暂无断链，属纯功能缺失）：`activity/index`(1,344)、`shop/info`(413)、`cardManagement/{edit,list}`(610)、`im/list`(251)、`article/{news/list,issue/list,issue/detail}`(670)、`shop/{category,license}`(342)、`oauth/callback`(99)、`pages/404`(65)、`order/openPay`(13)。

> `pages/404`：目标有 `pages/404/index` 且已注册，但源码 `pages/404.vue` 未匹配——这两个是同一件事的两种组织方式，非缺陷。

**15 个「源即断链」**（源项目原本就没注册，属忠实平移，不是本次引入）：`pages/store/*`(8个)、`pages/category/index`、`pages/region/index`、`pages/user/{message,subCard,premiumMember}/index`、`pages/member/premiumMember/index`、`pages/order/confirm/index`、`pages/salesman/withdrawRecordList`。这些是源项目自身的 O2O/其他版本残留，可直接忽略。

---

## 四、发现的具体缺陷

### 4.1 【高】`productV1` 误迁移为活路由

**证据链**：
- 源 `migrations/r1-product-fusion/README.md:11`：「`src/pages/product` 已**复制**一份为 `src/pages/productV1`（纯快照，`pages.json` 与所有跳转均未改动，**`productV1` 不注册路由**）。原 `product` 保持可用。」
- 源 `pages.json` 全文搜索 `productV1` → **0 命中**。
- 源全库搜索 `productV1` → 仅 3 处，全在文档/注释里。

**目标端现状**：
- `app.config.ts:100-103` 注册了 4 个 `productV1` 路由；
- 全站搜索 `pages/productV1` 的非注释引用 → **0 处**（只有注释和 `app.config`）；
- 但 `pages/product/groupBuying`、`pages/product/comment`、`pages/product/consult` **未注册**，而 `pages/productV1/` 下有对应实现。

**结论**：这不是「多迁了一份」，而是**正牌路由和备份路由搞混了**——该注册的 `pages/product/{groupBuying,comment,consult}` 没注册，不该注册的 `pages/productV1/*` 注册了。虽然 `productV1` 源码确实是「product 的复制」，两者内容高度相似，跳过去不至于崩，但：
1. 增加约 2,200 行死代码进主包（§2.4 已超限 1.1 MB）；
2. 未来 `product` 继续演进时 `productV1` 会成为误导性副本。

**建议**：删除 `app.config.ts:100-103`，把 `productV1` 降级为 `product` 的内部实现（或直接删除，因源端 `productV1` 本就不产出任何东西），补注册 `pages/product/{groupBuying,comment,consult}`。

### 4.2 【高】`pages/buyerShow/*` 4 页已写完但未注册

`pages/buyerShow/` 下有 45 个文件，其中 4 个页面级 tsx（`index` 250L / `buyerShowDetail` 550L / `videoFeed` 478L / `addBuyerShow` 199L）**全部调用了 `usePageGuards()`**（说明是当页面写的），但 `app.config.ts` 里搜不到任何 `buyerShow` 条目。

而 `store/tabbar.ts:156`、`utils/format.ts:204`、`pages/search/index.tsx:94`、`utils/permission.ts:39-40` 共 7 处活跃引用指向 `pages/buyerShow/index` 等。

对比：`pages/buyerShow/comments.tsx`（231L）**没有** `usePageGuards`——它才是真正的子组件（被 `buyerShowDetail` 引用）。

**建议**：立即补注册这 4 条路由。这是投入产出比最高的一次修复。

### 4.3 【中】`tsc --noEmit` 有 1 个错误

```
src/utils/websocket.ts(104,9): error TS2740:
  Type 'Promise<SocketTask>' is missing the following properties
  from type 'SocketTask': send, close, onOpen, onClose, and 10 more.
```

原因：Taro 4 的 `Taro.connectSocket()` 返回类型是 `Promise<SocketTask>`，而源端 `uni.connectSocket()` 返回同步的 `SocketTask`。当前 `this.socket = Taro.connectSocket({...})` 直接把 Promise 赋给了 `SocketTask` 字段。

目前 `websocket.ts` **是孤立模块**（全库无 import），所以不影响构建产物，但 `MIGRATION.md` §6 的验收口径明确要求 `typecheck` 全绿——这一条现在是红的，会让自动化的「全绿」判据失效。

修法有两种：`.then()` 里赋值（异步，需调整 `connect()` 时序），或用 `Taro.connectSocket({...}).then(...)` 配合 `await`。建议在 IM 批次（B6-3）一并处理，但至少先加 `// @ts-expect-error` 或改类型断言让门禁转绿。

### 4.4 【中】微信主包超限 1.1 MB

见 §2.4。产物 3.13 MB vs 微信主包上限 2 MB。需要在 `app.config.ts` 补 `subPackages`（源端已有现成的 25 分包划分可直接照搬）。

### 4.5 【低】`components/mainHeader` 无样式文件

`components/mainHeader/index.tsx`（292L）迁移了完整逻辑（侧边菜单抽屉、胶囊安全区、高度实测写 configStore、`forwardRef` 暴露 `getContentRect`），但**没有 `index.scss`**，而源 `mainHeader/index.vue` 有 281 行样式。这会导致外贸风头部视觉完全走样。

### 4.6 【低】`locale/zh.json` 与 `en.json` 有未知漂移

见 §2.5。各 +120B / +118B，非原样复制，需确认是有意新增还是抄写错误。

---

## 五、风险清单与建议

| 编号 | 风险 | 严重度 | 建议动作 |
|---|---|---|---|
| R1 | `productV1` 死路由 + `pages/product/*` 三页未注册 | **高** | 立即修正 `app.config.ts` |
| R2 | `pages/buyerShow/*` 4 页未注册，7 处入口断链 | **高** | 立即补注册 |
| R3 | 23 个非白名单页面无登录守卫（含结算/支付/优惠券/拼团） | **高** | 补 `usePageGuards()`；或改造成 `TigLayout` 内建守卫（但需先确认所有页面都用 `TigLayout`） |
| R4 | 微信主包 3.13 MB 超 2 MB 上限 | **高** | 按源端 25 分包补 `subPackages`；同时拆 `dist` 输出目录 |
| R5 | 其余 13 条未迁移路由已有 48 处活跃引用（拼团/店铺/IM/评价/线下支付） | 中 | 优先做 `product/groupBuying`(7 引用)、`shop/*`(9 引用)、`im/*`(4 引用) |
| R6 | `store/region` 为 stub，O2O 门店定位/进店规则全失 | 中 | 若 O2O 在范围内，补 364 行原文 |
| R7 | 9 个 `tig-*` 公共组件缺失，导致 20+ 页面「样式等价重写」 | 中 | 先补 `tig-button`/`tig-button2`，统一替换 30+ 处 TODO |
| R8 | `tsc --noEmit` 1 错误，验收门禁失效 | 中 | 修 `websocket.ts` 或先降级为断言 |
| R9 | App 端 8 类能力（版本/权限/更新/下载/地图/原生插件…）缺位 | 中 | **需产品决策**：是否砍掉 App 端。若保留需单独立项 |
| R10 | `locale` 词条 ±120B 漂移 | 低 | diff 两个 json 确认 |
| R11 | `components/mainHeader` 无 scss | 低 | 补 281 行样式 |
| R12 | 122 条 `TODO(MIGRATION)` 分散各处 | 低 | 建议收敛成清单纳入追踪，避免遗忘 |

---

## 六、对下一步排期的建议

1. **先修 3 个「低成本高收益」缺陷**（半天内可完成）：补注册 `buyerShow` 4 路由、修正 `productV1`/`product` 路由混淆、修 `websocket.ts` 类型错误让 `tsc` 转绿。这三件事做完，「已迁移 88%」才真正等于「88% 可用」。
2. **在开启剩余批次前建立分包骨架**。源端 25 个分包的划分是现成的，越晚拆成本越高，且当前产物已不可上传。
3. **集中补齐 9 个 `tig-*` 组件**，尤其是 `tig-button`/`tig-button2`。这一步能一次性消解约 1/4 的 TODO，并让后续批次的「样式等价重写」返工归零。
4. **剩余批次按引用密度排序**：`im`(2,527 行，基础件已就绪) → `shop`(913 行，9 处引用) → `product/groupBuying`+`comment`+`consult`(1,781 行，12 处引用) → `activity`(1,344 行) → `article`(880 行) → `imageSearch`(1,607 行，需先确认原生插件替代方案)。
5. **明确 App 端与 O2O/region 的归属**。这两块目前是「悬空状态」——代码里一堆 TODO，但 `MIGRATION.md` 里没有明确的取舍结论。建议尽快定调，否则会持续污染后续批次的判断。

---

## 附录：本次核查方法

所有结论均来自源码事实核查，未采信文档自述：

- 逐文件比对 `mig-smartmap`：源 455 个 `.vue` → 目标 380 个 `.tsx`，按「路径 + 归一化名 + 目录尾段」三级匹配，匹配结果人工抽查确认；
- 排除干扰项：`.v1.vue` 备份 13 个（11,233 行）、`productV1` 快照 28 个（8,525 行）、`App.vue`（等价物为 `app.ts`+`app.scss`）；
- 路由覆盖：解析源 `pages.json`（去除条件编译注释）得 120 条声明，与目标 `app.config.ts` 的 108 条取差集；
- 断链审计：扫描目标全部 `.ts/.tsx` 中的 `/pages/...` 字面量，排除注释行与 `.includes()/.startsWith()` 等非跳转用途，再与源端已注册路由求差，区分「真回归」与「源即断链（忠实平移）」；
- 守卫审计：按 `permission.ts` 白名单与各页面 `usePageGuards()` 调用实况交叉判定；
- 构建验证：实际执行 `npm run build:weapp`、`npm run build:h5`、`npx tsc --noEmit`，测量产物体积。

核查脚本留存于 `scratch/`：`mig-smartmap.mjs`、`route-coverage.mjs`、`nav-diff.mjs`、`guard-audit.mjs`、`progress-final.mjs`、`final-summary.mjs`。
