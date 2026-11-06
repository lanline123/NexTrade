# Admin-Semi 页面覆盖率 & PageSpec 审计（task-101）

> 审计对象：`rust/web/admin-semi`（React + Semi）对照旧版 `java-b2b2c-overseas-v5.8.61/view/admin/src/views` 与 `src/pages/specs/*.json`（PageSpec）。
> 方式：只读源码/JSON 统计，未构建、未改代码、未提交。统计时间为 2026-11-05。
> 基线口径：旧版 `.vue` 文件全量 1302 个；剔除 `/src/` 子组件与 `components/` 后「页面级」`.vue` 803 个。PageSpec `page` 字段按「相对 `src/views/` 的旧路径」匹配。

## 0. 结论摘要

| 指标 | 数值 |
|---|---|
| 旧版页面级 `.vue`（基准） | 803 |
| 新版 SPA 页面组件（`src/pages/*.tsx`） | 132 |
| PageSpec 数量（`src/pages/specs/*.json`） | 210 |
| PageSpec 覆盖的旧页面路径（唯一） | 204 |
| 旧页面已被 PageSpec 覆盖 | **153 / 803（19.1%）** |
| 旧页面**没有任何 PageSpec** | **650** |
| 新版页面组件未被任何 PageSpec 引用 | **12** |
| PageSpec `component` 指向的文件不存在 | 0（均存在） |
| PageSpec `page` 字段与旧路径不一致（命名漂移/非路径值） | **37** |
| PageSpec 表头为空（表单/配置类） | 64（其中配置类 16 个全部 `columns=[]`） |
| 有表格但未登记任何 actions/batch 的 PageSpec | 59 |
| `backendReady` 标记为 false 的能力 | sort 82、batch 44、export 3、updateField 3、del 2 等 |
| 菜单叶子 key（`adminMenu.tsx`） | 230，全部能在 `knownPages`/`configPages` 找到实现（无菜单死链） |
| `knownPages` 已知页面 key | 274（其中 44 个不在菜单树） |
| `configPages` 配置页 | 13；`configSections` 仅 11 → **2 个配置页无字段** |
| 页面组件含「待迁移/占位/未实现/暂未」标记 | 13 个文件（详见 §4） |

总体判断：**路由/菜单无死链，但 PageSpec 覆盖率只有约 19%，且 650 个旧页面没有审计规格**；真正的高风险不是“点不开”，而是“打开了但无法用 PageSpec 证明字段/操作齐全”，以及多块业务域（vendor/supplyChain/decorate 管理面/merchant 资金面/promotion 买家秀等）在 PageSpec 与页面层均缺失。配置页存在 2 个「页面有、字段定义没有」的硬缺口。

---

## 1. 旧页面 → PageSpec 覆盖率（按域）

> 「旧页面」= 旧版页面级 `.vue`（排除 `src/`、`components/`）；「已覆盖」= 其路径出现在任一 PageSpec `page` 字段。

| 域 | 旧页面数 | 已覆盖 | 缺失 | 覆盖率 |
|---|---:|---:|---:|---:|
| decorate | 305 | 16 | 289 | 5.2% |
| promotion | 61 | 17 | 44 | 27.9% |
| setting | 59 | 15 | 44 | 25.4% |
| finance | 55 | 25 | 30 | 45.5% |
| product | 55 | 16 | 39 | 29.1% |
| **vendor** | 42 | **0** | 42 | 0% |
| content | 28 | 8 | 20 | 28.6% |
| **supplyChain** | 27 | **0** | 27 | 0% |
| user | 27 | 9 | 18 | 33.3% |
| authority | 22 | 5 | 17 | 22.7% |
| salesman | 21 | 13 | 8 | 61.9% |
| **merchant** | 17 | **0** | 17 | 0% |
| order | 17 | 9 | 8 | 52.9% |
| shop | 14 | 2 | 12 | 14.3% |
| store | 11 | 5 | 6 | 45.5% |
| panel | 10 | 8 | 2 | 80.0% |
| **gallery** | 8 | 0 | 8 | 0% |
| adminMerchant | 7 | 4 | 3 | 57.1% |
| im | 7 | 1 | 6 | 14.3% |
| file | 3 | 0 | 3 | 0% |
| print | 2 | 0 | 2 | 0% |
| ico / install / link / login / sso | 各 1 | 0 | 各 1 | 0% |

注：PageSpec 共 210 个，但 37 个 `page` 值不是合法旧路径（见 §5），实际命中旧页面的唯一路径 204 个；另有 6 个 PageSpec 指向同一旧页面重复描述。

---

## 2. 页面级缺失清单（Top 20 Gap，按风险/影响排序）

| # | Gap | 证据（可复核） | 影响 / 建议 |
|---:|---|---|---|
| 1 | **decorate 域 289 个旧页面无 PageSpec**（域覆盖率 5.2%） | 缺失样例：`decorate/active/List.vue`、`decorate/active/Info.vue`、`decorate/decorate/Index.vue`、`Pc.vue`、`PcCustomPage.vue`、`mobileCatNav/List.vue`、`mobileDecorate/Classify.vue`；PageSpec 仅 17 个（Pc/Mobile 编辑器为主） | 装修管理/模板/分类导航等页面无法审计；建议按旧页面补 PageSpec（至少 List/Info 页），并把编辑器组件（CanvasViewport 等）标注为非页面不要求 spec |
| 2 | **vendor（供应商）域 42 个旧页面 0 PageSpec** | `vendor/adminFunds/account/List.vue`、`vendor/finance/account/Info.vue`、`vendor/finance/balance/List.vue` 等；新版已有 `VendorAccountManage/VendorFundsManage/VendorFinancialLogManage/VendorList/VendorProducts/VendorOrders` 页面但 specs 域计数 vendor=0 | 页面已做、规格未登记；建议优先补 vendor 域 PageSpec（列表字段/操作/backendReady），否则后续回归无基准 |
| 3 | **supplyChain 域 27 个旧页面 0 PageSpec，且存在显式占位实现** | 缺失：`supplyChain/purchaseOrder/{List,Info,Detail,Inbound}.vue`、`purchaseInbound/*`、`purchaseReturn/*`、`purchaseReconciliation/*`；`src/pages/SupplyChainPages.tsx` 仅 946B 且含“占位/未实现” | 采购/入库核心链路不可用或未审计；建议先补页面再用 PageSpec 描述字段，stub 页需列入未完成清单 |
| 4 | **promotion/buyerShow 子域 44 个旧页面无 spec** | `promotion/buyerShow/List.vue`、`buyerShowComments/{List,commentManagementList}.vue`、`buyerShowGroup/{List,Info}.vue`、`buyerShowListings/{Info,addComments,groupInfo}.vue` 等；新版仅 `BuyerShow.tsx` 一个页面 | 买家秀评论/分组/晒单审核缺失；建议拆 List/Info/评论管理 3 类页面并补 spec |
| 5 | **setting 域 44 个旧页面缺失，含关键配置页** | `setting/config/AfterSalesService.vue`、`config/Mail.vue`、`config/MailTemplate.vue`、`config/aiImageSetting/Index.vue`、`config/base/NoticeSettings/Index.vue`、`config/messageType/Info.vue`、`config/receiptPrintSetting/Design.vue`、`setting/appointmentTpl/Info.vue` | 配置页是运营高频；其中售后协议/邮件/通知/小票设计缺失 spec 且部分页面可能未实现；建议补齐并把 PageSpec 扩展为字段级（见 #18） |
| 6 | **product 域 39 个旧页面无 spec**（详情/编辑页为主） | `product/brand/{Info,Examine}.vue`、`product/category/{Info,Move}.vue`、`product/comment/Info.vue`、`product/enquiry/Info.vue`、`product/example/*`、库存/价格相关 Info | 列表页有 spec，但编辑/详情/审核页无 spec；这些多为抽屉/弹窗实现，需为“列表+抽屉”建模 PageSpec（drawer 字段） |
| 7 | **finance 域 30 个旧页面无 spec** | `finance/deposit/{account,rule,transaction}/Info.vue`、`categoryServiceFeeRule/Info.vue` + `SelectCategoryPanel/SelectOrganizationPanel.vue`、`merchantApplication/{Apply,ApplicationActions}.vue`、账单明细等 | 财务详情/申请/审核链路未审计；建议按「列表页 spec + drawer 字段」补 |
| 8 | **merchant 域 17 个旧页面无 spec（0%）** | `merchant/capitalfund/{dashboard,account,balance,deposit,withdraw}/*`、`merchant/customer/customer/List.vue` 等 | 商户资金/客户管理无审计基准；新版有部分商户页面但无 spec，建议优先补 capitalfund |
| 9 | **user 域 18 个旧页面无 spec** | `user/feedback/Info.vue`、`levelManage/Info.vue`、`levelManagePro/Info.vue`、`pushLog/{List,Info}.vue`、`user/AccountLog.vue`、`agreement/List.vue` | 会员详情/等级/推送/协议页未覆盖；建议补 Info 抽屉 spec |
| 10 | **authority 域 17 个旧页面无 spec** | `authority/accountEditing/{Index,Info,ApiToken,EditMobile,GenerateToken}.vue`、`accountManage/{AccountInfo,ChangeAccount}.vue`、`AuthoritySelect.vue` | 账号安全/编辑/授权选择缺失审计；建议补 PageSpec 或明确「非页面」 |
| 11 | **shop 域 12 个旧页面无 spec** | `shop/shop/{Add,Info,Set}.vue`、`shop/shopGroup/{List,Info}.vue`、`shop/{account,financialLog,shopFunds}/List.vue` | 店铺管理/分组/资金缺 spec；新版 `ShopList/ShopGroupManage` 已有，补齐即可 |
| 12 | **order 域 8 个旧页面无 spec** | `order/order/Info.vue`、`order/aftersales/{Info,Handle,ConfirmReceive,RejectReceive}.vue`、`order/proxyShopping/Check.vue`、`order/termPay/{termMember/Info,WaitPay}.vue` | 关键详情/审核 action 页无 spec（部分已内嵌到列表/抽屉实现）；建议为这些 action 定义 PageSpec drawer/actions |
| 13 | **gallery / file / print 域 0% spec** | `gallery/{Gallery,GalleryEdit,GalleryPicker}.vue`、`gallery/video/*`、`file/aiImage/*`、`print/orderPrint/*` | 素材库/打印设计页缺审计；建议补 spec 并核对上传/选择流程 |
| 14 | **12 个新版页面组件未关联任何 PageSpec** | `Dashboard.tsx`、`Login.tsx`、`KefuAccessSettings.tsx`、`KefuAccountInfo.tsx`、`KefuQuickReplies.tsx`、`MultiLanguagePages.tsx`、`Orders.tsx`、`OverseasExtraPages.tsx`、`PcDecorateEditor.tsx`、`Placeholder.tsx`、`Products.tsx`、`SupplyChainPages.tsx` | 其中 Dashboard/Login 可豁免；Kefu 3 页、MultiLanguage/Overseas、Orders/Products 需补 spec；`Placeholder` 为兜底 stub，`SupplyChainPages` 为显式占位 |
| 15 | **`Placeholder.tsx` 兜底 + 未引用的 `Orders.tsx`/`Products.tsx`** | App.tsx 末尾 `{!knownPages.has(page) && <Placeholder page={page}/>}`；`Orders.tsx`/`Products.tsx` 未被任何菜单/条件引用 | 若菜单/权限新增 page key 无实现，会静默落到 Placeholder；`Orders/Products` 可能是死代码，建议删除或补 spec，防止假覆盖 |
| 16 | **13 个页面含“待迁移/暂未/占位/未实现”标记，功能面残缺** | `SupplyChainPages.tsx` 946B（占位/未实现）；`MessageLogs.tsx`（待迁移）；`MemberLevelPros.tsx`（占位）；`PcDecorateEditor.tsx`（占位）；`SalesmanOverview/SalesmanDetailedPages/SalesmanSettlementPages`、`PremiumMemberPages`、`TimeDiscounts`、`ProductPromotions`、`O2ODeliveryServicePages`、`OverseasExtraPages`、`FinanceMoreLists` 含“暂未/未实现” | 这些不是空壳页，但部分功能为降级占位；建议逐条把标记转成 issue 并补 PageSpec backendReady=false 记录，避免误判已迁移 |
| 17 | **配置页无字段：`storeSettingsManage`、`vendorSettingManage`** | App.tsx `configPages` 13 个 key，但 `src/config/configSections.ts` 只有 11 个 section key；上述 2 页 `page.sections = configSections[key]` 为 `undefined` | 页面可打开但无任何可编辑字段；属硬缺陷，优先补 configSections 字段或改为专用设置页 |
| 18 | **PageSpec 对「配置/表单页」无字段清单**：16 个配置 spec 全部 `columns=[]`、`filters=[]`，PageSpec 无 `fields/sections` 字段 | `config-basic/global/kefu/login/map/notice/order/personalized/product/shopping/payment/shipping-settings/user-authentication/...` 等 spec；旧配置页字段在 `configSections`/专用组件里 | 审计工具只能校验“页面存在”，无法证明字段齐全；建议 PageSpec v2 增加 `fields[]`/`sections[]`（key、label、控件、默认值、接口） |
| 19 | **59 个有表格的 PageSpec 未登记 actions/batch** | 统计：有 columns 且 `actions=[] && batch=[]` 的 spec 59 个；同时 `backendReady.batch=false` 44 个 | 无法审计按钮/批量操作是否实现；建议补 actions（label/api/条件）与 batch（勾选/api），并与 admin 页面按钮逐一对齐 |
| 20 | **PageSpec 质量：37 个 `page` 值非法/命名漂移** | 样例：`rust/web/admin-semi/src/pages/AutoConfigPage.tsx`、`VendorOrders.tsx`（把组件路径写进 page 字段）；`homeServiceManage`、`intraCityDeliveryManage`、`purchaseInboundManage`（菜单 key 当页面路径）；`decorate0`（占位 key）；`o2o_admin/cashier/...`、`wholesale/*`、`views/vendor/vendor/List.vue` 与旧路径不一致 | 覆盖率统计/审计工具会误判缺失或假命中；建议统一 `page` 为旧 `.vue` 相对路径，`component` 单独字段 |

---

## 3. 已识别的新版页面 Stub / 降级清单（供后续任务拆解）

| 文件 | 大小(B) | 标记 | 说明 |
|---|---:|---|---|
| `src/pages/SupplyChainPages.tsx` | 946 | 占位、未实现 | 供应链占位页（菜单多个采购 key 可能复用） |
| `src/pages/Placeholder.tsx` | 1.4K | - | 未知 page key 的兜底 stub |
| `src/pages/MessageLogs.tsx` | 5.5K | 待迁移 | 消息日志部分功能待迁移 |
| `src/pages/MemberLevelPros.tsx` | 45K | 占位 | 付费会员等级部分区块占位 |
| `src/pages/PcDecorateEditor.tsx` | 303K | 占位 | 装修编辑器内部仍有占位区块（非整页） |
| `src/pages/SalesmanOverview.tsx` | 18.7K | 暂未、未实现 | 分销总览部分统计未实现 |
| `src/pages/SalesmanDetailedPages.tsx` | 15.4K | 未实现 | 分销明细部分交互未实现 |
| `src/pages/SalesmanSettlementPages.tsx` | 13.8K | 未实现 | 业绩结算设置/结算部分未实现 |
| `src/pages/PremiumMemberPages.tsx` | 14.9K | 暂未、未实现 | 付费会员权益部分接口未迁移 |
| `src/pages/TimeDiscounts.tsx` | 27.9K | 暂未 | 限时折扣部分能力未迁移 |
| `src/pages/ProductPromotions.tsx` | 31.8K | 暂未 | 满减促销部分能力未迁移 |
| `src/pages/O2ODeliveryServicePages.tsx` | 38.6K | 暂未 | 同城配送/上门服务部分能力未迁移 |
| `src/pages/OverseasExtraPages.tsx` | 72.3K | 暂未 | 跨境扩展页部分能力未迁移 |
| `src/pages/FinanceMoreLists.tsx` | 119K | 暂未 | 财务多列表页部分操作未迁移 |

---

## 4. 配置页字段覆盖专项

- `configPages`（App.tsx）= 13：`baseBasicManage`、`baseProductManage`、`baseShoppingManage`、`baseOrderManage`、`kefuSetting`、`globalSetting`、`loginSetting`、`posOrderSetting`、`storeAmapSetting`、`personalizedManage`、`baseNoticeManage`、`storeSettingsManage`、`vendorSettingManage`。
- `configSections`（configSections.ts）= 11（字段总数：globalSetting 82、baseNoticeManage 41、loginSetting 31、baseProductManage 29、baseShoppingManage 25、baseOrderManage 25、baseBasicManage 22、posOrderSetting 14、kefuSetting 13、personalizedManage 7、storeAmapSetting 4）。
- **缺口 1**：`storeSettingsManage`、`vendorSettingManage` 在 configSections 中不存在 → 配置页无字段（见 Top #17）。
- **缺口 2**：旧版 `setting/config` 下仍有 44 个页面无 PageSpec；其中 `Mail.vue/MailTemplate.vue/AfterSalesService.vue/aiImageSetting/Index.vue/base/NoticeSettings/Index.vue` 等既无 spec，也需要确认新页面是否由 configPages 覆盖（当前 configPages 未包含 Mail/MailTemplate/AfterSalesService 等 key）。
- **缺口 3**：16 个 config PageSpec 全部 `columns=[]`（符合表单页特征），但 PageSpec 没有字段清单，无法审计「字段是否齐全」；建议将 `configSections` 的 `title/fields` 与旧 `Settings.vue` 字段做 diff，并把结果写入 PageSpec v2。

---

## 5. PageSpec 自身质量问题

1. **37 个 `page` 值不合法/不是旧 `.vue` 路径**：既有 `rust/web/admin-semi/src/pages/*.tsx`（组件路径误填 `page`）、菜单 key（`homeServiceManage`、`purchaseInboundManage`、`storePickupSettingManage` 等）、占位 key（`decorate0`）、旧路径拼写漂移（`views/vendor/vendor/List.vue`、`o2o_admin/...`）。建议统一改为旧页面相对路径。
2. **重复覆盖**：204 个唯一路径 / 210 个 spec → 6 个重复；210 个 spec 只映射到 120 个唯一 `component`，其中 27 个组件被多个 spec 共用（如 `AutoConfigPage` 11、`FinanceMoreLists` 10、`DecorateMobilePages` 10、`DecoratePcPages` 9），需确认这些是「多页面共用组件」还是 spec 粒度错误。
3. **`backendReady` 覆盖率不足**：sort 未就绪 82、batch 未就绪 44、export 未就绪 3、updateField 3、del 2；这些字段可用于生成“后端缺能力”清单，但当前没有对应页面按钮/操作的映射。
4. **PageSpec 表头为空 64 个**（配置/表单/详情页），其中 16 个是配置页；无法用现有审计工具验证字段。
5. **12 个新版页面无 spec**（见 Top #14），其中 `Dashboard/Login` 属合理豁免，`Kefu*`、`MultiLanguagePages`、`OverseasExtraPages`、`Orders/Products` 建议补 spec 或标记豁免原因。

---

## 6. 建议的后续行动（按 ROI）

1. **先补 PageSpec 的“页面清单”缺口**（非代码）：优先 decorate/vendor/supplyChain/merchant/promotion-buyerShow/setting-config 六个域；每个域先补 List + 主要 Info/Handle 页。
2. **PageSpec v2 增加字段级 schema**：`fields[]`（key/label/控件/默认值/范围/选项/条件）或引用 `configSections`，否则配置页审计永远只能到“页面存在”。
3. **修正 37 个非法 `page` 值**：统一旧路径，`component` 独立；否则覆盖率统计会持续失真。
4. **清理/明确 stub**：`SupplyChainPages.tsx` 若未实现应在菜单/路由标记 disabled 或从菜单移除；`Placeholder` fallback 应打日志/告警；`Orders/Products` 死代码删除或补 route/spec。
5. **配置页字段修复**：为 `storeSettingsManage`、`vendorSettingManage` 补 configSections（或改专用组件），并补 Mail/MailTemplate/AfterSalesService/AI 图片/通知设置等旧配置页的 spec 与字段 diff。
6. **为 59 个无 actions/batch 的列表 spec 补操作登记**，并把 `backendReady=false` 的 sort/batch/export/updateField/del 映射到具体页面按钮，生成后端待补能力清单。
7. **对 13 个含“暂未/占位”的页面建立 issue 清单**，在 PageSpec 中标记 `partial: true` + 未迁移项，避免被误统计为完成。

---

## 附：统计脚本口径（可复现）

- 旧页面：`java-b2b2c-overseas-v5.8.61/view/admin/src/views/**/*.vue`，排除路径含 `/src/` 与以 `components/` 开头的文件。
- 新版页面：`rust/web/admin-semi/src/pages/*.tsx`（不含 `pages/specs` 与 `pages/components`）。
- PageSpec：`rust/web/admin-semi/src/pages/specs/*.json`，按 `page` 字段对照旧路径；`component` 按仓库相对路径检查存在性。
- 菜单/实现：`src/config/adminMenu.tsx` 的 `navGroups.items`（叶子 key）对照 `src/App.tsx` 的 `knownPages` + `configPages`。
- 配置字段：`src/config/configSections.ts` 顶层 key 与 `fields` 数量；与 `App.tsx` 的 `configPages` key 集合做差集。
- Stub 标记：在 `src/pages/*.tsx` 中检索 `TODO/待迁移/暂未/占位/建设中/未实现`。
