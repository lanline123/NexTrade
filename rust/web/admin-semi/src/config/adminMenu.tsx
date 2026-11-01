import type { ReactNode } from 'react';
import {
  IconApartment, IconApps, IconBox, IconComment, IconCreditCard, IconFile, IconGift,
  IconHome, IconIdCard, IconLive, IconOrderedList, IconServer, IconSetting, IconShare,
  IconShoppingBag, IconUser,
} from '@douyinfe/semi-icons';

export interface NavItem {
  key: string;
  label: string;
  children?: NavItem[];
}

export interface NavGroup {
  key: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
}

/** 由原版 authority 表导出的三级菜单树。 */
export const navGroups: NavGroup[] = [
  {
    "key": "customerService",
    "label": "客服",
    "icon": <IconComment />,
    "items": [
      {
        "key": "customerService0",
        "label": "客服工作台"
      },
      {
        "key": "customerService1",
        "label": "历史会话",
        "children": [
          {
            "key": "kefuHistoryList",
            "label": "历史会话列表"
          }
        ]
      },
      {
        "key": "customerService2",
        "label": "个人设置",
        "children": [
          {
            "key": "kefuQuickReply",
            "label": "快捷回复"
          },
          {
            "key": "kefuAccountInfo",
            "label": "账户信息"
          }
        ]
      },
      {
        "key": "customerService3",
        "label": "客服管理",
        "children": [
          {
            "key": "kefuManageList",
            "label": "客服列表"
          }
        ]
      },
      {
        "key": "customerService4",
        "label": "系统设置",
        "children": [
          {
            "key": "kefuSetting",
            "label": "客服设置"
          },
          {
            "key": "kefuAccessSetting",
            "label": "接入规则"
          }
        ]
      }
    ]
  },
  {
    "key": "pos",
    "label": "收银",
    "icon": <IconShoppingBag />,
    "items": [
      {
        "key": "pos0",
        "label": "收银工作台"
      },
      {
        "key": "pos1",
        "label": "收银设置",
        "children": [
          {
            "key": "posOrderSetting",
            "label": "收银设置"
          },
          {
            "key": "posCashierDeviceList",
            "label": "设备管理"
          },
          {
            "key": "posReceiptPrint",
            "label": "小票打印"
          }
        ]
      },
      {
        "key": "pos2",
        "label": "收银员管理",
        "children": [
          {
            "key": "posCashierList",
            "label": "收银员列表"
          }
        ]
      }
    ]
  },
  {
    "key": "panel",
    "label": "面板",
    "icon": <IconHome />,
    "items": [
      {
        "key": "dashboard",
        "label": "概览"
      },
      {
        "key": "panel1",
        "label": "销售统计",
        "children": [
          {
            "key": "statisticsOrder",
            "label": "销售概览"
          },
          {
            "key": "statisticsSale",
            "label": "销售明细"
          },
          {
            "key": "saleTargets",
            "label": "销售指标"
          },
          {
            "key": "statisticsGoods",
            "label": "销售排行"
          }
        ]
      },
      {
        "key": "panel2",
        "label": "用户统计",
        "children": [
          {
            "key": "statisticsUser",
            "label": "用户概览"
          },
          {
            "key": "statisticsAccess",
            "label": "访问统计"
          },
          {
            "key": "consumerRanking",
            "label": "消费排行"
          },
          {
            "key": "newMembers",
            "label": "新增会员"
          }
        ]
      }
    ]
  },
  {
    "key": "organize",
    "label": "组织",
    "icon": <IconApartment />,
    "items": [
      {
        "key": "organize0",
        "label": "店铺管理",
        "children": [
          {
            "key": "shopManage",
            "label": "店铺列表"
          },
          {
            "key": "shopGroupManage",
            "label": "店铺分组"
          },
          {
            "key": "shopSettingsManage",
            "label": "店铺设置"
          },
          {
            "key": "shopTipManage",
            "label": "标签管理"
          }
        ]
      },
      {
        "key": "organize1",
        "label": "供应商管理",
        "children": [
          {
            "key": "vendorProductManage",
            "label": "供应商商品"
          },
          {
            "key": "vendorOrderManage",
            "label": "供应商订单"
          },
          {
            "key": "vendorListManage",
            "label": "供应商列表"
          },
          {
            "key": "vendorSettingManage",
            "label": "供应商设置"
          }
        ]
      },
      {
        "key": "organize2",
        "label": "门店管理",
        "children": [
          {
            "key": "storeListManage",
            "label": "门店列表"
          },
          {
            "key": "storeSettingsManage",
            "label": "门店设置"
          },
          {
            "key": "storeAreaManage",
            "label": "区域管理"
          },
          {
            "key": "storeTipManage",
            "label": "标签管理"
          }
        ]
      },
      {
        "key": "organize3",
        "label": "自提点管理",
        "children": [
          {
            "key": "storeSelfPackListManage",
            "label": "自提点列表"
          }
        ]
      },
      {
        "key": "organize4",
        "label": "员工管理",
        "children": [
          {
            "key": "deliverymanList",
            "label": "配送员管理"
          },
          {
            "key": "servicemanList",
            "label": "服务员管理"
          }
        ]
      },
      {
        "key": "organize5",
        "label": "商户管理",
        "children": [
          {
            "key": "applyManage",
            "label": "入驻申请"
          },
          {
            "key": "adminMerchantManage",
            "label": "商户管理"
          },
          {
            "key": "investmentManage",
            "label": "招商内容"
          },
          {
            "key": "adminMerchantSettingsManage",
            "label": "商户设置"
          }
        ]
      }
    ]
  },
  {
    "key": "live",
    "label": "直播",
    "icon": <IconLive />,
    "items": [
      {
        "key": "live0",
        "label": "小程序直播",
        "children": [
          {
            "key": "wechatLive",
            "label": "直播间"
          },
          {
            "key": "wechatLiveProduct",
            "label": "直播商品"
          }
        ]
      },
      {
        "key": "live1",
        "label": "视频号",
        "children": [
          {
            "key": "videoNumber",
            "label": "视频号列表"
          }
        ]
      }
    ]
  },
  {
    "key": "product",
    "label": "商品",
    "icon": <IconShoppingBag />,
    "items": [
      {
        "key": "product0",
        "label": "商品管理",
        "children": [
          {
            "key": "products",
            "label": "商品列表"
          },
          {
            "key": "categoryManage",
            "label": "商品类目"
          },
          {
            "key": "brandManage",
            "label": "商品品牌"
          },
          {
            "key": "productGroupManage",
            "label": "商品分组"
          },
          {
            "key": "commentManage",
            "label": "商品评价"
          },
          {
            "key": "productAttributesTplManage",
            "label": "属性模板"
          },
          {
            "key": "productServicesManage",
            "label": "商品服务"
          },
          {
            "key": "afterSalesServiceManage",
            "label": "商品售后服务"
          }
        ]
      },
      {
        "key": "product1",
        "label": "批量操作",
        "children": [
          {
            "key": "productBatchExportManage",
            "label": "批量导出"
          },
          {
            "key": "productBatchAddManage",
            "label": "批量上传"
          },
          {
            "key": "productBatchEditManage",
            "label": "批量修改"
          }
        ]
      },
      {
        "key": "product2",
        "label": "库存管理",
        "children": [
          {
            "key": "storeInventoryCalendarManage",
            "label": "库存日历"
          },
          {
            "key": "inventoryQueryManage",
            "label": "库存查询"
          },
          {
            "key": "inventoryGoodsArePutIntoStorageManage",
            "label": "商品入库"
          },
          {
            "key": "inventoryGoodsArePutOutOfStorageManage",
            "label": "商品出库"
          },
          {
            "key": "inventoryAdjustmentManage",
            "label": "库存调整"
          },
          {
            "key": "storeInventoryTransferManage",
            "label": "库存调拨"
          },
          {
            "key": "productInventoryLogManage",
            "label": "库存日志"
          },
          {
            "key": "stockWarningManage",
            "label": "库存预警"
          }
        ]
      },
      {
        "key": "product3",
        "label": "询价管理",
        "children": [
          {
            "key": "enquiryManage",
            "label": "商品询价"
          }
        ]
      }
    ]
  },
  {
    "key": "promotion",
    "label": "营销",
    "icon": <IconGift />,
    "items": [
      {
        "key": "promotion0",
        "label": "营销概览"
      },
      {
        "key": "promotion1",
        "label": "营销管理",
        "children": [
          {
            "key": "couponManage",
            "label": "优惠券"
          },
          {
            "key": "seckillManage",
            "label": "限时秒杀"
          },
          {
            "key": "fullReductionManage",
            "label": "满减活动"
          },
          {
            "key": "rewardGiftManage",
            "label": "满赠活动"
          },
          {
            "key": "limitdiscountManage",
            "label": "限时折扣"
          },
          {
            "key": "grouponPromotionManage",
            "label": "拼团活动"
          },
          {
            "key": "productGiftManage",
            "label": "活动赠品"
          },
          {
            "key": "pointsExchangeManage",
            "label": "积分商品"
          },
          {
            "key": "signInSettingManage",
            "label": "积分签到"
          },
          {
            "key": "rechargeSettingManage",
            "label": "余额充值"
          },
          {
            "key": "eCardManage",
            "label": "电子卡券"
          },
          {
            "key": "buyerShowManage",
            "label": "买家秀"
          },
          {
            "key": "giftCardManage",
            "label": "礼品卡"
          },
          {
            "key": "lotteryManage",
            "label": "抽奖"
          }
        ]
      },
      {
        "key": "promotion2",
        "label": "营销样式"
      }
    ]
  },
  {
    "key": "order",
    "label": "订单",
    "icon": <IconOrderedList />,
    "items": [
      {
        "key": "order0",
        "label": "订单管理",
        "children": [
          {
            "key": "orders",
            "label": "全部订单"
          },
          {
            "key": "cycleBuyManage",
            "label": "周期购订单"
          },
          {
            "key": "deliverManage",
            "label": "发货管理"
          },
          {
            "key": "exchangeOrderManage",
            "label": "积分订单"
          },
          {
            "key": "orderExportManage",
            "label": "订单导出"
          },
          {
            "key": "proxyShoppingManage",
            "label": "代客下单"
          }
        ]
      },
      {
        "key": "order1",
        "label": "售后管理",
        "children": [
          {
            "key": "aftersalesManage",
            "label": "售后申请"
          }
        ]
      }
    ]
  },
  {
    "key": "supplyChain",
    "label": "供应链",
    "icon": <IconServer />,
    "items": [
      {
        "key": "supplyChain0",
        "label": "采购管理",
        "children": [
          {
            "key": "purchaseOrderManage",
            "label": "采购订单"
          },
          {
            "key": "purchaseReceiptManage",
            "label": "采购入库单"
          },
          {
            "key": "purchaseReturnManage",
            "label": "采购退货单"
          },
          {
            "key": "purchaseReconciliationManage",
            "label": "采购对账单"
          }
        ]
      },
      {
        "key": "supplyChain1",
        "label": "供应商管理",
        "children": [
          {
            "key": "selfVendorManage",
            "label": "供应商资料"
          },
          {
            "key": "selfVendorCategoryManage",
            "label": "供应商分类"
          },
          {
            "key": "selfVendorProductManage",
            "label": "供应商商品"
          }
        ]
      },
      {
        "key": "supplyChain2",
        "label": "设置",
        "children": [
          {
            "key": "purchaseSettingManage",
            "label": "采购设置"
          }
        ]
      }
    ]
  },
  {
    "key": "decorate",
    "label": "装修",
    "icon": <IconApps />,
    "items": [
      {
        "key": "decorate0",
        "label": "主题风格"
      },
      {
        "key": "decorate1",
        "label": "移动端装修",
        "children": [
          {
            "key": "mobileDecorateManage",
            "label": "页面管理"
          },
          {
            "key": "mobileSplashAdManage",
            "label": "开屏广告"
          },
          {
            "key": "mobileSplashAdManage2",
            "label": "开屏广告"
          },
          {
            "key": "mobileuserUserOverseasManage",
            "label": "会员首页"
          },
          {
            "key": "mobileSearchStyleManage",
            "label": "搜索风格"
          },
          {
            "key": "mobileNavManage",
            "label": "主导航栏"
          },
          {
            "key": "classifyManage",
            "label": "分类页"
          },
          {
            "key": "mobileUserManage",
            "label": "会员首页"
          },
          {
            "key": "mobileCatNavManage",
            "label": "分类导航"
          }
        ]
      },
      {
        "key": "decorate2",
        "label": "PC端装修",
        "children": [
          {
            "key": "pcDecorateManage",
            "label": "首页装修"
          },
          {
            "key": "pcNavigationManage",
            "label": "导航栏"
          },
          {
            "key": "pcCatFloorManage",
            "label": "分类抽屉"
          },
          {
            "key": "pcDecorateCustomManage",
            "label": "自定义页装修"
          },
          {
            "key": "pcProductStyleManage",
            "label": "商品页风格"
          },
          {
            "key": "pcSearchDecorateManage",
            "label": "搜索页装修"
          },
          {
            "key": "pcLoginDecorateManage",
            "label": "登录页装修"
          }
        ]
      }
    ]
  },
  {
    "key": "salesman",
    "label": "分销",
    "icon": <IconShare />,
    "items": [
      {
        "key": "salesman0",
        "label": "分销概览"
      },
      {
        "key": "salesman1",
        "label": "分销设置",
        "children": [
          {
            "key": "promoteModeManage",
            "label": "分销模式"
          }
        ]
      },
      {
        "key": "salesman2",
        "label": "分销商品",
        "children": [
          {
            "key": "salesmanProductManage",
            "label": "商品佣金管理"
          },
          {
            "key": "analysisTableManage",
            "label": "成交分析"
          }
        ]
      },
      {
        "key": "salesman3",
        "label": "分销员",
        "children": [
          {
            "key": "promoterManage",
            "label": "分销员管理"
          },
          {
            "key": "customerTransactionsManage",
            "label": "客户成交"
          },
          {
            "key": "subgroupManage",
            "label": "分销员分组"
          },
          {
            "key": "rankingTableManage",
            "label": "分销员排行"
          },
          {
            "key": "salesmanDetailedManage",
            "label": "分销员明细"
          }
        ]
      },
      {
        "key": "salesman4",
        "label": "分销结算",
        "children": [
          {
            "key": "performanceSettlementSettingManage",
            "label": "结算方案设置"
          },
          {
            "key": "performanceSettlementManage",
            "label": "业绩结算"
          }
        ]
      },
      {
        "key": "salesman5",
        "label": "内容管理",
        "children": [
          {
            "key": "salesmanNoticeManage",
            "label": "分销攻略"
          },
          {
            "key": "materialCategoryManage",
            "label": "素材分类"
          },
          {
            "key": "materialManage",
            "label": "素材管理"
          }
        ]
      }
    ]
  },
  {
    "key": "content",
    "label": "内容",
    "icon": <IconFile />,
    "items": [
      {
        "key": "content0",
        "label": "素材管理",
        "children": [
          {
            "key": "materialCenter",
            "label": "素材中心"
          }
        ]
      },
      {
        "key": "content1",
        "label": "文章管理",
        "children": [
          {
            "key": "content",
            "label": "文章列表"
          },
          {
            "key": "articleCategoryManage",
            "label": "文章分类"
          }
        ]
      },
      {
        "key": "content2",
        "label": "协议管理",
        "children": [
          {
            "key": "serviceAgreement",
            "label": "服务协议"
          },
          {
            "key": "privacyAgreement",
            "label": "隐私政策"
          },
          {
            "key": "afterSaleService",
            "label": "售后服务"
          }
        ]
      }
    ]
  },
  {
    "key": "finance",
    "label": "财务",
    "icon": <IconCreditCard />,
    "items": [
      {
        "key": "finance0",
        "label": "会员资金管理",
        "children": [
          {
            "key": "accountPanelManage",
            "label": "资金总览"
          },
          {
            "key": "distributionCommissionManage",
            "label": "分销佣金"
          },
          {
            "key": "userWithdrawApplyManage",
            "label": "提现管理"
          },
          {
            "key": "userRechargeOrderManage",
            "label": "充值管理"
          },
          {
            "key": "integralLogManage",
            "label": "积分日志"
          }
        ]
      },
      {
        "key": "finance1",
        "label": "分账管理",
        "children": [
          {
            "key": "profitsharingSettingManage",
            "label": "分账设置"
          },
          {
            "key": "withdrawalSettingManage",
            "label": "提现设置"
          },
          {
            "key": "categoryFeeRuleManage",
            "label": "服务费率"
          },
          {
            "key": "merchantApplicationManage",
            "label": "进件管理"
          },
          {
            "key": "subMerchantManage",
            "label": "子商户管理"
          },
          {
            "key": "profitSharingSettlementManage",
            "label": "分账结算"
          }
        ]
      },
      {
        "key": "finance2",
        "label": "店铺资金管理",
        "children": [
          {
            "key": "statementDownload",
            "label": "对账单下载"
          },
          {
            "key": "statementDetails",
            "label": "对账单明细"
          },
          {
            "key": "shopWithdrawApplyManage",
            "label": "提现管理"
          },
          {
            "key": "shopWithdrawApplySummary",
            "label": "提现汇总"
          }
        ]
      },
      {
        "key": "finance3",
        "label": "供应商资金管理",
        "children": [
          {
            "key": "vendorAccountManage",
            "label": "资金概览"
          },
          {
            "key": "vendorFundsManage",
            "label": "供应商资金"
          },
          {
            "key": "vendorStatementDownload",
            "label": "对账单下载"
          },
          {
            "key": "vendorStatementDetails",
            "label": "对账单明细"
          },
          {
            "key": "vendorWithdrawApplyManage",
            "label": "提现管理"
          },
          {
            "key": "vendorWithdrawApplySummary",
            "label": "提现汇总"
          },
          {
            "key": "vendorFinancialLogManage",
            "label": "资金日志"
          }
        ]
      },
      {
        "key": "financeOrderAudit",
        "label": "订单审核",
        "children": [
          {
            "key": "offlinePaymentClaimManage",
            "label": "线下收款审核"
          }
        ]
      },
      {
        "key": "finance4",
        "label": "账期支付",
        "children": [
          {
            "key": "termOrderManage",
            "label": "账期支付订单"
          },
          {
            "key": "termPayManage",
            "label": "账期结算"
          },
          {
            "key": "termMemberManage",
            "label": "授信客户"
          }
        ]
      },
      {
        "key": "finance5",
        "label": "发票管理",
        "children": [
          {
            "key": "userInvoiceManage",
            "label": "资质审核"
          },
          {
            "key": "orderInvoiceManage",
            "label": "发票申请"
          }
        ]
      },
      {
        "key": "finance6",
        "label": "保证金管理",
        "children": [
          {
            "key": "depositSettingManage",
            "label": "保证金设置"
          },
          {
            "key": "depositRuleManage",
            "label": "保证金规则"
          },
          {
            "key": "depositPayeeAccountManage",
            "label": "保证金账户"
          },
          {
            "key": "depositAccountManage",
            "label": "保证金查询"
          },
          {
            "key": "depositPaymentAuditManage",
            "label": "款项审核"
          },
          {
            "key": "depositLogManage",
            "label": "交易明细"
          }
        ]
      },
      {
        "key": "finance7",
        "label": "退款管理",
        "children": [
          {
            "key": "refundApplyManage",
            "label": "退款申请"
          },
          {
            "key": "refundLogManage",
            "label": "退款日志"
          }
        ]
      },
      {
        "key": "finance8",
        "label": "交易管理",
        "children": [
          {
            "key": "payLogManage",
            "label": "交易日志"
          },
          {
            "key": "userBalanceLogManage",
            "label": "余额日志"
          }
        ]
      },
      {
        "key": "finance9",
        "label": "员工收益管理",
        "children": [
          {
            "key": "deliveryFundSettingsManage",
            "label": "配送设置"
          },
          {
            "key": "serverFundSettingsManage",
            "label": "服务设置"
          },
          {
            "key": "staffFundWalletManage",
            "label": "资金总览"
          },
          {
            "key": "staffFundWalletLogManage",
            "label": "资金日志"
          },
          {
            "key": "deliveryStaffWithdrawManage",
            "label": "配送员提现管理"
          },
          {
            "key": "serverStaffWithdrawManage",
            "label": "服务员提现管理"
          }
        ]
      }
    ]
  },
  {
    "key": "user",
    "label": "会员",
    "icon": <IconUser />,
    "items": [
      {
        "key": "user0",
        "label": "会员管理",
        "children": [
          {
            "key": "members",
            "label": "会员列表"
          },
          {
            "key": "userLevelProManage",
            "label": "会员等级设置"
          },
          {
            "key": "levelManageManage",
            "label": "会员等级设置"
          },
          {
            "key": "shopMemberSettingManage",
            "label": "会员设置"
          },
          {
            "key": "feedbackManage",
            "label": "会员留言"
          },
          {
            "key": "memberTagManage",
            "label": "会员标签"
          }
        ]
      },
      {
        "key": "user1",
        "label": "实名认证",
        "children": [
          {
            "key": "userAuthenticationManage",
            "label": "认证设置"
          },
          {
            "key": "userCertificationManage",
            "label": "会员认证"
          }
        ]
      },
      {
        "key": "user2",
        "label": "消息管理",
        "children": [
          {
            "key": "messageLogManage",
            "label": "站内信"
          }
        ]
      },
      {
        "key": "user3",
        "label": "付费会员",
        "children": [
          {
            "key": "premiumMemberManage",
            "label": "付费会员"
          },
          {
            "key": "premiumMemberRightManage",
            "label": "权益中心"
          }
        ]
      }
    ]
  },
  {
    "key": "authority",
    "label": "权限",
    "icon": <IconIdCard />,
    "items": [
      {
        "key": "authority0",
        "label": "管理员",
        "children": [
          {
            "key": "adminUserManage",
            "label": "管理员列表"
          },
          {
            "key": "adminRoleManage",
            "label": "角色列表"
          },
          {
            "key": "accountManage",
            "label": "账号管理"
          },
          {
            "key": "adminLogManage",
            "label": "操作日志"
          }
        ]
      },
      {
        "key": "authority1",
        "label": "系统权限",
        "children": [
          {
            "key": "authorityManage",
            "label": "权限目录"
          }
        ]
      }
    ]
  },
  {
    "key": "wholesale",
    "label": "批发",
    "icon": <IconBox />,
    "items": [
      {
        "key": "wholesale0",
        "label": "批发商",
        "children": [
          {
            "key": "wholesalerManage",
            "label": "批发商列表"
          },
          {
            "key": "wholesalerGradeManage",
            "label": "等级管理"
          },
          {
            "key": "wholesaleSettingManage",
            "label": "批发设置"
          }
        ]
      },
      {
        "key": "wholesale1",
        "label": "批发商品",
        "children": [
          {
            "key": "wholesaleProductManage",
            "label": "批发商品列表"
          }
        ]
      }
    ]
  },
  {
    "key": "setting",
    "label": "设置",
    "icon": <IconSetting />,
    "items": [
      {
        "key": "setting0",
        "label": "商城设置",
        "children": [
          {
            "key": "baseBasicManage",
            "label": "基础信息"
          },
          {
            "key": "baseProductManage",
            "label": "商品设置"
          },
          {
            "key": "baseShoppingManage",
            "label": "交易设置"
          },
          {
            "key": "baseOrderManage",
            "label": "订单设置"
          },
          {
            "key": "baseReceiptManage",
            "label": "小票打印"
          },
          {
            "key": "personalizedManage",
            "label": "个性化设置"
          },
          {
            "key": "taxRateManage",
            "label": "税率管理"
          },
          {
            "key": "imageSearchManage",
            "label": "图像搜索"
          },
          {
            "key": "wechatLiveMiniAppSetting",
            "label": "小程序设置"
          },
          {
            "key": "storeEntryRuleSetting",
            "label": "进店规则"
          }
        ]
      },
      {
        "key": "setting1",
        "label": "配送设置组",
        "children": [
          {
            "key": "logisticsManage",
            "label": "配送设置"
          },
          {
            "key": "storePickupSettingManage",
            "label": "自提设置"
          },
          {
            "key": "storeAppointmentTplManage",
            "label": "预约模板"
          },
          {
            "key": "intraCityDeliveryManage",
            "label": "同城配送"
          },
          {
            "key": "storeAmapSetting",
            "label": "地图设置"
          },
          {
            "key": "homeServiceManage",
            "label": "上门服务"
          },
          {
            "key": "logisticsCompanyManage",
            "label": "物流公司"
          },
          {
            "key": "shippingTypeManage",
            "label": "配送类型"
          },
          {
            "key": "shippingTplManage",
            "label": "运费模板"
          },
          {
            "key": "logisticsCompanyConfigManage",
            "label": "物流设置"
          }
        ]
      },
      {
        "key": "setting2",
        "label": "系统设置",
        "children": [
          {
            "key": "globalSetting",
            "label": "全局设置"
          },
          {
            "key": "loginSetting",
            "label": "登录设置"
          },
          {
            "key": "paymentSetting",
            "label": "支付设置"
          },
          {
            "key": "appVersionManage",
            "label": "APP版本"
          },
          {
            "key": "regionManage",
            "label": "地区管理"
          },
          {
            "key": "friendLinksManage",
            "label": "友情链接"
          }
        ]
      },
      {
        "key": "setting3",
        "label": "多语言管理",
        "children": [
          {
            "key": "languagesListManage",
            "label": "语言管理"
          },
          {
            "key": "aiImageSettingManage",
            "label": "图片智能处理"
          },
          {
            "key": "translationContentManage",
            "label": "翻译内容维护"
          },
          {
            "key": "currencyManagementManage",
            "label": "币种管理"
          },
          {
            "key": "areaCodeManage",
            "label": "区号管理"
          },
          {
            "key": "verbalAssociationManage",
            "label": "语言关联设置"
          }
        ]
      },
      {
        "key": "setting4",
        "label": "消息设置",
        "children": [
          {
            "key": "baseNoticeManage",
            "label": "通知设置"
          },
          {
            "key": "messageTypeManage",
            "label": "消息管理"
          },
          {
            "key": "voiceBroadcastManage",
            "label": "语音播报"
          }
        ]
      },
      {
        "key": "setting5",
        "label": "微信公众号",
        "children": [
          {
            "key": "wechatMenu",
            "label": "公众号菜单"
          },
          {
            "key": "wechatKeywordReply",
            "label": "关键字回复"
          },
          {
            "key": "wechatAutoReply",
            "label": "自动回复设置"
          }
        ]
      }
    ]
  }
];

export const pageTitles: Record<string, string> = {
  "customerService0": "客服工作台",
  "kefuHistoryList": "历史会话列表",
  "kefuQuickReply": "快捷回复",
  "kefuAccountInfo": "账户信息",
  "kefuManageList": "客服列表",
  "kefuSetting": "客服设置",
  "kefuAccessSetting": "接入规则",
  "pos0": "收银工作台",
  "posOrderSetting": "收银设置",
  "posCashierDeviceList": "设备管理",
  "posReceiptPrint": "小票打印",
  "posCashierList": "收银员列表",
  "dashboard": "概览",
  "statisticsOrder": "销售概览",
  "statisticsSale": "销售明细",
  "saleTargets": "销售指标",
  "statisticsGoods": "销售排行",
  "statisticsUser": "用户概览",
  "statisticsAccess": "访问统计",
  "consumerRanking": "消费排行",
  "newMembers": "新增会员",
  "shopManage": "店铺列表",
  "shopGroupManage": "店铺分组",
  "shopTipManage": "标签管理",
  "offlinePaymentClaimManage": "线下收款审核",
  "imageSearchManage": "图像搜索",
  "vendorAccountManage": "资金概览",
  "vendorFundsManage": "供应商资金",
  "vendorFinancialLogManage": "资金日志",
  "shopSettingsManage": "店铺设置",
  "vendorProductManage": "供应商商品",
  "vendorOrderManage": "供应商订单",
  "vendorListManage": "供应商列表",
  "vendorSettingManage": "供应商设置",
  "storeListManage": "门店列表",
  "storeSettingsManage": "门店设置",
  "storeAreaManage": "区域管理",
  "storeTipManage": "标签管理",
  "storeSelfPackListManage": "自提点列表",
  "deliverymanList": "配送员管理",
  "servicemanList": "服务员管理",
  "applyManage": "入驻申请",
  "adminMerchantManage": "商户管理",
  "investmentManage": "招商内容",
  "adminMerchantSettingsManage": "商户设置",
  "wechatLive": "直播间",
  "wechatLiveProduct": "直播商品",
  "videoNumber": "视频号列表",
  "products": "商品列表",
  "categoryManage": "商品类目",
  "brandManage": "商品品牌",
  "productGroupManage": "商品分组",
  "commentManage": "商品评价",
  "productAttributesTplManage": "属性模板",
  "productServicesManage": "商品服务",
  "afterSalesServiceManage": "商品售后服务",
  "productBatchExportManage": "批量导出",
  "productBatchAddManage": "批量上传",
  "productBatchEditManage": "批量修改",
  "storeInventoryCalendarManage": "库存日历",
  "inventoryQueryManage": "库存查询",
  "inventoryGoodsArePutIntoStorageManage": "商品入库",
  "inventoryGoodsArePutOutOfStorageManage": "商品出库",
  "inventoryAdjustmentManage": "库存调整",
  "storeInventoryTransferManage": "库存调拨",
  "productInventoryLogManage": "库存日志",
  "stockWarningManage": "库存预警",
  "enquiryManage": "商品询价",
  "promotion0": "营销概览",
  "couponManage": "优惠券",
  "seckillManage": "限时秒杀",
  "fullReductionManage": "满减活动",
  "rewardGiftManage": "满赠活动",
  "limitdiscountManage": "限时折扣",
  "grouponPromotionManage": "拼团活动",
  "productGiftManage": "活动赠品",
  "pointsExchangeManage": "积分商品",
  "signInSettingManage": "积分签到",
  "rechargeSettingManage": "余额充值",
  "eCardManage": "电子卡券",
  "buyerShowManage": "买家秀",
  "giftCardManage": "礼品卡",
  "lotteryManage": "抽奖",
  "promotion2": "营销样式",
  "orders": "全部订单",
  "cycleBuyManage": "周期购订单",
  "deliverManage": "发货管理",
  "exchangeOrderManage": "积分订单",
  "orderExportManage": "订单导出",
  "proxyShoppingManage": "代客下单",
  "aftersalesManage": "售后申请",
  "purchaseOrderManage": "采购订单",
  "purchaseReceiptManage": "采购入库单",
  "purchaseReturnManage": "采购退货单",
  "purchaseReconciliationManage": "采购对账单",
  "selfVendorManage": "供应商资料",
  "selfVendorCategoryManage": "供应商分类",
  "selfVendorProductManage": "供应商商品",
  "purchaseSettingManage": "采购设置",
  "decorate": "装修",
  "decorate0": "主题风格",
  "decorate1": "移动端装修",
  "decorate2": "PC端装修",
  "mobileDecorateManage": "页面管理",
  "mobileSplashAdManage": "开屏广告",
  "mobileSplashAdManage2": "开屏广告",
  "mobileuserUserOverseasManage": "会员首页",
  "mobileSearchStyleManage": "搜索风格",
  "mobileNavManage": "主导航栏",
  "classifyManage": "分类页",
  "mobileUserManage": "会员首页",
  "mobileCatNavManage": "分类导航",
  "pcDecorate": "首页装修",
  "pcDecorateManage": "首页装修",
  "pcDecorateEdit": "PC可视化装修设计器",
  "pcNavigationManage": "导航栏",
  "pcCatFloorManage": "分类抽屉",
  "pcDecorateCustomManage": "自定义页装修",
  "pcProductStyleManage": "商品页风格",
  "pcSearchDecorateManage": "搜索页装修",
  "pcLoginDecorateManage": "登录页装修",
  "salesman0": "分销概览",
  "promoteModeManage": "分销模式",
  "salesmanProductManage": "商品佣金管理",
  "analysisTableManage": "成交分析",
  "promoterManage": "分销员管理",
  "customerTransactionsManage": "客户成交",
  "subgroupManage": "分销员分组",
  "rankingTableManage": "分销员排行",
  "salesmanDetailedManage": "分销员明细",
  "performanceSettlementSettingManage": "结算方案设置",
  "performanceSettlementManage": "业绩结算",
  "salesmanNoticeManage": "分销攻略",
  "materialCategoryManage": "素材分类",
  "materialManage": "素材管理",
  "materialCenter": "素材中心",
  "content": "文章列表",
  "articleCategoryManage": "文章分类",
  "serviceAgreement": "服务协议",
  "privacyAgreement": "隐私政策",
  "afterSaleService": "售后服务",
  "accountPanelManage": "资金总览",
  "distributionCommissionManage": "分销佣金",
  "userWithdrawApplyManage": "提现管理",
  "userRechargeOrderManage": "充值管理",
  "integralLogManage": "积分日志",
  "profitsharingSettingManage": "分账设置",
  "withdrawalSettingManage": "提现设置",
  "categoryFeeRuleManage": "服务费率",
  "merchantApplicationManage": "进件管理",
  "subMerchantManage": "子商户管理",
  "profitSharingSettlementManage": "分账结算",
  "statementDownload": "对账单下载",
  "statementDetails": "对账单明细",
  "shopWithdrawApplyManage": "提现管理",
  "shopWithdrawApplySummary": "提现汇总",
  "vendorWithdrawApplySummary": "提现汇总",
  "vendorStatementDownload": "对账单下载",
  "vendorStatementDetails": "对账单明细",
  "vendorWithdrawApplyManage": "提现管理",
  "termOrderManage": "账期支付订单",
  "termPayManage": "账期结算",
  "termMemberManage": "授信客户",
  "userInvoiceManage": "资质审核",
  "orderInvoiceManage": "发票申请",
  "depositSettingManage": "保证金设置",
  "depositRuleManage": "保证金规则",
  "depositPayeeAccountManage": "保证金账户",
  "depositAccountManage": "保证金查询",
  "depositPaymentAuditManage": "款项审核",
  "depositLogManage": "交易明细",
  "refundApplyManage": "退款申请",
  "refundLogManage": "退款日志",
  "payLogManage": "交易日志",
  "userBalanceLogManage": "余额日志",
  "deliveryFundSettingsManage": "配送设置",
  "serverFundSettingsManage": "服务设置",
  "staffFundWalletManage": "资金总览",
  "staffFundWalletLogManage": "资金日志",
  "deliveryStaffWithdrawManage": "配送员提现管理",
  "serverStaffWithdrawManage": "服务员提现管理",
  "members": "会员列表",
  "userLevelProManage": "会员等级设置",
  "levelManageManage": "会员等级设置",
  "shopMemberSettingManage": "会员设置",
  "feedbackManage": "会员留言",
  "memberTagManage": "会员标签",
  "userAuthenticationManage": "认证设置",
  "userCertificationManage": "会员认证",
  "messageLogManage": "站内信",
  "premiumMemberManage": "付费会员",
  "premiumMemberRightManage": "权益中心",
  "adminUserManage": "管理员列表",
  "adminRoleManage": "角色列表",
  "accountManage": "账号管理",
  "adminLogManage": "操作日志",
  "authorityManage": "权限目录",
  "wholesalerManage": "批发商列表",
  "wholesalerGradeManage": "等级管理",
  "wholesaleSettingManage": "批发设置",
  "wholesaleProductManage": "批发商品列表",
  "baseBasicManage": "基础信息",
  "baseProductManage": "商品设置",
  "baseShoppingManage": "交易设置",
  "baseOrderManage": "订单设置",
  "baseReceiptManage": "小票打印",
  "personalizedManage": "个性化设置",
  "taxRateManage": "税率管理",
  "wechatLiveMiniAppSetting": "小程序设置",
  "storeEntryRuleSetting": "进店规则",
  "logisticsManage": "配送设置",
  "storePickupSettingManage": "自提设置",
  "storeAppointmentTplManage": "预约模板",
  "intraCityDeliveryManage": "同城配送",
  "storeAmapSetting": "地图设置",
  "homeServiceManage": "上门服务",
  "logisticsCompanyManage": "物流公司",
  "shippingTypeManage": "配送类型",
  "shippingTplManage": "运费模板",
  "logisticsCompanyConfigManage": "物流设置",
  "globalSetting": "全局设置",
  "loginSetting": "登录设置",
  "paymentSetting": "支付设置",
  "appVersionManage": "APP版本",
  "regionManage": "地区管理",
  "friendLinksManage": "友情链接",
  "languagesListManage": "语言管理",
  "aiImageSettingManage": "图片智能处理",
  "translationContentManage": "翻译内容维护",
  "currencyManagementManage": "币种管理",
  "areaCodeManage": "区号管理",
  "verbalAssociationManage": "语言关联设置",
  "baseNoticeManage": "通知设置",
  "messageTypeManage": "消息管理",
  "voiceBroadcastManage": "语音播报",
  "wechatMenu": "公众号菜单",
  "wechatKeywordReply": "关键字回复",
  "wechatAutoReply": "自动回复设置"
};
