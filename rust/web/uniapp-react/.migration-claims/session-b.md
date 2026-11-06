# 迁移认领声明（会话 B）

> 建立时间：2026-11-05 21:10
> 本文件用于避免并发迁移冲突。其他会话开始新批次前请先读这里。

## 本会话认领范围（独占，其他会话勿动）

| 批次 | 模块 | 源文件 | 目标文件 |
|---|---|---|---|
| B6-4a | shop | `view/uniapp/src/pages/shop/*.vue`（5 页 908 行） | `src/pages/shop/*.tsx` |
| B6-4b | article | `view/uniapp/src/pages/article/**`（5 页 1113 行） | `src/pages/article/**` |
| B6-4c | activity | `view/uniapp/src/pages/activity/index.vue`（1343 行） | `src/pages/activity/index.tsx` |
| 依赖补全 | 上述模块专用 | `components/shopListEmpty`、`hooks/useGroupShopList`、`pages/search/src/shopInfo.tsx`（当前为返回 null 的 stub） | 同名 |

## 明确避让（由另一会话处理，本会话不碰）

- `pages/im/**`（B6-3）
- `pages/imageSearch/**`（B6-3）
- `pages/oauth/**`（B6-3）
- `pages/buyerShow/**`（B6-2a）
- `src/utils/websocket.ts`（B6-3 刚改动）

## 共享文件写入约定

- `src/app.config.ts`：本会话仅在批次完成后**追加**路由行，且只追加 shop/article/activity 相关路径，不动其他行。
- `MIGRATION.md` §5：本会话只改写 `B6-4` 那一行，不触碰 B6-2 / B6-3 相关行。
- `.migration-lock`：沿用另一会话的锁，本会话不改写。

## 状态

- [x] B6-4a shop（5 页 + shopInfo 装修模块 + shopModules 分发器 + shopListEmpty + useGroupShopList + search/src/shopInfo 实现）
- [x] B6-4b article（news list/detail、issue list/detail + src/ProductItem）
- [x] B6-4c activity（1 页）
- [x] 路由注册（shop×5 + article×4 + activity×1）＋ `types/home/home.d.ts` 补 `bindDecorateId?`
- [x] tsc --noEmit 全绿（0 错误）
- [ ] build:weapp 绿（有 mini-css-extract-plugin Conflicting order 警告，非阻断）
- [ ] build:h5 验证中

## 完成时间

2026-11-05 21:35 左右全部写完并注册路由。

## 交接备注

1. `permission.ts` 白名单保持与旧项目一致（shop/category、shop/info、shop/license、activity 均不在白名单，需登录）—— 这是旧行为，未擅自放宽。
2. `pages/shop/*` 的跳转契约已与现有调用点核对：`/pages/shop/index?shopId=`、`/pages/shop/list`、`/pages/shop/category?shopId=`、`/pages/shop/info?shopId=` 全部对齐。
3. build 时的 CSS Conflicting order 警告涉及 `pages/member/index`、`pages/productV1/index`、`pages/product/groupBuying` 三个入口的 scss 导入顺序，属多入口共享 chunk 的既存问题，未在本批范围内修复。

---

## 第二轮（22:20-22:45）：B6-4d 装配 + B6-6a SplashAd

### 认领

- `src/components/SplashAd/`（新建，另一会话把 SplashAd 划到 B6-6 未做）
- `src/pages/index/index.tsx`（唯一 22:17 被对方改过注释，改动前后 mtime 稳定、TODO 仍在，判定无实质进行中）
- `src/pages/customPage/index.tsx`（03:01 起无人动）

### 避让

`pages/search/imageSearch/**`、`pages/search/image*`、`components/imageSearch*`、`pages/order/offlinePayment*`、`app.config.ts` —— 对方 21:57-22:08 正在改。

### 完成

- SplashAd：`index.tsx` 119 行 + `index.scss`，image/video 双素材、加载完才起倒计时、跳过、redirectType=1 跳转；`onLoadedMetadata` 在 Taro 里是 `onLoadedMetaData`
- index/index.tsx：185 → 300 行，接 SplashAd / Masonry / MainHeader + spacer / TigBackTop 等价 / useDidShow / useUnload / share 三件套
- customPage/index.tsx：130 → 159 行，接 Masonry / TigBackTop / useDidShow / share
- scss：index.scss 补 `.main-header-spacer`、双页删除 `.cate-goods-placeholder` 占位样式
- MIGRATION.md：补齐 B6-4d 实际内容，把 B6-6 拆成 B6-6a（SplashAd 已完成）/ B6-6b（region + App 端）

### 验证状态

- `tsc --noEmit`：0 错误 ✅
- `build:weapp`：**未能完成验证**。系统可用内存仅 0.4GB / 13.7GB，两个 `rustc` 进程占 3.1GB + Memory Compression 2.2GB，webpack 编译卡住 14 分钟无产物后手动终止。等 rustc 编译结束、可用内存回到 2GB 以上再补跑。

---

## 第三轮（22:44-23:00）：B6-6b-1 region 全量

### 完成

- `store/region.ts`：36 行 stub → 442 行全量（GPS/IP 双通道、进店规则三级优先级、推广 shopId 三处解析、最近门店预取、storage key 全保持）
- `utils/location.ts`：新建 116 行（gcoord WGS84→GCJ02、权限检查三端收敛、pinia 直改 state → `setState`）
- `utils/throttle.ts`：新建（原样搬，模块级共享 flag 的旧缺陷保留并注释）
- `utils/share.ts`：新建（仅 H5 分支，App 端 plus 分支待 App 形态决策）

### 保留的旧行为（需业务确认，未擅自改）

`applyLocatedRegion` 里的 `if (shouldApplyLocated && canApply)`：旧代码中 `setCurrent`（对应 `shouldApplyLocated`）默认 **false**，而全项目只有 `location.ts` 的 finally 里调用 `setCurrentFlag(false)`，**没有任何地方设为 true**。即 GPS/IP 定位结果实际只写入 `realTimeRegion` 展示，永不覆盖当前城市。这可能是产品有意（避免自动覆盖用户手选），也可能是遗留缺陷——按等价迁移保留，未改。

### 附带发现

`utils/location.ts` 的 `getCurrentRegionInfo` 在旧项目中**只有单元测试调用**，业务代码零入口。整条定位链路目前是"预留能力"，真正接通要等 `pages/store/**`（O2O 门店页，未迁移）。

### utils 缺口变化

7 → 5：`appPermission`(69，App 端) / `checkAppUpdate`(22，App 端) / `mapProvider`(18，随 tig-map) / `salesman`(32) / `upload`(79)。后两个当前无调用方，等对应页面批次一起做。
`mixin.ts` 由 `pageMixin.ts` 替代、`orderReason.d.ts` 由 `orderReason.ts` 替代，视为已解决。


