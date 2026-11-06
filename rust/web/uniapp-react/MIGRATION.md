# uniapp → Taro4+React 全量迁移追踪

> 更新：2026-11-05 · 源：`java-b2b2c-overseas-v5.8.61/view/uniapp`（uni-app 3 / Vue 3.4 / Pinia / uview-plus） · 目标：`rust/web/uniapp-react`（Taro 4.3.2 / React 18.3 / TS / Zustand 5 / NutUI-React 3.0.20 / i18next 26）
>
> 策略：并行新容器，旧 uniapp 原样保留直至切换。目标端 Phase 1 = 微信小程序 + H5；App（RN）/鸿蒙后置。

## 0. 状态总览

| 层 | 状态 | 说明 |
|---|---|---|
| 脚手架（Taro4+React+TS+webpack5） | ✅ 完成 | `build:weapp` / `build:h5` 全绿，`tsc --noEmit` 0 错误 |
| types（59 文件） | ✅ 完成 | 整目录复制，零改动 |
| api（56 文件 4774 行） | ✅ 完成 | 整目录复制；仅 `api/search/imageSearch.ts` 改 uni→Taro |
| 基础层 utils | ✅ 核心完成 | request/requestRuntime/requestBaseUrl/requestArguments/crypto/handleLogin/init/permission/format/seo/imageUrl/b2bPrice/shopGroup/amapSecurity/productRawImageDownload/index(789行)/i18n/pageMixin |
| stores（Zustand） | ✅ 完成 | config/user/theme/currency/tabbar/i18n/catnav/cart/appVersion + region stub |
| i18n | ✅ 完成 | i18next + zh/en 字典原样；`{0}/{name}` 占位符经 interpolation 前后缀配置原生支持 |
| App 骨架 | ✅ 完成 | 启动装配 + 6 页面（4 tab + login + webviewPage）+ CustomTabbar |
| NutUI 主题 | ✅ 默认主题 | `theme-default.scss` 挂载全套 `--nutui-*`；换肤时覆盖变量即可 |
| 装修渲染器（customPage 模块） | ✅ 完成 | 48/48 类全量注册 + 双首页装配（B1 ~ B6-4d） |
| 业务页面 | ✅ Phase 1 完成 | 旧 120 页中 weapp/H5 范围内 119 页已注册；`imageSearch/capture` 为 `#ifdef APP-PLUS` 专属页随 App 批次（见 §5 R2 结论） |
| websocket/IM | ✅ 完成 | im 3 页 + 5 组件，`utils/websocket.ts` 复用（B6-3） |
| TODO(MIGRATION) 存量 | ⬜ 清理中 | 2026-11-05 审计：131 处 = A外部阻塞17 / B可补齐72 / C守卫型15 / D待核对27，修复分批方案见 §5-R3 |
| App 端（RN）/鸿蒙 | ⬜ 待定 | 见 §3 已知差异 #5 与 §5-R3 A 类清单 |

## 1. 运行

```bash
cd rust/web/uniapp-react
npm install
npm run dev:h5          # H5 开发
npm run build:weapp     # 微信小程序产物（dist/，微信开发者工具导入）
npm run typecheck       # tsc --noEmit
```

## 2. 技术栈映射

| 旧 | 新 |
|---|---|
| pages.json | `src/app.config.ts` + 每页 `index.config.ts` |
| pinia（setup/option store） | zustand `create`（getState() 替代传 pinia 实例的调用） |
| uview-plus / uni-ui | NutUI-React 3.0.20（稳定版；latest tag 的 cpp-beta 不用） |
| vue-i18n + preprocessMessages | i18next（小程序禁 eval 问题不存在，预处理删除） |
| `import.meta.env.VITE_*` | `process.env.TARO_APP_*`（`.env`） |
| `uni.*` | `Taro.*`（API 面 1:1） |
| 全局 Vue mixin（路由同步） | `usePageGuards()` 页面 hook |

## 3. 关键迁移决策 / 已知差异

1. **路由守卫改为页面级**：Taro（含 H5）`addInterceptor` 只挂 `Taro.request`，不拦截路由 API；旧 `uni.addInterceptor('navigateTo')` 方案改为所有页面统一调用 `usePageGuards()`（路由同步 + 白名单 + 登录态校验），见 `utils/permission.ts`。
2. **redirect() 双跳转缺陷修复**：旧 `utils/index.ts` 非法外链分支缺 `return`，MP 端会先开 webview 页再走 switch 二次跳转；已补 `return`。
3. **i18n 框架同步层删除**：Taro 下 i18next 是唯一 locale 来源（无 uni.setLocale/Android 重启问题）；`syncFrameworkLocale` 等保留空实现兼容调用点。
4. **tabBar**：Phase 1 不声明原生 tabBar，4 个 tab 页各自渲染 `components/CustomTabbar.tsx`（消费后台导航装修 + `useTabbarDerived`）；weapp 真机验证后再决定是否切原生 custom-tab-bar。
5. **App 端**：`store/appVersion.ts` 依赖 5+ `plus.runtime`，Taro RN 端需接原生模块后重写；App 壳形态（RN / H5 壳）待定，阻塞 App 端批次。
6. **高德 H5**：旧方案注入 uni-h5 `__uniConfig`；Taro 无此配置点，`applyAmapH5Config` 改写 `window._AMapSecurityConfig`，地图装修模块迁移时实测。
7. **store/region.ts 为 stub**：仅保留 urlFormat 读取的 3 个字段；O2O 定位/进店规则全量迁移时补全（旧 405 行）。
8. **自定义 tabBar 高亮色**当前用 `--nutui-brand-color` 默认值，接后台主题色时在 `theme.ts` 落地后写运行时变量。

## 4. 环境变量对照

| VITE_*（旧） | TARO_APP_*（新） |
|---|---|
| VITE_API_URL | TARO_APP_API_URL（H5 留空取 origin） |
| VITE_API_PREFIX | TARO_APP_API_PREFIX（/api/） |
| VITE_STATIC_RESOURCE | TARO_APP_STATIC_RESOURCE（static/mini） |
| VITE_SOCKET_URL | TARO_APP_SOCKET_URL |
| VITE_IS_MERCHANT/PRO/B2B/OVERSEAS/STORE/VENDOR/DEMO | 同名 TARO_APP_* |

## 5. 页面迁移批次（唯一事实源，随进度勾选）

### B1 装修渲染器（框架 ✅，模块进行中）
- [x] 框架：TigImage/TigNavbar/TigTabbar/TigLayout/分发器 DecorateModules/registry/customPage 页/404
- [x] 模块：notice whiteBlank whiteLine commonTitle catNav(+Sticky) navbar searchBar searchBar2 noticeA2 noticeA3 mixedNotice shopTips tagNav titleAd imageAd imageNav imageSquareAd imageHotarea product product2 productA1 banner bannerA2 imageAd2 slidingImage slideLargeImage（28 类已注册）
- [x] components/product/specification（SKU 弹层 1912 行 + TigNumberBox + buy 组件，props/expose 映射表见代理报告；product2 的 handleBuy 接线点留待 B2）
- [x] 模块：coupon seckill seckill2 countdown groupSliding（批次7，含 commonCountdown children 插槽扩展与 commonTitle more 插槽补出口）
- [x] 模块：productGrouping comboSuggestions mixedProductDisplay newcomerCombo groupon（批次8，含 couponInfoMap 单例 hook 随模块落地）
- [x] 模块：categoryNav categoryNavA1 categoryNavA2 categoryNavA3 categoryRec categoryRecA1 imageTextComponent（批次9，useAnimation hook 补入 useDecorate.ts）
- [x] **B1 装修模块全量完结：42/42 类**（最后 2 类 videoNumber/live 含 TARO_ENV=weapp 守卫 + ChannelVideo/ChannelLive 映射）
- [ ] 代理进行中：B2-1a：search/index + search/result + list.vue；B2-1b：search 抽屉/筛选批（drawer-domestic/overseas、filter-overseas、tag-row-domestic、slider、header-domestic、src/shopInfo ≈1960行）
- [ ] B2 待做：product 详情（12281行拆批：composables → src 组件 → index 装配）、productCate、masonry 独立组件统一
- [x] masonry 独立容器已补（B4-2a：`components/masonry/Masonry.tsx`，product2 内联版由后续批次统一）
- [ ] TODO stubs 待补：imageSearchEntry(B6)、TigSelectLang(B4)、SplashAd(B4)、mainHeader(B6)

### B2 商品链路
- [x] search/index.tsx + result.tsx + List.tsx（B2-1a；配套 searchDecorate store/useList/getPromotionList/loading-box；页面已入 app.config；与 B2-1b 并行协调过占位冲突）
- [x] B2-1b：search 抽屉/筛选批全量完成（drawer×2/filter×2/tag-row/slider/header×2/shopInfo + SliderRef/DrawerRef imperative 接线；search 子系统完结）
- [x] B2-2a：product 详情 composables 全量完成（7 hooks + rawImageNativeDownload；对接契约：detailLoaded 等 3 组 ref 双写字段必须走 setter、useProductRawImageDownload 生命周期需页面外置 useDidShow/useDidHide/useUnload、useProductAction 接 SpecificationRef）
- [x] B2-2b：product/src 组件前半 11 个（expandableText/menuPop/productSwiper/productDescription/productContent/productImg/productImgDecorate/productDiscountTitle/productSeckillTitle/productPresaleTitle/productNav）+ TigCountdown/service 共享组件（2776 源行）
- [x] B2-2c：product/src 组件后半 14 个（productGroupon(GrouponMore)/afterSaleCard/afterSaleService/attrCard/commentItem/productComment/evaluateCard/serviceCard/merchantShopInfo/productCoupon/productShare/error/animation；Props 形状一览已归档到代理报告供 B2-2d 装配）
- [x] B2-4：productCate 分类页全量完成（index + 三种风格 + TopHeader/Search/Menu/SelectCate/MainCategory + deepMerge/cate-center-v1/v2 配套；styleThreeCate 接 SKU 弹层完整链路；TopHeader 以最小等价承载 mainHeader 契约待 B6）
- [x] **B2-2d：product/index.vue 装配完成（1409行 tsx + ProductActionBar 440行六形态底栏）——B2 商品链路全量完结**。代理自补缺失件：productTitleInfo(892)/productGrouponTitle(354)/descriptionCard/recommend + productShare/shareLogin utils + tig-back-top/tig-loadingpage；接线清单与遗留 TODO 已归档代理报告（mainHeader B6 占位、grouponEnable 复位 setter 建议）
- [x] **B2 商品链路全量完结**（search + product 详情 + productCate + SKU 弹层 + masonry 系）
- [x] B3-1a：cart 主页面全量完成（index 1180行可变ref+useReducer状态机 + 5 子组件 + Checkbox/NumberStepper/DiscountInfo/Recommend 配套；index.v1 确认无引用跳过；→order 跳转参数约定已归档）
- [x] components/product/specification（SKU 弹层 1912 行 + TigNumberBox + buy，已完成）
- [~] components/masonry 瀑布流容器（556行）；✅ ProductItem/ActivityCard/TigLazyImage/themeColor/productSoldOut 已完成

### B3 交易
- [x] B3-1b：cartJump 结算页完成（index 2035行；与 cart 同构但保留自身差异：executeCheckout 无 toast/无配送预检兜底/key=productId；复用 ../cart/src/*；→order 参数约定与 B3-1a 一致）
- [ ] B3-2a 进行中：order/check 结算页（1654行 + 引用的 src 卡片组件）
- [x] B3-2b：pay/cashier/payStatus 收银台三页完成（支付核心：50 次串行轮询/cashier 渠道缓存 30 分钟/挽留弹窗/ApplePay H5 全流程；usePayment hooks + payment/applePay utils 补齐；14 个文件约 3516 行；check 卡片避让无冲突）
- [x] B3-2a：order/check 结算页完成（1634行可变ref+useReducer + 核心四卡片 DeliveryTypeCard/TotalCard/PointsCard/CouponInfo 全量；10 个卡片占位留 B3-2c/2d；→pay/cashier/payStatus 跳转契约与 B3-2b 逐字对齐；check.v1 确认无引用跳过）
- [x] **B3 主链路贯通**：cart/cartJump → check → pay → cashier → payStatus 全链完成（余占位卡片 B3-2c/2d）
- [x] B3-2c：结算页占位卡片第一批 9 个全量完成（AddressInfo/PickupUserCard/PaymentMode/PaymentChannelList/BalanceCard/CreditCard/Remark/AddressPop/ShippingFeePop；BalanceCard/CreditCard 补挂 ref 遗留缺口；接线核对零改动）
- [x] B3-2d：结算页占位卡片第二批 4 个全量完成（StoreCard 711/storeCardStore 1160/DatePop 279/TotalCardStore 287，O2O 门店卡片；随批补齐直接依赖 productItem/pickupTime/dateStockCard 共 572 源行；StoreCard 接线与 check.tsx 核对零改动、tsc/H5 build 全绿；StoreCardStore/DatePop/TotalCardStore 暂无页面接线（旧 O2O check 装配留后续批次）；PresaleCard/InvoiceInfo 占位留 B3-2e）
- [x] B3-2e：InvoiceInfo(550) + PresaleCard(366) 完成（旧 tig-popup→NutUI Popup、uni-forms/uni-easyinput/up-radio→Taro Input + 自绘表单行/单选；InvoiceInfo 在旧项目中零引用，按原样提供组件未接线；PresaleCard 已由 StoreCard/StoreCardStore 接线并随本批实装）
- [x] B4-1：login/register + tig-wechart-login 微信授权弹层完成（baseLogin 跨境 Tab + Google/Facebook/Twitter 三方登录、图形验证码防刷、协议弹层；register 校验链与绑定业务员逻辑平移；TigWechartLogin 由 TigLayout 统一接线）
- [x] cart（7页4402行）+ cartJump（2页3516行）（= B3-1a / B3-1b，此行为过期占位）
- [x] order（36页14433行：check/pay/列表/详情/售后）（= B3-2a~2e + U1 售后 + U2 订单列表/详情，此行为过期占位；openPay 见 §5 R1）

### B4 会员
- [x] login（4页2047行）+ register（2页482行）+ 微信授权弹层 tig-wechart-login
- [x] B4-2a：member 公共依赖补齐（TigUpload 90 / TigAuthBadge 94 / Masonry 容器 556 / Recommend 86；同时完成 B2 遗留的瀑布流独立容器统一）
- [x] B4-2b：member 装修组件完成（decorate 分发器 + userInfo/userInfoV2/userInfo3/orderEntry/orderEntryV2/myWallet/myWalletV2/adImage/myService/myServiceV2/account/fixedFunctionalArea/advertising + termPayCard，≈3500 行）。随批补齐公共件：`utils/decorateFrame.ts`、`hooks/useCreditInfo.ts`、`TigImage` className 透传；旧 uni.$on("commentFinished") → Taro.eventCenter
- [x] B4-2c-1：mainHeader 完成（`components/mainHeader/index.tsx` + `MainHeader.scss`，529 行；侧边菜单抽屉、胶囊安全区、实测高度写 configStore、forwardRef 暴露 getContentRect、onWindowResize 重测）
- [x] B4-2c-2：member/index.vue 装配完成（装修/兜底双分支、沉浸式渐变与渐隐带、mainHeader 占位与滚动渐显、老接口 banner/menus、普通版订单五宫格 + 钱包三列 + 跨境旧版布局；tsc/H5/weapp 全绿）
- [x] B4-3：address/list + editRegion（含 SelectRegion、crossBorderAddress 公共件）+ langSet（TigSelectLang 走位）+ reset（StepOne/StepTow）完成；代理产出后主会话统一注册路由并通过 tsc/H5/weapp
- [x] U1：user/afterSale 6 页 + ordermessage + termPay/detail（≈2700 行）；随批补齐 TigImageUpload、TigButton2（后续批次可直接复用）
- [x] U2：user/order list + info + order/src/PresaleCard（≈2884 行）；随批补齐 CancelOrderReasonPopup、orderPayment/orderReason/giftCard utils
- [x] U3：user/account 7 页 + invoiceManagement 6 页（≈3490 行）
- [x] U4：user/comment 2 页 + security 4 页 + userCertification（≈2940 行），含 11 个样式文件补齐（Rate/Steps/DatetimeItem/SelectDate 等自绘组件）
- [x] U5：user/merchantEnter 7 件 + profile + ranks（≈3430 行）；随批补齐 rec-product、TigCopyright，修复 FixedPlaceholder store 取值
- [x] U6：levelCenter（含 benefit/levelDesc/taskCard/topCard）+ sign + messageLog + collectProduct + historyProduct + collectionShop + bindMobilePhone + suggest + point/detail + about（≈3163 行）
- [x] B5-2：groupon list/mylist + 7 个子组件 + lottery（≈3192 行）
- [x] B5-3：giftCard 4 页 + 7 个 src 组件（≈2950 行）
- [x] S1：salesman index/list/detail/level/material/customerDetail + 14 个 src 组件（≈2589 行）
- [x] S2：salesman 剩余 17 页 + 4 个 src 组件（≈3250 行）
- [x] PV1：productV1 4 页 + 7 个 src 组件（≈3625 行，复用 B2 同名组件）
- [x] B6-2a/b：buyerShow 全量（index/videoFeed/detail/add/comments + 5 个 buyerShowCompnents + 3 个 components + composables/utils，≈4428 行）
- [x] B6-3：im 3 页 + 5 个 src 组件 + imageSearch/captureMp + oauth/callback（≈3141 行）
- [x] B6-5：search/image + 4 个 imageSearch 组件 + store/imageSearch + imageSearchEntry/SourceSheet 实现 + order/offlinePayment 完整版（≈1900 行）
- [x] B6-4a：shop 5 页（index 121 / category 190 / list 35 / info 412 / license 150）完成；随批补齐 `components/shopListEmpty`、`hooks/useGroupShopList`(157)、`pages/search/src/shopInfo.tsx`（15 行 stub → 129 行实现）、`customPage/modules/shopInfo`(165)、`customPage/modules/shopModules.tsx`(98，白名单 + registry 查表，未复制 177 行 if 分支)
- [x] B6-4b：article 5 页（news list/detail、issue list/detail + src/ProductItem）+ 5 个 scss 完成
- [x] B6-4c：activity 1 页完成（script 115 行 → 121 行 tsx）；旧 scoped scss 1220 行中 1100+ 行属首页遗留死样式（对应本页不存在的 DOM），未平移，已在 index.scss 注释说明
- [x] B6-4 路由已注册：shop×5 + article×4 + activity×1（`types/home/home.d.ts` 补 `bindDecorateId?: number`，后端 DecorateModuleListVO 实际返回该字段，旧类型定义缺失）
- [x] B6-4d：customPage 48/48 模块核验通过（registry 全量注册）+ index/src/PreviewTip 完成；**双首页装配已落地**：`index/index.tsx` 接 masonry（B4-2a 容器 + useProductStyle）、外贸风 mainHeader + spacer（B4-2c-1）、SplashAd、TigBackTop、useDidShow 滚动恢复、share 三件套、useUnload；`customPage/index.tsx` 补 masonry/backTop/useDidShow/share。旧 1220 行首页 scss 中的遗留死样式未平移
- [x] B6-6a：SplashAd 开屏广告（`components/SplashAd` 新建 119 行 tsx + scss；image/video 双素材、加载完才起倒计时、跳过按钮、redirectType=1 跳转、video ended 关闭；旧端差异 close-btn--weapp/--h5）
- [x] B6-6b-1：store/region 全量移植（405 → 442 行）：GPS/IP 双通道定位、进店规则三级优先级（推广店铺 / 同城配送最近门店 / 销售员气泡）、IP 仅首次兜底不降级 GPS、推广 shopId 从 URL·启动参数·扫码 scene 三处解析、最近门店预取、storage key 全部保持原值；配套 `utils/location.ts`（139 → 116 行，gcoord WGS84→GCJ02、权限检查三端收敛）
- [ ] **B6-6b-2：App(RN)/鸿蒙端形态决策 —— 唯一剩余项，需用户拍板**（App 壳形态：RN 原生 vs H5 壳；阻塞 plus.runtime 系：appVersion/checkAppUpdate/appPermission；地图 mapProvider/tig-map 组件。其余全部批次已完成：367 页面 tsx / 78859 行，tsc 0 错误，双端构建全绿，TODO(MIGRATION) 131 处均为已标注的视觉/行为校准备忘）
- [ ] tig-select-lang 真实现（**纠错 2026-11-05**：此前被误勾为"真实现 204 行"，实测 `components/tig/tig-select-lang/TigSelectLang.tsx` 仍为 8 行 null 占位 stub；旧源 tig-select-lang.vue 204 行待移植，弹层能力已登记 §5-R3 B5）

### B5 增值
- [x] coupon（index/detail/search + Tag）seckill（list）groupon（list/mylist + 7 组件）exchange（list）giftCard（4 页 + 7 组件）lottery（index）全量完成

### B6 特殊与收尾
- [x] im（index/list/page + 5 组件，websocket 复用 utils/websocket.ts）
- [x] imageSearch（captureMp + search/image + 4 组件 + store/imageSearch + imageSearchEntry/SourceSheet）；uni_modules 原生插件按 weapp 守卫 + TODO
- [x] salesman（39 件全量）
- [x] article（5 页）+ buyerShow（16 件全量）+ shop（5 页）+ activity + oauth/callback + order/offlinePayment
- [x] productV1（4 页 + 复用组件）+ customPage 48/48 + 首页 index 装配
- [ ] App 端（RN/plus.runtime 替代）与鸿蒙端决策与实施

### R 收尾批（2026-11-05，本会话）
- [x] **R1：页面清点 + openPay 补齐**：新旧 pages.json 逐页对比（按 subPackages root 归一），Phase 1（weapp/H5）范围 119/120 已注册。新建 `pages/order/openPay.tsx`（13 行，旧源为 12 行预留空页，补 usePageGuards）+ config；`user/account/cardManagement/{list,edit}` 实为 U3 已迁移（= `user/account/{list,edit}`），按薄包装页 re-export 保旧路径深链兼容（各 9 行 + config）。路由已入 `app.config.ts`，三绿验证通过（typecheck 0 错 / build:h5 / build:weapp exit 0，dist/app.json 含 3 条新路由）
- [x] **R2：imageSearch/capture 评估结论 —— 无需迁移**：旧 pages.json 中该页被 `#ifdef APP-PLUS` 包裹，为 App 专属 nvue 页（依赖 image-search-camera 原生插件）；weapp 走已迁移的 captureMp，H5 无此页。归入 App(RN) 端批次（B6-6b-2）
- [x] **R3：TODO(MIGRATION) 全量审计**：131 处/97 文件 → **A 外部阻塞 17**（plus.runtime/onBackPress/原生插件，汇总为 App 端待决策清单，随 B6-6b-2）/ **B 可独立补齐 72**（聚合为 5 个修复批：B1 通用按钮/图标替换 ~30 处、B2 共享组件补齐 10 处、B3 region/O2O 10 处、B4 以图搜图+海报接线 6 处、B5 零散逻辑 16 处，明细清单见审计报告）/ **C 守卫型 15**（非缺陷，建议改普通 MIGRATION-NOTE 注释降噪）/ **D 待 parity 核对 27**（canvas 4、动效 6、Swiper H5 2、富文本 2 优先；4 处业务口径转产品确认：评论角标、营业期限重置、周期购口径、文章 id 行为）。后续会话从 B1 开始执行

## 6. 验收口径

- 每批次：`npm run build:weapp && npm run build:h5 && npm run typecheck` 全绿 + H5 手工冒烟对应链路。
- 最终切换前：与旧 uniapp 并行部署，按 §5 批次逐条视觉/交互 parity 核对（对齐 admin-semi 的审计习惯）。

## 7. 自动化执行手册（定时任务/新会话按此执行）

0. **接力互斥（先于一切）**：检查本目录 `.migration-lock` —— 存在且 90 分钟内修改过 = 上一轮仍在执行，本轮直接结束；否则创建/覆盖 lock（内容=时间戳+批次名），批次完成并验证全绿后删除 lock。锁同时覆盖定时轮与手动会话，防止双跑。
1. **读本文件**：§5 找第一个未勾选批次；§3 是已定架构决策，不得违背。
2. **并发纪律**：用 Agent 工具发子代理移植，**同时最多 2 个**（账号并发上限，第 3 个必失败）；单代理单批源码量 ≤3000 行，更大须拆分。
3. **Vue→React 转换规范**（给子代理的提示词模板要点）：
   - template→JSX：v-if→&&、v-else-if→三元、v-for→map（key 稳定字段）、@click→onClick、:style 字符串→style={字符串}、:class→className 模板字符串；`<image>/<view>/<text>/<swiper>/<swiper-item>/<scroll-view>` → `@tarojs/components` 的 `Image/View/Text/Swiper/SwiperItem/ScrollView`
   - `<tig-image>`→`@/components/tig/tig-image/TigImage`；`<tig-navbar>`→`@/components/tig/tig-navbar/TigNavbar`；页面壳 `<tig-layout>`→`@/components/tig/tig-layout/TigLayout`（props 对齐旧组件）
   - script setup：ref/computed/watch/onLoad/onShow → useState/useMemo/useEffect/`useRouter`+`usePageGuards()`；defineExpose→forwardRef+useImperativeHandle；v-model→props+onChange 回调
   - `uni.*`→`Taro.*`；`import.meta.env.VITE_*`→`process.env.TARO_APP_*`；`#ifdef X`→`process.env.TARO_ENV === "x"`；uview 组件（u-popup/u-empty/u-loading-icon…）→ NutUI-React 或按原视觉用基础组件重写；`uni.$u.*` 禁止出现；$t→t（`@/utils/i18n`）
   - 样式：`<style lang="scss" scoped>` 原样拷入 index.scss，去 scoped、`:deep()` 平铺、`v-bind()` 改内联 style；元素选择器（`image{}`）保留但注释 H5 可能不命中
   - **业务逻辑与视觉结构逐行保留，禁止自行"优化"**；无法平移的点写 `// TODO(MIGRATION)：` 注释并在本文件 §5 对应批次下登记
4. **每批完成后**：组件注册（装修模块进 `src/pages/customPage/modules/registry.ts`；页面加进 `src/app.config.ts`）→ 验证 `npm run build:weapp && npm run build:h5 && npx tsc --noEmit` 全绿 → 更新本文件勾选。
5. **修复优先**：发现构建红先修红；不改旧 `view/uniapp`（只读）；不主动 git 提交。
6. **完成条件**：§5 全部勾选 + 三项验证全绿 + §5 顶部 TODO stubs 全部消除 → 本自动化可暂停（CronPauseSelf）。
