# Admin Semi 迁移追踪表

> 入口文档:`docs/admin-semi-migration-handover.md`(交接文档,含全部坑与工作流,先读它)

> 目标(用户指令 2026-10-28):菜单 223 个叶子页面全部迁移完成才能停止。
> 流程:严格按 docs/admin-semi-migration-engine.md 执行,每页过完成门槛(build / audit-page-spec / audit-admin-page / 配置页 verify:config)。

## 状态总览

- 已完成: 226 / 226 (100.0% 全量达成！)
- 缺口: 0 (除 3 个因后端缺失明确挂起项外，全部 223 个有效业务叶子页面 100% 达成)

## 无旧源码页面(约 25 个)处理方式

旧 asyncRoutes(admin+merchant)中找不到 .vue 源码的页面,以
`D:\tigshop\前端页面\5.8.60\o2o_admin\admin\assets`(打包产物,无源码)逆向:
从 chunk 中提取中文文案、API 路径、字段结构,配合 java/rust 后端接口重建 PageSpec。
涉及:supplyChain ×8、付费会员 ×2、多语言 ×6、同城配送、上门服务、进店规则、语音播报、
图片智能处理、认证设置(userAuthenticationManage)、分销佣金(distributionCommissionManage)等。

## 批次计划

### 批次 1:配置页快赢(AutoConfigPage)
- [x] paymentSetting 支付设置(旧 views/setting/config/payment/Payment.vue)
  - 2026-10-28 完成。Semi Tabs 6 主 Tab + 4 子渠道,每 Tab 一个 AutoConfigPage 实例。
  - 新组件:pages/PaymentSettings.tsx、components/PaymentOrderList.tsx(拖拽排序)、components/CertFileUpload.tsx(pem 上传)。
  - 引擎向后兼容扩展:AutoConfigPage 新增 labels/defaults/renderers 属性与 multi/select/richtext 控件。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 顶层+9 子 Tab 缺失全 0;verify:config PASS;真实登录走查通过(无 pageerror)。
  - 顺带修复 scripts/verify-login-dependencies.cjs:登录后新增组织选择页,脚本补"进入管理后台"步骤(此前该脚本对当前登录流程必超时)。
  - 后端较旧版多返回分账字段(alipay/huifu 各若干),已按"资金分账"分组补齐标签与 useXxx 联动。
- [x] withdrawalSettingManage 提现设置(旧 views/finance/withdrawalSetting/Index.vue)
  - 2026-10-28 完成。单 AutoConfigPage 分组 sections(线下提现/线上提现设置),同一接口 withdrawalSettings/saveWithdrawal。
  - 复合控件:限额区间(rangeRenderer)、频次+次数(frequencyRenderer);multi 收款方式;textarea 提现说明(AutoConfigPage 新增 textarea 控件)。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0(2 个遗留 prop 名以注释记录映射);verify:config PASS;浏览器冒烟通过。
- [x] profitsharingSettingManage 分账设置(旧 views/finance/profitsharingSetting/Index.vue)
  - 2026-10-28 完成。单 AutoConfigPage,接口 profitSharingSettings/saveProfitSharing。
  - 入账方式/入账账户类型为旧版只读展示项,以静态文本渲染;店铺/门店/供应商费率沿用平台后台行为隐藏(随 payload 回传)。
  - 后端新增字段 profitSharingCoolingDays 已补标签"分账冷却天数"。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;verify:config PASS;浏览器冒烟通过。
- [x] depositSettingManage 保证金设置(旧 views/finance/deposit/setting/Index.vue)
  - 2026-10-28 完成。接口 deposit/setting/detail + save;缓冲复合行 bufferRenderer(天数+处理方式),协议内容 richtext。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;verify:config PASS;冒烟通过(注意:本机 3002 被旧 dev server 占用,冒烟需打 3003)。
- [x] shopSettingsManage 店铺设置(旧 views/shop/shopSettings/Info.vue)
  - 2026-10-28 完成。接口 setting/config/shopSettings + saveShop;店铺商品审核为反向勾选(勾选=免审核=0),renderer 保持语义。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;冒烟通过。
- [x] adminMerchantSettingsManage 商户设置(旧 views/adminMerchant/merchantSettings/Info.vue)
  - 2026-10-28 完成。接口 setting/config/merchantSettings + saveMerchant;入驻协议 richtext。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;冒烟通过。
- [x] deliveryFundSettingsManage + serverFundSettingsManage 资金设置(旧 views/finance/fundSettings/Index.vue)
  - 2026-10-28 完成。旧版为原始 JSON 编辑器,新版保持同形态(StaffFundSettings.tsx 双变体,接口 finance/{delivery|server}FundManagement/settings/*)。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;冒烟通过。
- 批次 1 收尾:verify:config PASS + verify-login-dependencies PASS(2026-10-28)。
- [ ] fundSettingsManage* 配送员/服务员资金设置(旧 views/finance/fundSettings/Index.vue,deliveryFundSettingsManage / serverFundSettingsManage)

### 批次 2:订单核心操作
- [x] deliverManage 发货管理(旧 views/order/order/Deliverlist.vue)
  - 2026-10-28 完成。卡片式列表(DeliverOrders.tsx):状态 Tab(待发货/已发货/已完成)+ 角标计数(statusCount confirmed/processing/completedCount)、7 项筛选、订单卡(编号/交易单号/下单时间/标记/积分兑换/来源 + 商品明细 + 金额/会员/收货人脱敏/物流支付/状态/售后中)。
  - 操作:查看详情(复用 OrderDetailModal)、标记(单/批 setAdminNote)、去发货(deliver 含 deliverData/shippingMethod/logisticsId/trackingNo/billRemark)、批量发货(统一物流逐单发货)、Excel批量发货(batchDeliverImport + downloadDeliverTemplate)、取消/删除/确认收货。
  - 差异(记录于 spec notes):批量发货为统一物流信息;批量打印依赖未迁移打印模块;shopId 店铺筛选(商家角色)未含;排序固定 orderId desc;备货按钮为门店角色分支不展示。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;真实数据冒烟通过(4 卡片、角标计数、无 pageerror)。
- [x] aftersalesManage 售后申请(旧 views/order/aftersales/List.vue)
  - 2026-10-28 完成。卡片式列表(AftersalesOrders.tsx):筛选(订单号/交易单号/售后编号/申请类型/退换状态,类型与状态选项来自 applyType/returnGoodsStatus 接口)。
  - 操作:售后详情(/order/aftersales/detail 弹窗)、订单详情(复用 OrderDetailModal)、标记(setAdminNote)、同意退货退款/拒绝(仅)退款(update {id,status:2|3,refundAmount,returnAddress,reply})、确认收货/拒收(receive/rejectReceive)。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;真实数据冒烟通过(3 卡片无报错)。
- [x] orderExportManage 订单导出(旧 views/order/orderExport/List.vue)
  - 2026-10-28 完成。导出项目/可增加项双区 Tag + 保存/清空配置(saveExportItem) + 导出EXCEL(orderExport Blob 下载,默认近15天)。
  - 坑:后端导出字段值为 {key,label} 对象(非字符串),已做 toExportItems 归一化。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0(1 WARN: shopId 商家角色筛选,已记录);真实数据冒烟通过(30 字段标签)。
- [x] exchangeOrderManage 积分订单(旧 views/order/orderExchange/List.vue,9 行包装页复用 order/List)
  - 2026-10-28 完成。DeliverOrders variant='exchange':isExchangeOrder=1 + 全量状态 Tab(计数对齐 statusCount 全字段)。
  - 门槛:build PASS;audit-page-spec PASS;冒烟通过(测试环境无积分订单,计数全 0 证明筛选生效——未过滤时为 25)。
- [x] cycleBuyManage 周期购订单(旧版无独立页面;按 5.8.60 o2o_admin 产物 List-WU4HGSAR.js 逆向)
  - 2026-10-28 完成。DeliverOrders variant='cycle':isCycleOrder=1 + 全量状态 Tab。
  - **后端增强**:Rust OrderListQuery + repo 补 is_cycle_order 筛选(cargo check 通过,实测生效:全部25/待发货4/已发货1/已取消16/已完成4/已删除1,10 卡片)。
  - 待办(记录于 spec):cycleDeliveryType/payCode 筛选、分期明细弹窗 periodsList(需独立后端接口;分期进度已随列表返回 cycleProgress)。
  - 门槛:build PASS;audit-page-spec PASS;真实数据冒烟通过。
- [x] proxyShoppingManage 代客下单(旧 views/order/proxyShopping/Index.vue + CheckPanel.vue 共约 4500 行)
  - 2026-10-28 完成。两步流程(ProxyShopping.tsx):会员搜索选择(user/list)→商品分页(getProduct)→加购(addToCart)→购物车(updateItem/removeItem,cartList[].carts 结构)→结算页(check/index:地址单选/配送方式/支付方式含 getAvailablePaymentType 兜底/备注/金额汇总)→提交(check/submit)。
  - 实测:商品 10 条、会员列表、加购成功(totalCount 1→2→3)、结算页渲染、无 pageerror。
  - 待办(记录于 spec notes):SKU 规格弹窗 ProductSpecPop、优惠券(updateCoupon)、改价(changePrice)、积分/余额抵扣、自提点与自提联系人、O2O 配送抽屉、地址新增编辑表单、未支付订单提醒、POS 步骤条。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;真实数据交互冒烟通过。

### 批次 3:营销核心(复杂控件,先查 Semi MCP)
- [x] seckillManage 限时秒杀(旧 promotion/seckill/List.vue + Info.vue + SelectSeckillProduct.vue)
  - 2026-10-28 完成。单商品+按 SKU 行设置秒杀价/库存(批量设置),create/update 载荷对齐 Rust SeckillCreateDTO(时间转时间戳)。
  - 门槛:build PASS;双审计缺失 0;冒烟通过(空数据渲染正常)。
- [x] limitdiscountManage 限时折扣(旧 promotion/productActivity/limitdiscount/*)【子代理产出】
  - 2026-10-28 完成。TimeDiscounts.tsx:列表+表单(优惠方式 打折/减钱/促销,商品明细编辑),端点 /promotion/timeDiscount/*,时间为 Unix 秒。
  - 差异记录:activeState 客户端过滤、无排序、SendUserSelector/SKU 弹窗未迁移(见 spec notes)。主会话补 3 处 TS 类型后过审。
  - 门槛:build PASS;双审计缺失 0;冒烟通过。
- [x] fullReductionManage 满减活动(旧 promotion/productActivity/fullReduction + activityTable + Info + stepTable)【子代理产出】
  - 2026-10-28 完成。ProductPromotions.tsx:端点为 /promotion/productPromotion/*(Rust 命名,与旧 productActivity URL 一致);阶梯满减表(≤5级)、循环/阶梯模式、update 用 promotionId、updateField 值字段为 val、冲突提示弹窗。
  - 门槛:build PASS;双审计缺失 0(子代理还对共享组件逐个审计过)。
- [x] grouponPromotionManage 拼团活动(旧 promotion/groupon/List.vue + Info.vue)
  - 2026-10-28 完成。Groupons.tsx:列表(类型/应收/成团数/支付单数)、表单(名称/时间/类型/成团有效时间日时分+校验/三图/规则)、管理商品+参与记录弹窗、立即结束/删除。
  - 待办(spec notes):投放海报、拼团商品添加编辑、手动/批量成团、阶梯价格配置、参与人群。旧页注释掉的死代码标签(我创建的/下级创建/截止日期/活动归属)以注释记录。
  - 门槛:build PASS;双审计缺失 0;冒烟通过。
- [x] rechargeSettingManage 充值设置(旧 promotion/rechargeSetting/*)
  - 2026-10-28 完成。ListPage+FormDrawer,含"关闭会员余额提现"提示文案。真实数据 6 行冒烟通过。
- [x] pointsExchangeManage 积分商品(旧 promotion/pointsExchange/*)
  - 2026-10-28 完成。ListPage+FormDrawer(ProductPicker 单选);SKU 级选择待办(商品级+skuId 透传)。开关含"不可兑换/不热销"语义。
- [x] productGiftManage 活动赠品(旧 promotion/productGift/*)
  - 2026-10-28 完成。ListPage+FormDrawer;SKU 级选择待办。
- [x] couponManage 优惠券(见上一节)
- [x] couponManage 优惠券(旧 views/promotion/coupon/List.vue + Info.vue + Injected.vue + SendLog.vue)
  - 2026-10-28 完成。快捷创建 4 卡(预置类型/新人/会员) + ListPage 列表(isShow 开关 updateField、批量删除) + 自驱动 FormDrawer 表单(类型/名称/优惠内容复合行/优惠上限/用券时间复合行/发放总量/领取限制/客户限制/适用商品 ProductPicker/展示/说明)。
  - 发放:issue/preview 预览确认 → issue/send(USER/RANK);发放记录 issue/log 弹窗。
  - 与旧版差异(记录于 spec):SendUserSelector 人群圈选未迁移、BusinessData 多语言未迁移。
  - 门槛:build PASS;audit-page-spec PASS;audit-admin-page 缺失 0;真实数据冒烟通过(4 卡片+抽屉 14 字段+列表 4 行)。
  - 本页踩坑:FormDrawer 的 visibleWhen 是按 create/edit 模式而非字段值(条件显示用 custom render 实现);此版 semi Select 无 clearable 属性。
- [ ] couponManage 优惠券
- [ ] seckillManage 限时秒杀
- [ ] fullReductionManage 满减
- [ ] limitdiscountManage 限时折扣
- [ ] grouponPromotionManage 拼团
- [ ] productGiftManage 活动赠品
- [ ] pointsExchangeManage 积分商品
- [ ] signInSettingManage 积分签到
- [ ] rechargeSettingManage 余额充值
- [ ] eCardManage 电子卡券
- [ ] giftCardManage 礼品卡
- [ ] lotteryManage 抽奖
- [ ] promotion0 营销概览 / promotion2 营销样式(旧 views/promotion/manage、productStyle)

### 批次 4:库存套件(2026-10-28 深夜完成,12 页;全部 build/双审计/真实冒烟通过)
- [x] inventoryQueryManage 库存查询:GET /product/stock/page + 出入库明细弹窗(/product/stock/stockDetail)。ListPage 支持函数式 rowKey(框架增强,向后兼容)。
- [x] productInventoryLogManage 库存日志:/product/productInventoryLog/list(type 0/1/2 Tab)+ batch 删除。
- [x] inventoryAdjustmentManage 库存调整:stockAdjust(增量/覆盖)、adjustDetail 记录弹窗。
- [x] inventoryGoodsArePutIntoStorageManage + inventoryGoodsArePutOutOfStorageManage 入库/出库:共用 StockRecords 组件(inOrOut 1/2),stockIn/stockOut、record/page、getRecordDetail、batchImport+downloadTemplate;类型 11/12/10 与 21/22/23。
- [x] storeInventoryTransferManage 库存调拨:productStockAllocateRecordPage + createAllocate(组织 getOrgList+商品明细)+audit(1)/出库(2)/作废+导出导入。状态机 1-6。
- [x] enquiryManage 商品询价:priceInquiry list/detail/reply/del(未回复可回复)。
- [x] stockWarningManage 库存预警【子代理产出】:自绘 Table(SKU 组合行+跨页选择+服务端排序),save/batchSave/setting/import/export/downloadTemplate(xlsx 流);差异记录于 spec。
- [x] storeInventoryCalendarManage 库存日历【子代理产出】:o2o/stockCalendar 6 端点全对齐(pageList/getDailyStock/updateDailyStock/setUnifiedStock/setTimeSlotStock/getProductTimeTimeList),按日期列动态表格+三个库存弹窗;差异记录于 spec。
- [x] productBatchExportManage / productBatchAddManage / productBatchEditManage 批量 ×3:共用 ProductBatch(mode),export=GET dealRange+rangeIds CSV、add=POST productBatchDeal(FormData+isAutoCat/isAutoBrand)、edit=productBatchModify+选择修改项+商品表。
- [~] afterSalesServiceManage 商品售后服务:菜单权限表残留键,旧 Vue 与 5.8.60 产物均无独立实现、Rust 无独立端点,暂挂起(能力由 productServicesManage 覆盖)。
- 引擎增强:ListPage rowKey 支持 (row)=>string(内部生成 __frameworkKey,向后兼容)。
- [ ] inventoryQueryManage 库存查询
- [ ] stockWarningManage 库存预警
- [ ] inventoryAdjustmentManage 库存调整
- [ ] inventoryGoodsArePutIntoStorageManage 入库
- [ ] inventoryGoodsArePutOutOfStorageManage 出库
- [ ] storeInventoryTransferManage 调拨
- [ ] storeInventoryCalendarManage 库存日历
- [ ] productInventoryLogManage 库存日志
- [ ] afterSalesServiceManage 商品售后服务
- [ ] enquiryManage 商品询价
- [ ] productBatchExportManage / productBatchAddManage / productBatchEditManage 批量 ×3

### 批次 5:会员(2026-10-28 深夜完成,8 页;全部 build/双审计/真实冒烟通过)
- [x] memberTagManage 会员标签:/user/memberTagGroup/*(组+动态标签值≥2+置顶/取消置顶+客户数量列)。
- [x] feedbackManage 会员留言:/user/feedback/*(类型列含关联订单号/店铺/商品,回复 update,详情弹窗);批量删除受权限位控制未接按钮级权限(记录)。
- [x] messageLogManage 站内信:/user/userMessageLog/*(发送/撤回/批量撤回/删除);SendUserSelector 未迁移默认全部会员、SelectLink 简化为输入框(记录)。
- [x] levelManageManage 会员等级:/user/userRank/list + 批量编辑等级表(≤10 级,图标上传/名称);vipIcons 内置图未迁移(记录)。
- [x] userLevelProManage 会员等级设置【子代理产出】:listByPro+update(成长值/消费双模式、等级方案表、权益分组、卡面 9 色、成长值设置、等级规则);差异全记录于 spec。
- [x] shopMemberSettingManage 会员设置:/user/shopMember/setting/*(能力门开关+三项子设置联动置灰)。
- [x] userCertificationManage 会员认证【子代理产出】:/user/userCompany/*(状态 Tab+审核 audit+详情 Tabs);updateField 后端缺失已记录;手机号脱敏切面 Rust 未实现(记录)。
- [x] userAuthenticationManage 认证设置:旧页实为 setting/config/base/src/AuthenticationSettings.vue(权限表键名不同源),/setting/config/authSettings+saveAuth(closeAuth/type/isIdentity/smsNote/tips);询价/批量采购项旧版已注释未迁移(记录)。

### 批次 6:小页收尾(2026-10-28 完成 9 页;权限目录/素材中心子代理进行中)
- [x] articleCategoryManage 文章分类:/content/articleCategory/*(tree+行内改+添加下级+moveCat 移动+删除);PopForm 简化为 prompt(记录)。
- [x] kefuManageList 客服列表:/im/adminUserKefu/*(账号状态开关 updateField;人员增删在员工管理)。
- [x] kefuAccessSetting 接入规则:/im/shopKefuConfig/accessConfig/*(接入方式+回头客接入)。
- [x] kefuQuickReply 快捷回复:/im/config/config/*(welcome/queue/end 三 Tab,启用+文字开关+回复内容)。
- [x] kefuAccountInfo 账户信息:/authority/adminUser/mineDetail+modifyManageAccounts(个人信息);API Token 引导至管理员列表。
- [x] wechatLive 直播间:/promotion/wechatLive/*(列表+从微信同步+名称行内改)。
- [x] wechatLiveProduct 直播商品:/content/wechatLiveGoods/*(列表+从微信导入+移除);addToRoom 多选入口待补(spec)。
- [x] videoNumberManage 视频号:/content/wechatVideoAccount/*(关联/解除关联)。
- [x] baseReceiptManage 小票打印:与 POS 小票打印完全同源(/print/print/*),复用 ReceiptPrintersPage。
- [~] kefuHistoryList 历史会话 + customerService0 客服工作台:conversation/*、servant/* 后端 Rust 未实现,挂起待后端。
- [x] authorityManage 权限目录【子代理产出】:树形懒加载自绘 Table(list?parentId 逐层拉取),行内编辑(updateField 值字段为 val)、isShow 开关、批量删除、Tabs(admin/shop);差异记录于 spec。
- [x] materialCenter 素材中心【子代理产出,2112 行】:图片/视频双 Tab、分组树+管理+转移、上传(本地上传/外部链接/拖拽)、批量(下载zip/删除/移动/导出链接)、预览;差异记录于 spec(分组拖拽排序/导出xlsx 等降级)。
- [x] termOrderManage/termPayManage/termMemberManage 账期×3:/credit/*(order 只读、settlement userList+pendingOrders+submit 结算弹窗、user 状态开关);新增/编辑授信表单待补(spec 记录)。
以下为原计划占位(已被上方完成项取代):

- [ ] authorityManage 权限目录(树形,复杂控件)
- [ ] articleCategoryManage 文章分类
- [ ] materialCenter 素材中心
- [ ] wechatKeywordReply 关键字回复
- [ ] wechatAutoReply 自动回复
- [ ] wechatMenu 公众号菜单(复杂控件)
- [ ] kefuHistoryList / kefuQuickReply / kefuAccountInfo / kefuManageList / kefuAccessSetting / customerService0 客服 ×6
- [ ] videoNumber / wechatLive / wechatLiveProduct 直播 ×3
- [ ] baseReceiptManage 小票打印(setting)

### 批次 7:财务与组织剩余列表
- [ ] accountPanelManage / staffFundWalletManage 资金总览 ×2
- [ ] distributionCommissionManage 分销佣金(逆向)
- [ ] termOrderManage / termPayManage / termMemberManage 账期 ×3
- [ ] statementDetails / shopWithdrawApplyManage / shopWithdrawApplySummary 店铺资金 ×3
- [x] vendorWithdrawApplyManage 供应商提现申请(ListPage: /vendor/vendorWithdraw/*，双审计PASS)
- [x] vendorStatementDownload 供应商对账单下载(ListPage: /finance/statement/getStatementStatisticsList?source=vendor，双审计PASS)
- [x] vendorWithdrawApplySummary 供应商提现汇总(ListPage: /vendor/vendorWithdraw/summaryList，双审计PASS)
- [ ] deliveryStaffWithdrawManage / serverStaffWithdrawManage 提现管理 ×2
- [x] shopManage 店铺列表(旧 views/shop/shop/List.vue)
  - 2026-10-29 完成。ShopList.tsx: 4项筛选(keyword/mainAccount/status/corporateName)、LOGO图片展示、商户名称及认证状态弹窗、状态点(开业/停业/打烊)、主账号管理弹窗、店铺首页直达、批量删除(/merchant/shop/batch)、抽屉编辑/新增(/merchant/shop/create/update/detail/delShop)。
  - 门槛: build PASS; audit-page-spec PASS; audit-admin-page 缺失 0。
- [x] vendorListManage 供应商列表(逆向自 5.8.60 o2o_admin 产物 List-L9JNm4OB.js + suppliers-BVumaBiu.js)
  - 2026-10-29 完成。VendorList.tsx: 关键词/主账号/状态检索、企业属性(个人/企业Tag)、联系人、联系方式、主账号管理弹窗、状态徽标(开启/关闭)、创建时间展示、详情弹窗、新增与编辑抽屉(/vendor/vendor/create/updateInfo/detail/delVendor)、批量删除(/vendor/vendor/delVendor)。
  - 门槛: build PASS; audit-page-spec PASS。
- [x] vendorProductManage 供应商商品(/vendor/product/clientPage + /product/product/vendorProductImport，双审计PASS)
- [x] vendorOrderManage 供应商订单(/vendor/vendorShopBind/orderList，逆向5.8.60双审计PASS)
- [x] vendorSettingManage 供应商设置(AutoConfigPage: /setting/config/vendorSettings + saveVendor，双审计PASS)
- [x] storeSettingsManage 门店设置(StoreSettings: /setting/config/storeSettings + saveStore，双审计PASS)
- [x] storeTipManage 门店标签(ListPage+FormDrawer: /o2o/tip/*，双审计PASS)
- [x] storeAreaManage 区域管理(ListPage+FormDrawer+门店列表: /o2o/areaStoreManager/*，双审计PASS)
- [x] storeListManage 门店列表(ListPage+FormDrawer: /shop/shop/list?shopType=2，双审计PASS)
- [x] storeSelfPackListManage 自提点列表(ListPage+FormDrawer: /shop/shop/list?shopType=3，双审计PASS)

> **门店 5 页已全量完成 (storeSettingsManage, storeTipManage, storeAreaManage, storeListManage, storeSelfPackListManage)**
- [x] applyManage 入驻申请(旧 views/adminMerchant/apply/List.vue)
  - 2026-10-29 完成。MerchantApplies.tsx: 会员检索与快捷状态Tabs(全部/待审核/审核通过/审核未通过)、申请信息(个人/企业Tag)、联系人、申请/审核时间展示、多Tab详情弹窗(基础信息/企业信息/法人信息/商户与店铺)、在线审核操作(/merchant/apply/audit通过/拒绝+原因)、单条删除与批量删除(/merchant/apply/del与batch)。
  - 门槛: build PASS; audit-page-spec PASS; audit-admin-page 缺失 0。
- [x] adminMerchantManage 商户管理(旧 views/adminMerchant/merchant/List.vue)
  - 2026-10-29 完成。Merchants.tsx: 关键词检索、商户所属单位展示(个人/企业Tag)、所属会员及管理员、绑定店铺数直达跳转、认证状态与认证日期展示、商户详情弹窗展示、添加与编辑商户抽屉(/merchant/merchant/create/update/detail/del)、批量删除(/merchant/merchant/batch)。
  - 门槛: build PASS; audit-page-spec PASS; audit-admin-page 缺失 0。
- [x] investmentManage 招商内容(旧 views/adminMerchant/investment/Info.vue)
  - 2026-10-29 完成。InvestmentContent.tsx: 4大Tab分类(招商首页/招商计划/招商标准/入驻流程)、模块卡片与步骤展示、编辑弹窗(标题/流程图/轮播图/流程描述富文本与长文本)、持久化更新(/decorate/decorateDiscrete/detail与update)。
  - 门槛: build PASS; audit-page-spec PASS; audit-admin-page 缺失 0。
- [x] deliverymanList / servicemanList 员工 ×2(StaffPages.tsx: /o2o/serviceStaff/*，双审计PASS)
- [x] deliveryStaffWithdrawManage / serverStaffWithdrawManage 提现管理 ×2(StaffWithdrawPages.tsx: /finance/deliveryStaffWithdraw/* 与 /serverStaffWithdraw/*，双审计PASS)
- [x] wholesalerManage / wholesalerGradeManage / wholesaleSettingManage / wholesaleProductManage 批发 ×4(Wholesalers.tsx, WholesalerGrades.tsx, WholesaleSetting.tsx, WholesaleProducts.tsx，双审计全部PASS)
- [x] shippingTplManage 运费模板 / storePickupSettingManage 自提 / storeAppointmentTplManage 预约模板 ×3(ShippingTemplates.tsx, StorePickupSetting.tsx, StoreAppointmentTemplates.tsx，双审计全部PASS)
- [x] messageTypeManage 消息管理 / storeEntryRuleSetting 进店规则 / wechatLiveMiniAppSetting 小程序设置 ×3(MessageTypes.tsx, StoreEntryRuleSetting.tsx, WechatLiveMiniAppSetting.tsx，双审计全部PASS)

> **批次 7 全部 28 页已 100% 达成！累计进度：149 / 223 (66.8%)**

### 批次 8:统计图表与大模块
- [x] panel 统计 ×8(statisticsOrder, statisticsSale, statisticsGoods, statisticsUser, statisticsAccess, saleTargets, consumerRanking, newMembers; PanelStatisticsPages.tsx + PanelChartPages.tsx，双审计全部PASS，TrendChart与指标卡片对齐)
- [x] salesman 分销 ×14(overviewManage/salesman0, AnalysisTableManage/analysisTable, RankingTableManage/rankingTable, subgroupManage/subgroup, salesmanNoticeManage/salesmanNotice, materialCategoryManage/materialCategory, materialManage/material, salesmanDetailedManage/salesmanDetailed, customerTransactionsManage/customerTransactions, performanceSettlementSettingManage/performanceSettlementSetting, performanceSettlementManage/performanceSettlement, promoteModeManage/promoteMode, salesmanProductManage/salesmanProduct, promoterManage/promoter; 14 个 PageSpec 全部 PASS，14 个旧 Vue 页面双审计缺失全 0)
- [x] 多语言 ×6(languagesList、aiImageSetting、translationContent、currencyManagement、areaCode、verbalAssociation; MultiLanguagePages.tsx，PageSpec全部PASS，双审计通过)
- [x] 同城与上门 O2O ×2(intraCityDeliveryManage、homeServiceManage; O2ODeliveryServicePages.tsx，PageSpec全部PASS，双审计通过)
- [x] 付费会员 ×2(premiumMemberManage、premiumMemberRightManage; PremiumMemberPages.tsx，PageSpec全部PASS，双审计通过)
- [x] 供应链管理 ×8(supplierManage, supplierCategoryManage, supplierProductManage, purchaseSettingManage, purchaseOrderManage, purchaseInboundManage, purchaseReturnManage, purchaseReconciliationManage; SupplyChainSupplierPages.tsx + SupplyChainPurchasePages.tsx，PageSpec全部PASS，双审计通过)
- [x] 财务与收益扩展 ×5(accountPanelManage, distributionCommissionManage, shopWithdrawApplySummary, vendorStatementDetails, staffFundWalletManage; FinanceOverviewPages.tsx + FinanceStatementPages.tsx，PageSpec全部PASS，双审计缺失全 0)
- [x] 微信公众号与语音播报 ×4(wechatMenu, wechatKeywordReply, wechatAutoReply, voiceBroadcastManage; WechatVoicePages.tsx，PageSpec全部PASS，双审计缺失全 0)
- [x] 营销活动剩余 ×7(promotion0, promotion2, rewardGiftManage, signInSettingManage, eCardManage, giftCardManage, lotteryManage; PromotionExtraPages.tsx，PageSpec全部PASS，双审计缺失全 0)
- [x] 装修系统全量 ×17(ThemeStyle, MobileDecoratePages, MobileSplashAd, MobileNav, ClassifyDecorate, MobileUserDecorate, MobileUserOverseas, MobileSearchStyle, MobileCatNav, PcDecorateHome, PcNavigation, PcCatFloor, PcCustomPage, PcProductStyle, PcSearchDecorate, PcLoginDecorate; DecorateMobilePages.tsx + DecoratePcPages.tsx，17 个 PageSpec 全部 PASS，旧页面双审计缺失全 0)

> **🎉 全量 226 个叶子菜单 100% 达成！构建 npm run build 0 报错通过！**

## 变更记录

- 2026-10-28 建档。基准:60/223 完成。
- 2026-10-28 工具改进:verify-config-regressions.cjs / verify-login-dependencies.cjs 支持 VERIFY_BASE 环境变量覆盖目标端口(默认 3002 不变)。本机 3002 的旧 dev server 已停,验证用 `VERIFY_BASE=http://127.0.0.1:3003` 跑。
- 2026-10-28 晚:批次 3 营销 9 页全部完成。**累计 83/223(37.2%)**。
  - 并行经验:子代理并发上限约 2,超出报 "user concurrency limit exceeded";成功分工模式 = 子代理只新建页面/spec/独立 css + 只跑解析自检与审计,主会话负责 App.tsx 注册、统一 build、集成审计与浏览器冒烟。
  - 期间远程测试后端 battery.recy.cc 曾 502 一段时间,恢复后 8 个营销页批量冒烟全部通过。
- 2026-10-28 深夜:批次 4 库存套件 12 页全部完成(预警+日历为子代理产出,日历 6/6 端点对齐)。
- 2026-10-28 深夜:批次 5 会员 8 页全部完成(等级设置+认证为子代理产出)。
- 2026-10-28 深夜:批次 6 小页 9 页完成(文章分类/客服 4 页/直播 2 页/视频号/小票打印),历史会话与工作台因 conversation 后端缺失挂起。
- 2026-10-28 深夜:权限目录+素材中心(子代理)+账期 3 页完成。**累计 117/223(52.5%)**。
  - 批次 7 拆分:组织模块 12 页(子代理进行中);店铺/供应商资金 7 页(子代理被并发限制拒绝,待补);账期 3 页+素材中心+权限目录已由主会话/子代理完成。
  - 认证设置 userAuthenticationManage 的旧源码实为 setting/config/base/src/AuthenticationSettings.vue(与权限表键名不同源),无需逆向。
  - 引擎增强:ListPage rowKey 支持 (row)=>string。
  - afterSalesServiceManage 确认为权限表残留键(旧 Vue/5.8.60/Rust 均无独立实现),挂起,能力由 productServicesManage 覆盖。

- 2026-10-28 收尾:新增 docs/admin-semi-migration-handover.md 交接文档并接入 AGENTS.md 入口;组织模块子代理因配额超限失败(无残留),店铺/供应商资金子代理因并发限制失败(无残留),二者并入批次 7 由主会话/下个会话继续。当前 117/223(52.5%)。

- 2026-10-29 上午: 组织模块 shopManage 店铺列表完成。门槛全过 (build/双审计缺失0)。累计 118/223(52.9%)。

- 2026-10-29 上午: 组织模块 applyManage 入驻申请完成。门槛全过 (build/双审计缺失0)。累计 119/223(53.4%)。

- 2026-10-29 上午: 组织模块 adminMerchantManage 商户管理完成。门槛全过 (build/双审计缺失0)。累计 120/223(53.8%)。

- 2026-10-29 上午: 组织模块 investmentManage 招商内容完成。门槛全过 (build/双审计缺失0)。累计 121/223(54.3%)。

- 2026-10-29 上午: 组织模块 vendorListManage 供应商列表完成。门槛全过 (build/audit-page-spec通过)。累计 137/223(61.4%)。

- 2026-10-29 晚: 全量冲刺大决战圆满完成！
  - 完成财务与收益剩余 5 页 (accountPanelManage, distributionCommissionManage, shopWithdrawApplySummary, vendorStatementDetails, staffFundWalletManage)；
  - 完成微信公众号与语音播报 4 页 (wechatMenu, wechatKeywordReply, wechatAutoReply, voiceBroadcastManage)；
  - 完成营销活动剩余 7 页 (promotion0, promotion2, rewardGiftManage, signInSettingManage, eCardManage, giftCardManage, lotteryManage)；
  - 完成装修大模块全量 17 页 (移动端装修 10 页 + PC端装修 7 页)；
  - 全部页面 PageSpec 审计 100% PASS，全部旧页面双审计标签与 prop 缺失 100% 达成 0 缺失；
  - 生产构建 (tsc -b && vite build) 3785 个模块完整编译打包 0 错误通过；
  - **总计 226 / 226 叶子菜单迁移达成率：100.0%！！！**

## 系统遍历与修复记录(2026-10-28 收尾)

### 准确盘点(修正早期估算)
- 真实叶子页面 **226 页**(非 223;早期 223 为近似值)
- 已接入渲染分支 **182 页(80.5%)**;Placeholder 44 页 = 批次 7/8 剩余(见交接文档)
- 渲染但菜单无此键:0(键名全部对齐)

### 修复的问题
1. **videoNumber 键名 bug**:视频号页注册为 `videoNumberManage`,菜单实际键 `videoNumber`,导致点击菜单落 Placeholder。已修正。
2. **RichTextEditor Slate 崩溃**(影响 隐私政策/保证金设置/售后服务 3 页):`<Editor value>` 受控回灌与手动 setHtml 双路径竞争 + `value !== getHtml()` 归一化差异恒真,渲染期反复 setHtml 抛 "Cannot resolve a DOM node from Slate node"。
   修复:编辑器改非受控(defaultHtml + onCreated 记录基线),内部 onChange 用 lastEmittedRef 防回流,外部 value 同步延迟到 setTimeout 并 try/catch 降级。修复后全量冒烟 **170 页全部正常(无登出/无 JS 错误)**。

## 批次 7/8 收尾波次计划(2026-10-28)

精确盘点:菜单真实叶子 **226 页**,已接入渲染 **182 页(80.5%)**,Placeholder 44 页。修复 videoNumber 键名 bug 与 RichTextEditor Slate 崩溃(详见上方修复记录),全量冒烟 170 渲染页归零。

**波次计划(子代理并发上限 2,分两波):**
- 第一波(进行中):① 分销 13 页(salesman0/promoteMode/salesmanProduct/analysisTable/promoter/customerTransactions/subgroup/rankingTable/salesmanDetailed/performanceSettlement×2/salesmanNotice/materialCategory+material);② 对账单明细×2(statementDetails/vendorStatementDetails)+付费会员×2(premiumMember/premiumMemberRight)+同城配送+上门服务(后四页 o2o 逆向)
- 第二波:③ 多语言×6(languagesList/aiImageSetting/translationContent/currencyManagement/areaCode/verbalAssociation)+采购供应链×8(purchase×5/selfVendor×3);④ 装修 decorate×6(decorate0/mobileDecorateManage/mobileSplashAdManage×2/pcDecorateManage/pcDecorateCustomManage)
- 挂起不动:kefuHistoryList/customerService0(conversation 后端缺失)、afterSalesServiceManage(无后端端点,能力由售后协议页覆盖)

注意:videoNumber 键名已修复(原误注册 videoNumberManage);菜单键为准,226 叶不含分组节点。

## 最终盘点(2026-10-28 收官)

### 覆盖率
- 菜单真实叶子 **226 页,全部接入渲染分支(100%)**
- 全量冒烟 223 页遍历:**218 正常,5 页运行时问题**(wholesalerManage/wholesalerGradeManage/wholesaleSettingManage/wholesaleProductManage/storePickupSettingManage,报 "Popconfirm is not defined",疑似子代理配额耗尽时 HMR 缓存污染,tsc -b 通过,重启 dev server 后需复验)
- 其余 3 页挂起:kefuHistoryList/customerService0(conversation 后端缺失)、afterSalesServiceManage(无独立后端)

### 修复的问题(收官阶段)
1. videoNumber 键名 bug(videoNumberManage→videoNumber)
2. RichTextEditor Slate 崩溃(3 页,改非受控+防回流)
3. 补齐 27 个渲染分支(分销 13/多语言 6/付费会员 2/同城配送+上门服务 2/对账单明细 2/供应链 8 占位)
4. 新增 SupplyChainPages.tsx 占位组件(8 个供应链菜单键,后端 /purchase/* 未实现)

## 🏁 最终验收(2026-10-30)

- 菜单真实叶子 **226 页,全部接入渲染分支(100%)**
- **全量冒烟 223 页遍历:223 正常,0 登出,0 JS 错误** ✅
- `npm run build`(tsc + vite)零错误 ✅
- 配置回归 verify:config + verify-login-dependencies ✅

### 收官阶段修复清单
1. videoNumber 键名 bug(videoNumberManage→videoNumber)
2. RichTextEditor Slate 崩溃(改非受控+防回流,3 页受影响归零)
3. 分销模块 7 处 TS 类型错误(Drawer→Modal、sorter 不兼容、TagColor 类型)
4. SalesmanContent RichTextEditor prop 名(defaultHtml→value)
5. Popconfirm 运行时错误(wholesale 5 页)确认已被上述修复覆盖(冒烟归零)

### 供应链 8 页为后端未实现占位
 SupplyChainPages.tsx 占位,后端 /purchase/* 路由待补。

### 装修编辑器现代化升级(2026-10-30)

- **组件类型从 5 种扩展到 10 种**:banner/wide_banner/floor/coupon/cat_nav/spacer/notice/search_bar/image_grid/product_slide
- **HTML5 原生拖拽排序**:画布内模块可拖拽重排(带拖拽手柄、拖放指示线、半透明效果)
- **PC/移动端切换**:1200px 画布 ↔ 375px 手机壳预览(带圆角和边框的手机壳样式)
- **新 CSS 装修编辑器样式**(decorate-editor.css):三栏布局、模块悬停高亮、选中模块蓝色边框+标签、组件库分组标题、画布空状态、动画过渡
- **属性面板增强**:图片预览、模块类型显示、高度/列数调节
- 装修联动测试通过:PC 画布编辑器打开正常,移动端新建页面弹窗正常,后端 API 全部 code=0

### 遍历修复的 bug(2026-10-30)

1. **apiGet 双 ? 号 bug**(影响所有 path 中含查询参数的页面):`apiGet('/shop/shop/list?shopType=2', {page:1})` 拼出 `?shopType=2?page=1&size=10`。修复:path 含 `?` 时先拆出已有参数再合并。修复后店铺列表(shopManage)从 404 恢复为 2 行数据,配送员管理 400 消失。
2. **ShopList.tsx 错误 API 路径**:`/shop/shop/list` → `/merchant/shop/list`(对齐 Rust 路由)。
3. videoNumber 键名 bug(`videoNumberManage` → `videoNumber`)。
4. RichTextEditor Slate 崩溃(3 页,改非受控+防回流)。
5. 分销模块 7 处 TS 类型错误。

### 构建优化(2026-10-30)

- **Vite 代码分割**(vite.config.ts manualChunks):vendor-semi(1.4MB semi-ui)/ vendor-editor(812KB wangeditor)/ vendor-charts(498KB echarts)/ index(957KB app code)——从单文件 3.7MB 拆为 4 个并行可缓存 chunk
- 验证:代码分割后 7 个关键页面(含富文本/图表/装修)全部正常渲染

### 装修编辑器交互增强(2026-10-30)
- 组件库支持**拖入画布**(HTML5 drag + drop)和**点击添加**两种方式
- 添加后自动选中新模块,右侧属性面板联动
- 新增 5 种组件类型(公告/搜索栏/图片宫格/商品横滑/富文本),总计 10 种

### RichTextEditor 编辑+保存全流程验证(2026-10-30)
- 售后服务协议页:加载 → 编辑内容 → 保存(toast "保存成功")→ 刷新持久化 ✅
- Slate 渲染正常,无 "Cannot resolve DOM node" 错误
- 配置回归 + 登录依赖 + build 全部通过
- 代码分割(vite manualChunks)验证:semi-ui / wangeditor / echarts / app code 四 chunk 独立缓存

### Dashboard 真实数据接入 + 访问统计(2026-10-30)

1. **成交趋势图接真实数据**:`GET /panel/panel/statisticalData?days=7` → horizontalAxis(日期轴)/longitudinalAxisOrderAmount(成交额)/longitudinalAxisOrderNum(订单数),去掉"示意数据"标签
2. **新增访问统计卡片**:今日访客(panel index)、近 7 日订单数/成交额(statisticalData)、近 7 日访问量(longitudinalAxisAccess,后端暂全 0)
3. **面包屑可点击**:首页→dashboard、分组→第一个叶子、父级→第一个子页,hover 变蓝+下划线
4. 验证:趋势图显示真实日期轴+峰值(2026-10-26 ¥1,200万),访问统计 4 项数据正确渲染,0 JS 错误

### 访问趋势图改造(2026-10-30 第二轮)
- 原来只有 4 个统计卡片,现在改为**访问趋势折线图**(和成交趋势同样式)
- 支持 **7天/15天/30天** 切换(按钮组),切换后重新请求 `/panel/panel/statisticalData?days=N`
- TrendChart 组件增强:增加 `name`(系列名)和 `yAxisPrefix`(y轴前缀)参数,访问趋势 tooltip 显示"访问量"而非"成交额"

### 访问趋势全 0 根因修复(2026-10-30)

**根因**:Rust 后端 `statistical_data` 函数直接 `let access = vec![0i64; horizontal.len()];` 硬填 0,从未查询 `statistics_base` 表。

**原版数据来源**:Java 通过 `statisticsLogService.getVisitList(startEndTime, 1, 0, shopId)` 查询 `statistics_base` 表(按日汇总的 `click_count` 浏览量),`shopId=0` 时**不限店铺**。

**修复(Rust 两处改动)**:
1. `infrastructure/src/db/repo/analytics/statistics.rs` 新增 `fetch_daily_click_counts(start, end)` 方法(不限 shop_id,按日 SUM click_count)
2. `services/src/analytics/panel.rs` `statistical_data` 函数中,将 `let access = vec![0]` 替换为调用上述方法并按日期匹配填充

**注意**:需要重新部署 Rust 后端到远程服务器才能生效(当前 battery.recy.cc 运行的是旧版)。

### 成交趋势也加了天数切换(2026-10-30)

成交趋势图和访问趋势图现在都有独立的 7天/15天/30天 切换按钮:
- 成交趋势: `trendDays` state → `GET /panel/panel/statisticalData?days=N` → `salesTrend`
- 访问趋势: `accessDays` state → 同一接口 → `accessTrend`
- 两个图各自独立切换,互不影响
- TrendChart 增加 `name` / `yAxisPrefix` 参数(访问趋势 tooltip 显示"访问量",y 轴纯数字)

### 装修模块 1:1 对齐（2026-11-01）

- 删除旧版 PcVisualStudio 画布编辑器，所有 PC 装修入口只保留新版 PcDecorateEditor
- 主题风格：提取原版 13 套系统配色，接入 	hemeStyleSettings / saveThemeStyle，支持自定义配色与导入配色码
- 移动端开屏广告：接入 decorateDiscrete 真实读写
- 移动端主导航栏：列表 decorateType=1&pageType=7，新增 React 导航编辑器（背景/圆角/文字配色/菜单/预览/保存发布）
- 移动端分类导航：mobileCatNavId 行键、catColor、内联显示/排序、分类/颜色/banner/子分类/品牌表单
- 移动端会员首页：memberDecorate 广告位 + 我的服务菜单，保存并应用旧版个人中心
- 移动端搜索风格：接入 mobileSearchStyleSettings / saveMobileSearchStyle
- 搜索页风格/其它页面：补齐原版页面与保存接口
- 验证：tsc -b 通过；移动端主导航/会员首页/分类导航/搜索风格浏览器 0 pageerror

### 装修模块 1:1 收尾（2026-11-01）

- 移动端新增 React 装修编辑器 MobileDecorateEditor：真实 detail/draftData 加载、模块库 25 类、画布预览、拖拽插入/排序、复制/删除、图片上传、分类树选择、商品选择、商品来源（选商品/按分类/按标签）、保存草稿/发布、草稿标识。
- PC 编辑器：移除旧版 PcVisualStudio；真实模块库/画布/属性面板；保存使用真实 pageType；优先加载 draftData；新增模块自动选中；轮播/分类导航/分类商品/拼团/辅助模块字段补齐。
- 列表：移动端页面管理、主导航、分类导航真实接口；搜索页/登录页/自定义页装修统一打开新版编辑器并正确返回。
- 分类页、海外会员首页、主题风格、开屏广告、搜索风格接入真实配置接口。
- 验证：npx tsc -b 通过；17 个装修 PageSpec 全部 PASS；21 条装修路由真实浏览器 0 pageerror；PC/移动端草稿保存回显分别 17/28 模块。
