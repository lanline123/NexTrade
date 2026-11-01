import { useEffect, useState } from 'react';
import { apiGet, clearToken, enterDemo, getToken, isDemo } from './api';
import { applyAppearance, type AppearanceSettings } from './theme';
import AdminLayout, { type PageKey } from './layout/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Members from './pages/Members';
import Content from './pages/Content';
import Brands from './pages/Brands';
import ProductGroups from './pages/ProductGroups';
import Categories from './pages/Categories';
import ProductServices from './pages/ProductServices';
import Comments from './pages/Comments';
import AttributesTemplates from './pages/AttributesTemplates';
import FriendLinks from './pages/FriendLinks';
import Regions from './pages/Regions';
import LogisticsCompanies from './pages/LogisticsCompanies';
import AppVersion from './pages/AppVersion';
import AdminLogs from './pages/AdminLogs';
import AdminUsers from './pages/AdminUsers';
import Roles from './pages/Roles';
import AgreementPage from './pages/AgreementPage';
import AccountManage from './pages/AccountManage';
import TaxRates from './pages/TaxRates';
import ShippingTypes from './pages/ShippingTypes';
import ShippingSettingsPage from './pages/ShippingSettings';
import AutoConfigPage, { type ConfigFieldGroup, type ConfigFieldRule } from './pages/AutoConfigPage';
import LogisticsSettings from './pages/LogisticsSettings';
import PayLogs from './pages/PayLogs';
import RefundLogs from './pages/RefundLogs';
import BalanceLogs from './pages/BalanceLogs';
import StaffWalletLogs from './pages/StaffWalletLogs';
import BuyerShow from './pages/BuyerShow';
import IntegralLogs from './pages/IntegralLogs';
import { RefundApplyList, WithdrawApplyList, RechargeOrderList, UserInvoiceList, OrderInvoiceList } from './pages/FinanceLists';
import { DepositRules, DepositAccounts, DepositQuery, DepositAudit, DepositLogs, CategoryFeeRules, MerchantApplications, SubMerchants, ProfitSharing, StatementDownload } from './pages/FinanceMoreLists';
import { PosWorkbench, CashierDevices } from './pages/PosPages';
import PosCashierList from './pages/PosCashierList';
import ReceiptPrintersPage from './pages/ReceiptPrinters';
import PaymentSettings from './pages/PaymentSettings';
import WithdrawalSettings from './pages/WithdrawalSettings';
import ProfitSharingSettings from './pages/ProfitSharingSettings';
import DepositSettings from './pages/DepositSettings';
import ShopSettings from './pages/ShopSettings';
import StoreSettings from './pages/StoreSettings';
import StoreTips from './pages/StoreTips';
import StoreAreas from './pages/StoreAreas';
import StoreList from './pages/StoreList';
import SelfPackList from './pages/SelfPackList';
import { DeliverymanList, ServicemanList } from './pages/StaffPages';
import { DeliveryStaffWithdraw, ServerStaffWithdraw } from './pages/StaffWithdrawPages';
import { Wholesalers } from './pages/Wholesalers';
import { WholesalerGrades } from './pages/WholesalerGrades';
import { WholesaleSetting } from './pages/WholesaleSetting';
import { WholesaleProducts } from './pages/WholesaleProducts';
import { StorePickupSetting } from './pages/StorePickupSetting';
import { StoreAppointmentTemplates } from './pages/StoreAppointmentTemplates';
import { StoreEntryRuleSetting } from './pages/StoreEntryRuleSetting';
import { WechatLiveMiniAppSetting } from './pages/WechatLiveMiniAppSetting';
import { ShippingTemplates } from './pages/ShippingTemplates';
import { MessageTypes } from './pages/MessageTypes';
import SalesmanOverview, { SalesmanAnalysisTable, SalesmanRankingTable } from './pages/SalesmanOverview';
import SalesmanSubgroup from './pages/SalesmanSubgroup';
import { SalesmanNotice, SalesmanMaterialCategory, SalesmanMaterial } from './pages/SalesmanContent';
import { SalesmanDetailed, CustomerTransactions } from './pages/SalesmanDetailedPages';
import { SalesmanSettlementSetting, SalesmanPerformanceSettlement } from './pages/SalesmanSettlementPages';
import { SalesmanPromoteMode, SalesmanProducts, SalesmanPromoters } from './pages/SalesmanPromoteAndProducts';
import {
  LanguagesList,
  CurrencyManagement,
  TranslationContent,
  VerbalAssociation,
  AreaCode,
  AiImageSetting,
} from './pages/MultiLanguagePages';
import {
  IntraCityDelivery,
  HomeService,
} from './pages/O2ODeliveryServicePages';
import {
  PremiumMembers,
  PremiumMemberRights,
} from './pages/PremiumMemberPages';
import {
  SupplierList,
  SupplierCategories,
  SupplierProducts,
  PurchaseSetting,
} from './pages/SupplyChainSupplierPages';
import {
  PurchaseOrders,
  PurchaseInbound,
  PurchaseReturns,
  PurchaseReconciliation,
} from './pages/SupplyChainPurchasePages';
import {
  ShopTipManage,
  ShopGroupManage,
  OfflinePaymentClaimManage,
  ImageSearchManage,
  VendorAccountManage,
  VendorFundsManage,
  VendorFinancialLogManage,
} from './pages/OverseasExtraPages';
import PcDecorateEditor from './pages/PcDecorateEditor';
import {
  AccountPanel,
  DistributionCommission,
  ShopWithdrawApplySummary,
  StaffFundWallet,
} from './pages/FinanceOverviewPages';
import {
  WechatMenu,
  WechatKeywordReply,
  WechatAutoReply,
  VoiceBroadcast,
} from './pages/WechatVoicePages';
import {
  PromotionOverview,
  PromotionStyle,
  RewardGift,
  SignInSetting,
  ECard,
  GiftCard,
  Lottery,
} from './pages/PromotionExtraPages';
import {
  ThemeStyle,
  MobileDecoratePages,
  MobileSplashAd,
  MobileNav,
  ClassifyDecorate,
  MobileUserDecorate,
  MobileUserOverseas,
  MobileSearchStyle,
  MobileCatNav,
} from './pages/DecorateMobilePages';
import {
  PcDecorateHome,
  PcNavigation,
  PcCatFloor,
  PcCustomPage,
  PcProductStyle,
  PcSearchDecorate,
  PcLoginDecorate,
} from './pages/DecoratePcPages';
import {
  ConsumerRanking,
  SaleTargets,
  StatisticsGoods,
  StatisticsUser,
} from './pages/PanelStatisticsPages';
import {
  NewMembers,
  StatisticsAccess,
  StatisticsOrder,
  StatisticsSale,
} from './pages/PanelChartPages';
import {
  StatementDetails,
  ShopWithdrawApplies,
  VendorWithdrawApplies,
  VendorStatementDownload,
  VendorWithdrawSummary,
} from './pages/FinanceStatementPages';
import AdminMerchantSettings from './pages/AdminMerchantSettings';
import StaffFundSettings from './pages/StaffFundSettings';
import DeliverOrders from './pages/DeliverOrders';
import AftersalesOrders from './pages/AftersalesOrders';
import OrderExport from './pages/OrderExport';
import ProxyShopping from './pages/ProxyShopping';
import Coupons from './pages/Coupons';
import RechargeSettings from './pages/RechargeSettings';
import PointsExchanges from './pages/PointsExchanges';
import ProductGifts from './pages/ProductGifts';
import Seckills from './pages/Seckills';
import TimeDiscounts from './pages/TimeDiscounts';
import ProductPromotions from './pages/ProductPromotions';
import Groupons from './pages/Groupons';
import InventoryQuery from './pages/InventoryQuery';
import ProductInventoryLogs from './pages/ProductInventoryLogs';
import InventoryAdjustments from './pages/InventoryAdjustments';
import StockRecords from './pages/StockRecords';
import InventoryTransfers from './pages/InventoryTransfers';
import Enquiries from './pages/Enquiries';
import StockWarnings from './pages/StockWarnings';
import UserCertifications from './pages/UserCertifications';
import MemberTags from './pages/MemberTags';
import Feedbacks from './pages/Feedbacks';
import MessageLogs from './pages/MessageLogs';
import MemberLevels from './pages/MemberLevels';
import ShopMemberSettings from './pages/ShopMemberSettings';
import UserAuthenticationSettings from './pages/UserAuthenticationSettings';
import MemberLevelPros from './pages/MemberLevelPros';
import ArticleCategories from './pages/ArticleCategories';
import KefuList from './pages/KefuList';
import KefuAccessSettings from './pages/KefuAccessSettings';
import KefuQuickReplies from './pages/KefuQuickReplies';
import KefuAccountInfo from './pages/KefuAccountInfo';
import WechatLives from './pages/WechatLives';
import WechatLiveGoods from './pages/WechatLiveGoods';
import VideoNumbers from './pages/VideoNumbers';
import Authorities from './pages/Authorities';
import MaterialCenter from './pages/MaterialCenter';
import SupplyChainPage from './pages/SupplyChainPages';
import { CreditOrders, CreditUsers, CreditSettlements } from './pages/CreditPages';
import ProductBatch from './pages/ProductBatch';
import InventoryCalendars from './pages/InventoryCalendars';
import ShopList from './pages/ShopList';
import MerchantApplies from './pages/MerchantApplies';
import Merchants from './pages/Merchants';
import InvestmentContent from './pages/InvestmentContent';
import VendorList from './pages/VendorList';
import VendorProducts from './pages/VendorProducts';
import VendorOrders from './pages/VendorOrders';
import Placeholder from './pages/Placeholder';
import { pageTitles } from './config/adminMenu';
import { configSections } from './config/configSections';
import { configHelp } from './config/configHelp';

type ConfigPageDef = {
  title: string;
  getApi: string;
  saveApi: string;
  sections?: Array<{ title: string; fields: string[] }>;
  rules?: Record<string, ConfigFieldRule>;
  fieldGroups?: ConfigFieldGroup[];
  controls?: Record<string, 'radio' | 'switch' | 'segmented' | 'color' | 'options'>;
  options?: Record<string, Array<{ label: string; value: string | number; color?: string }>>;
  hiddenFields?: string[];
  fieldHelp?: Record<string, string>;
};

const configPages: Record<string, ConfigPageDef> = {
  storeSettingsManage: {
    title: '门店设置',
    getApi: '/setting/config/storeSettings',
    saveApi: '/setting/config/saveStore',
    controls: {
      storePostAllocationStatus: 'radio',
      storeIndependentGoods: 'switch',
      shopProductNeedCheck: 'switch',
      storeAssignProductName: 'switch',
      storeAssignProductImage: 'switch',
      storeAssignProductPrice: 'radio',
      storeUseSoloProductStock: 'switch',
      storeUseTotalProductStock: 'switch',
      storeAssignDeliveryServiceFee: 'radio',
      storeAssignServerServiceFee: 'radio',
      storeCustomSubmitShippingType: 'radio',
      storeShowOtherCityStore: 'radio',
    },
    options: {
      storePostAllocationStatus: [
        { label: '上架', value: 1 },
        { label: '下架', value: 0 },
      ],
      storeAssignProductPrice: [
        { label: '使用总部/区域统一售价', value: 0 },
        { label: '使用门店独立售价', value: 1 },
      ],
      storeAssignDeliveryServiceFee: [
        { label: '使用总部统一配置', value: 0 },
        { label: '使用门店独立配置', value: 1 },
      ],
      storeAssignServerServiceFee: [
        { label: '使用总部统一配置', value: 0 },
        { label: '使用门店独立配置', value: 1 },
      ],
      storeCustomSubmitShippingType: [
        { label: '自提优先', value: 0 },
        { label: '配送优先', value: 1 },
        { label: '同城优先', value: 2 },
      ],
      storeShowOtherCityStore: [
        { label: '显示', value: 1 },
        { label: '不显示', value: 0 },
      ],
    },
    rules: {
      shopProductNeedCheck: { visibleWhen: { field: 'storeIndependentGoods', equals: 1 } },
    },
    fieldHelp: {
      maxRecommendProductCount: '商城中新品、推荐列表显示的商品数量',
      maxSubAdministrator: '当前店铺可配置的最大子管理员数',
      storePostAllocationStatus: '在将商品分配到组织时，可预设分配成功后商品在组织的上下架状态。',
      storeIndependentGoods: '开启后允许门店自建商品，关闭后门店不可自行创建商品。',
      shopProductNeedCheck: '门店发布商品的时候是否需要审核才能显示商品。开启为默认审核通过。',
      storeAssignProductName: '勾选后，门店可修改总部/区域分配商品的名称，不同步至门店。',
      storeAssignProductImage: '勾选后，门店可修改总部/区域分配商品的主图和详情页。',
      storeAssignProductPrice: '用统一售价时，门店商品销售价将取总部/区域设置的统一售价，门店不可修改。',
      storeAssignDeliveryServiceFee: '用统一配置时，门店配送费将取总部统一配置，门店端不可修改。',
      storeAssignServerServiceFee: '用统一配置时，门店服务费将取总部统一配置，门店端不可修改。',
      storeCustomSubmitShippingType: '商品存在多种配送方式时客户下单默认优先采用的方式。',
      storeShowOtherCityStore: '是否在地区中展示其他城市的门店。',
    },
  },

  vendorSettingManage: {
    title: '供应商设置',
    getApi: '/setting/config/vendorSettings',
    saveApi: '/setting/config/saveVendor',
    sections: [
      {
        title: '基本设置',
        fields: ['vendorProductNeedCheck', 'vendorMaxSubAdministrator'],
      },
      {
        title: '价格设置',
        fields: ['vendorSetPriceType', 'vendorSetPriceAutoValue'],
      },
    ],
    controls: {
      vendorProductNeedCheck: 'switch',
      vendorSetPriceType: 'radio',
    },
    options: {
      vendorSetPriceType: [
        { label: '按比例', value: 1 },
        { label: '按固定数值加价', value: 2 },
        { label: '最大售卖金额', value: 3 },
      ],
    },
    rules: {
      vendorSetPriceAutoValue: { visibleWhen: { field: 'vendorSetPriceType', in: [1, 2] } },
    },
    fieldHelp: {
      vendorProductNeedCheck: '供应商发布商品的时候是否需要审核才能显示商品。开启为默认审核通过。',
      vendorMaxSubAdministrator: '当前供应商可配置最大子管理员数量',
      vendorSetPriceType: '设价方式：按比例以供货价为基数自动加价；按固定数值加价；或最大售卖金额。',
      vendorSetPriceAutoValue: '自动加价数值：按比例时为百分比，按固定数值时为金额。',
    },
  },

  posOrderSetting: {
    title: '收银设置',
    getApi: '/setting/config/getCashierOrderSettings',
    saveApi: '/setting/config/saveCashierOrderSettings',
    controls: {
      autoPrintOnlineOrder: 'options',
      autoPrintOfflineOrder: 'options',
      defaultCollectionMethod: 'options',
    },
    options: {
      autoPrintOnlineOrder: [
        { label: '开启', value: 1 },
        { label: '关闭', value: 2 },
      ],
      autoPrintOfflineOrder: [
        { label: '开启', value: 1 },
        { label: '关闭', value: 2 },
      ],
      defaultCollectionMethod: [
        { label: '现金支付', value: 1 },
        { label: '扫码支付', value: 2 },
        { label: '余额支付', value: 3 },
        { label: '积分支付', value: 4 },
      ],
    },
    fieldHelp: {
      autoEraseZero: '开启后订单结算时自动向下抹除零头',
      autoDeductionPoints: '开启后若商品设置了可使用积分抵扣，在结算时可自动抵扣金额',
      autoPrintOnlineOrder: '开启前请先前往小票打印页面配置相关参数',
      autoPrintOfflineOrder: '开启前请先前往小票打印页面配置相关参数',
      defaultCollectionMethod: '进入结算页面的默认付款方式',
      autoAddCartAfterScan: '扫码枪扫描商品条码并回车后自动加入购物车',
      posProductSource: '请选择至少一个商品来源',
      shopCommonRemarks: '收银机常用备注，一行一条',
    },
  },
  baseBasicManage: { title: '基础信息', getApi: '/setting/config/basicSettings', saveApi: '/setting/config/saveBasic' },
  baseProductManage: { title: '商品设置', getApi: '/setting/config/productSettings', saveApi: '/setting/config/saveProduct' },
  baseShoppingManage: { title: '交易设置', getApi: '/setting/config/shoppingSettings', saveApi: '/setting/config/saveShopping' },
  baseOrderManage: {
    title: '订单设置',
    getApi: '/setting/config/orderSettings',
    saveApi: '/setting/config/saveOrder',
    rules: {
      autoReturnGoods: { visibleWhen: { field: 'afterSalesReview', equals: 1 } },
      autoReturnGoodsDays: { disabledWhen: { field: 'autoReturnGoods', equals: 0 } },
    },
  },
  kefuSetting: { title: '客服设置', getApi: '/setting/config/kefuSettings', saveApi: '/setting/config/saveKefu' },
  globalSetting: {
    title: '全局设置',
    getApi: '/setting/config/globalSettings',
    saveApi: '/setting/config/saveGlobal',
    controls: {
      navTheme: 'segmented',
      primaryColor: 'color',
      layout: 'segmented',
      versionInfoHidden: 'radio',
      storageType: 'options',
    },
    options: {
      navTheme: [
        { label: '浅色', value: 'light' },
        { label: '深色', value: 'dark' },
      ],
      primaryColor: [
        { label: '蓝色', value: 'blue', color: '#1456f0' },
        { label: '红色', value: 'red', color: '#f5222d' },
        { label: '橙色', value: 'orange', color: '#faad14' },
        { label: '绿色', value: 'green', color: '#52c41a' },
        { label: '紫色', value: 'purple', color: '#722ed1' },
      ],
      layout: [
        { label: '默认', value: 'default' },
        { label: '侧边菜单', value: 'side' },
        { label: '顶部菜单', value: 'top' },
        { label: '混合菜单', value: 'mix' },
      ],
      storageType: [
        { label: '本地存储', value: 0 },
        { label: '阿里云 OSS', value: 1 },
        { label: '腾讯云 COS', value: 2 },
        { label: '七牛云 KODO', value: 3 },
        { label: 'AWS S3', value: 4 },
      ],
    },
    hiddenFields: ['storageSaveFullPath'],
    fieldHelp: {
      storageType: '开启云存储后，图片会直接通过接口上传至指定云存储，不会再保存在本地。',
      storageLocalUrl: '参考格式： https://oss.***.com/ ，域名结尾必须带斜杠 /',
      storageOssUrl: '参考格式： https://oss.***.com/ ，域名结尾必须带斜杠 /',
      storageCosUrl: '参考格式： https://oss.***.com/ ，域名结尾必须带斜杠 /',
      storageQiniuUrl: '参考格式： https://oss.***.com/ ，域名结尾必须带斜杠 /',
      storageS3Url: '参考格式： https://oss.***.com/ ，Bucket URL 结尾必须带斜杠 /',
      storageOssAccessKeyId: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 AccessKeyId',
      storageOssAccessKeySecret: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 AccessKeySecret',
      storageCosSecretId: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 SecretId',
      storageCosSecretKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 KeySecret',
      storageQiniuAccessKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 AccessKey',
      storageQiniuSecretKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 SecretKey',
      storageS3AccessKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 Access key ID',
      storageS3SecretKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的 Secret access key',
    },
    rules: {
      storageLocalUrl: { visibleWhen: { field: 'storageType', equals: 0 } },
      storageOssUrl: { visibleWhen: { field: 'storageType', equals: 1 } },
      storageOssAccessKeyId: { visibleWhen: { field: 'storageType', equals: 1 } },
      storageOssAccessKeySecret: { visibleWhen: { field: 'storageType', equals: 1 } },
      storageOssBucket: { visibleWhen: { field: 'storageType', equals: 1 } },
      storageOssRegion: { visibleWhen: { field: 'storageType', equals: 1 } },
      storageCosUrl: { visibleWhen: { field: 'storageType', equals: 2 } },
      storageCosSecretId: { visibleWhen: { field: 'storageType', equals: 2 } },
      storageCosSecretKey: { visibleWhen: { field: 'storageType', equals: 2 } },
      storageCosBucket: { visibleWhen: { field: 'storageType', equals: 2 } },
      storageCosRegion: { visibleWhen: { field: 'storageType', equals: 2 } },
      storageQiniuUrl: { visibleWhen: { field: 'storageType', equals: 3 } },
      storageQiniuAccessKey: { visibleWhen: { field: 'storageType', equals: 3 } },
      storageQiniuSecretKey: { visibleWhen: { field: 'storageType', equals: 3 } },
      storageQiniuBucket: { visibleWhen: { field: 'storageType', equals: 3 } },
      storageQiniuRegion: { visibleWhen: { field: 'storageType', equals: 3 } },
      storageS3Url: { visibleWhen: { field: 'storageType', equals: 4 } },
      storageS3AccessKey: { visibleWhen: { field: 'storageType', equals: 4 } },
      storageS3SecretKey: { visibleWhen: { field: 'storageType', equals: 4 } },
      storageS3Bucket: { visibleWhen: { field: 'storageType', equals: 4 } },
      storageS3Region: { visibleWhen: { field: 'storageType', equals: 4 } },
      storageS3Endpoint: { visibleWhen: { field: 'storageType', equals: 4 } },
    },
  },
  loginSetting: {
    title: '登录设置',
    getApi: '/setting/config/loginSettings',
    saveApi: '/setting/config/saveLogin',
    controls: {
      openWechatOauth: 'radio',
      openWechatPcLogin: 'radio',
      wechatRegisterBindPhone: 'radio',
      openWechatRegister: 'radio',
      wechatShareNeedLogin: 'radio',
      facebookLoginOn: 'radio',
      googleLoginOn: 'radio',
      twitterLoginOn: 'radio',
    },
    rules: {
      openWechatPcLogin: {
        disabledWhen: { field: 'openWechatOauth', equals: 0 },
      },
      wechatRegisterBindPhone: {
        disabledWhen: {
          any: [
            { field: 'openWechatOauth', equals: 0 },
            { field: 'openWechatPcLogin', equals: 0 },
          ],
        },
      },
      openWechatRegister: {
        disabledWhen: { field: 'openWechatOauth', equals: 0 },
      },
      facebookClientId: { visibleWhen: { field: 'facebookLoginOn', equals: 1 } },
      facebookClientSecret: { visibleWhen: { field: 'facebookLoginOn', equals: 1 } },
      googleClientId: { visibleWhen: { field: 'googleLoginOn', equals: 1 } },
      googleClientSecret: { visibleWhen: { field: 'googleLoginOn', equals: 1 } },
      twitterClientId: { visibleWhen: { field: 'twitterLoginOn', equals: 1 } },
      twitterClientSecret: { visibleWhen: { field: 'twitterLoginOn', equals: 1 } },
    },
    fieldGroups: [
      {
        title: '公众号授权配置',
        description: '配置微信公众号授权登录所需的 AppID、密钥与服务器校验信息。',
        tag: '微信',
        icon: '微',
        fields: ['wechatAppId', 'wechatAppSecret', 'wechatServerToken', 'wechatServerSecret'],
        visibleWhen: { field: 'openWechatOauth', equals: 1 },
      },
    ],
  },
  storeAmapSetting: { title: '地图设置', getApi: '/setting/config/mapSettings', saveApi: '/setting/config/saveMapSettings' },
  personalizedManage: { title: '个性化设置', getApi: '/setting/config/getPersonalizedSetting', saveApi: '/setting/config/savePersonalizedSetting' },
  baseNoticeManage: { title: '通知设置', getApi: '/setting/config/notifySettings', saveApi: '/setting/config/saveNotify' },
};

Object.entries(configPages).forEach(([key, page]) => {
  page.sections = configSections[key];
  page.fieldHelp = { ...configHelp[key], ...page.fieldHelp };
});

const knownPages = new Set(['dashboard', 'pcDecorateEditor', 'shopGroupManage', 'shopTipManage', 'offlinePaymentClaimManage', 'imageSearchManage', 'vendorAccountManage', 'vendorFundsManage', 'vendorFinancialLogManage', 'products', 'brandManage', 'categoryManage', 'productGroupManage', 'productServicesManage', 'commentManage', 'productAttributesTplManage', 'friendLinksManage', 'regionManage', 'logisticsCompanyManage', 'appVersionManage', 'adminLogManage', 'adminUserManage', 'adminRoleManage', 'serviceAgreement', 'privacyAgreement', 'afterSaleService', 'accountManage', 'taxRateManage', 'shippingTypeManage', 'logisticsManage', 'logisticsCompanyConfigManage', 'payLogManage', 'refundLogManage', 'userBalanceLogManage', 'staffFundWalletLogManage', 'buyerShowManage', 'integralLogManage', 'refundApplyManage', 'userWithdrawApplyManage', 'userRechargeOrderManage', 'userInvoiceManage', 'orderInvoiceManage', 'depositRuleManage', 'depositPayeeAccountManage', 'depositAccountManage', 'depositPaymentAuditManage', 'depositLogManage', 'categoryFeeRuleManage', 'merchantApplicationManage', 'subMerchantManage', 'profitSharingSettlementManage', 'statementDownload', 'pos0', 'posOrderSetting', 'posCashierDeviceList', 'posReceiptPrint', 'posCashierList', 'baseBasicManage', 'baseProductManage', 'baseShoppingManage', 'baseOrderManage', 'kefuSetting', 'globalSetting', 'loginSetting', 'storeAmapSetting', 'personalizedManage', 'baseNoticeManage', 'paymentSetting', 'withdrawalSettingManage', 'profitsharingSettingManage', 'depositSettingManage', 'shopSettingsManage', 'adminMerchantSettingsManage', 'deliveryFundSettingsManage', 'serverFundSettingsManage', 'deliverManage', 'aftersalesManage', 'orderExportManage', 'exchangeOrderManage', 'cycleBuyManage', 'proxyShoppingManage', 'couponManage', 'rechargeSettingManage', 'pointsExchangeManage', 'productGiftManage', 'seckillManage', 'limitdiscountManage', 'fullReductionManage', 'grouponPromotionManage', 'inventoryQueryManage', 'productInventoryLogManage', 'inventoryAdjustmentManage', 'inventoryGoodsArePutIntoStorageManage', 'inventoryGoodsArePutOutOfStorageManage', 'storeInventoryTransferManage', 'enquiryManage', 'stockWarningManage', 'productBatchExportManage', 'productBatchAddManage', 'productBatchEditManage', 'storeInventoryCalendarManage', 'memberTagManage', 'feedbackManage', 'messageLogManage', 'levelManageManage', 'shopMemberSettingManage', 'userCertificationManage', 'userAuthenticationManage', 'userLevelProManage', 'articleCategoryManage', 'kefuManageList', 'kefuAccessSetting', 'kefuQuickReply', 'kefuAccountInfo', 'wechatLive', 'wechatLiveProduct', 'videoNumber', 'baseReceiptManage', 'authorityManage', 'materialCenter', 'termOrderManage', 'termPayManage', 'termMemberManage', 'shopManage', 'applyManage', 'adminMerchantManage', 'investmentManage', 'vendorListManage', 'vendorProductManage', 'vendorOrderManage', 'vendorSettingManage', 'storeSettingsManage', 'storeTipManage', 'storeAreaManage', 'storeListManage', 'storeSelfPackListManage', 'deliverymanList', 'servicemanList', 'statementDetails', 'shopWithdrawApplyManage', 'vendorWithdrawApplyManage', 'vendorStatementDownload', 'vendorWithdrawApplySummary', 'deliveryStaffWithdrawManage', 'serverStaffWithdrawManage', 'wholesalerManage', 'wholesalerGradeManage', 'wholesaleSettingManage', 'wholesaleProductManage', 'storePickupSettingManage', 'storeAppointmentTplManage', 'storeEntryRuleSetting', 'wechatLiveMiniAppSetting', 'shippingTplManage', 'messageTypeManage', 'consumerRanking', 'saleTargets', 'statisticsGoods', 'statisticsUser', 'newMembers', 'statisticsAccess', 'statisticsOrder', 'statisticsSale', 'salesman0', 'overviewManage', 'AnalysisTableManage', 'analysisTable', 'RankingTableManage', 'rankingTable', 'subgroupManage', 'subgroup', 'salesmanNoticeManage', 'salesmanNotice', 'materialCategoryManage', 'materialCategory', 'materialManage', 'material', 'salesmanDetailedManage', 'salesmanDetailed', 'customerTransactionsManage', 'customerTransactions', 'performanceSettlementSettingManage', 'performanceSettlementSetting', 'performanceSettlementManage', 'performanceSettlement', 'promoteModeManage', 'promoteMode', 'salesmanProductManage', 'salesmanProduct', 'promoterManage', 'promoter', 'languagesList', 'currencyManagement', 'translationContent', 'verbalAssociation', 'areaCode', 'aiImageSetting', 'intraCityDeliveryManage', 'intraCityDelivery', 'homeServiceManage', 'homeService', 'premiumMemberManage', 'premiumMember', 'premiumMemberRightManage', 'premiumMemberRight', 'supplierManage', 'supplierCategoryManage', 'supplierProductManage', 'purchaseSettingManage', 'purchaseOrderManage', 'purchaseInboundManage', 'purchaseReturnManage', 'purchaseReconciliationManage', 'analysisTableManage', 'rankingTableManage', 'languagesListManage', 'aiImageSettingManage', 'translationContentManage', 'currencyManagementManage', 'areaCodeManage', 'verbalAssociationManage', 'videoNumber', 'selfVendorManage', 'selfVendorCategoryManage', 'selfVendorProductManage', 'purchaseReceiptManage', 'accountPanelManage', 'distributionCommissionManage', 'shopWithdrawApplySummary', 'vendorStatementDetails', 'staffFundWalletManage', 'wechatMenu', 'wechatKeywordReply', 'wechatAutoReply', 'voiceBroadcastManage', 'promotion0', 'promotion2', 'rewardGiftManage', 'signInSettingManage', 'eCardManage', 'giftCardManage', 'lotteryManage', 'decorate0', 'mobileDecorateManage', 'mobileSplashAdManage', 'mobileSplashAdManage2', 'mobileuserUserOverseasManage', 'mobileSearchStyleManage', 'mobileNavManage', 'classifyManage', 'mobileUserManage', 'mobileCatNavManage', 'pcDecorateManage', 'pcNavigationManage', 'pcCatFloorManage', 'pcDecorateCustomManage', 'pcProductStyleManage', 'pcSearchDecorateManage', 'pcLoginDecorateManage', 'customerService0', 'kefuHistoryList', 'afterSalesServiceManage', 'orders', 'members', 'content', 'decorate', 'decorate1', 'decorate2', 'pcDecorate', 'pcDecorateEdit', 'pcCustomPage']);

if (new URLSearchParams(window.location.search).get('demo') === '1') {
  enterDemo();
}

function normalizePageKey(key: string | null): PageKey {
  if (!key) return 'dashboard';
  const aliasMap: Record<string, string> = {
    decorate: 'decorate0',
    decorate0: 'decorate0',
    decorate1: 'mobileDecorateManage',
    mobileDecorate: 'mobileDecorateManage',
    mobileDecorateEdit: 'mobileDecorateManage',
    decorate2: 'pcDecorateManage',
    pcDecorate: 'pcDecorateManage',
    pcDecorateManage: 'pcDecorateManage',
    pcDecorateEdit: 'pcDecorateManage',
    pcCustomPage: 'pcDecorateCustomManage',
    pcCustomPageDecorateEdit: 'pcDecorateCustomManage',
  };
  if (aliasMap[key]) return aliasMap[key];
  return pageTitles[key] ? key : 'dashboard';
}

function initialPage(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const pageParam = urlParams.get('page');
  if (pageParam === 'pcDecorateEditor') {
    return pageParam;
  }
  if (pageParam) {
    return normalizePageKey(pageParam);
  }
  const pathname = window.location.pathname;
  if (pathname.includes('/decorate/pc')) {
    return 'pcDecorateManage';
  }
  if (pathname.includes('/decorate/index')) {
    return 'mobileDecorateManage';
  }
  return 'dashboard';
}

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken() || isDemo()));
  const [page, setPage] = useState<string>(initialPage);
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    navTheme: 'light',
    primaryColor: 'blue',
    layout: 'default',
  });

  const applyAndStore = (values: AppearanceSettings) => {
    const next = {
      navTheme: values.navTheme || 'light',
      primaryColor: values.primaryColor || 'blue',
      layout: values.layout || 'default',
      adminLightLogo: values.adminLightLogo || '',
    };
    setAppearance(next);
    applyAppearance(next);
  };

  useEffect(() => {
    if (!authed) return;
    apiGet<AppearanceSettings>('/setting/config/globalSettings')
      .then((result) => applyAndStore(result || {}))
      .catch(() => applyAppearance({}));
  }, [authed]);

  const changePage = (next: PageKey) => {
    const target = normalizePageKey(next);
    setPage(target);
    const url = new URL(window.location.href);
    url.searchParams.set('page', target);
    window.history.replaceState(null, '', url);
  };

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  // PC 装修编辑器：独立全屏页（对齐原版 /decorate/pc 新窗口打开，无后台侧栏）
  if (page === 'pcDecorateEditor') {
    const editorId = Number(new URLSearchParams(window.location.search).get('id') || 0);
    return (
      <PcDecorateEditor
        decorateId={editorId}
        onExit={() => {
          window.location.href = `${window.location.origin}/?page=pcDecorateManage`;
        }}
      />
    );
  }

  return (
    <AdminLayout
      layout={appearance.layout}
      logo={appearance.adminLightLogo}
      page={page as PageKey}
      onPageChange={changePage}
      onLogout={() => {
        clearToken();
        setAuthed(false);
      }}
    >
      {page === 'dashboard' && <Dashboard onNavigate={changePage} />}
      {page === 'products' && <Products />}
      {page === 'brandManage' && <Brands />}
      {page === 'productGroupManage' && <ProductGroups />}
      {page === 'categoryManage' && <Categories />}
      {page === 'productServicesManage' && <ProductServices />}
      {page === 'commentManage' && <Comments />}
      {page === 'productAttributesTplManage' && <AttributesTemplates />}
      {page === 'friendLinksManage' && <FriendLinks />}
      {page === 'regionManage' && <Regions />}
      {page === 'logisticsCompanyManage' && <LogisticsCompanies />}
      {page === 'appVersionManage' && <AppVersion />}
      {page === 'adminLogManage' && <AdminLogs />}
      {page === 'adminUserManage' && <AdminUsers />}
      {page === 'adminRoleManage' && <Roles />}
      {page === 'serviceAgreement' && (
        <AgreementPage code="termsOfService" title="服务协议" description="配置后台登录服务协议内容与启用状态。" />
      )}
      {page === 'privacyAgreement' && (
        <AgreementPage code="privacyPolicy" title="隐私政策" description="配置后台登录隐私政策内容与启用状态。" />
      )}
      {page === 'accountManage' && <AccountManage />}
      {page === 'taxRateManage' && <TaxRates />}
      {page === 'shippingTypeManage' && <ShippingTypes />}
      {page === 'logisticsManage' && <ShippingSettingsPage />}
      {page === 'logisticsCompanyConfigManage' && <LogisticsSettings />}
      {page === 'payLogManage' && <PayLogs />}
      {page === 'refundLogManage' && <RefundLogs />}
      {page === 'userBalanceLogManage' && <BalanceLogs />}
      {page === 'staffFundWalletLogManage' && <StaffWalletLogs />}
      {page === 'buyerShowManage' && <BuyerShow />}
      {page === 'integralLogManage' && <IntegralLogs />}
      {page === 'refundApplyManage' && <RefundApplyList />}
      {page === 'userWithdrawApplyManage' && <WithdrawApplyList />}
      {page === 'userRechargeOrderManage' && <RechargeOrderList />}
      {page === 'userInvoiceManage' && <UserInvoiceList />}
      {page === 'orderInvoiceManage' && <OrderInvoiceList />}
      {page === 'depositRuleManage' && <DepositRules />}
      {page === 'depositPayeeAccountManage' && <DepositAccounts />}
      {page === 'depositAccountManage' && <DepositQuery />}
      {page === 'depositPaymentAuditManage' && <DepositAudit />}
      {page === 'depositLogManage' && <DepositLogs />}
      {page === 'categoryFeeRuleManage' && <CategoryFeeRules />}
      {page === 'merchantApplicationManage' && <MerchantApplications />}
      {page === 'subMerchantManage' && <SubMerchants />}
      {page === 'profitSharingSettlementManage' && <ProfitSharing />}
      {page === 'statementDownload' && <StatementDownload />}
      {page === 'pos0' && <PosWorkbench />}
      {page === 'posCashierDeviceList' && <CashierDevices />}
      {page === 'posReceiptPrint' && <ReceiptPrintersPage />}
      {page === 'posCashierList' && <PosCashierList />}
      {page === 'paymentSetting' && <PaymentSettings />}
      {page === 'withdrawalSettingManage' && <WithdrawalSettings />}
      {page === 'profitsharingSettingManage' && <ProfitSharingSettings />}
      {page === 'depositSettingManage' && <DepositSettings />}
      {page === 'shopSettingsManage' && <ShopSettings />}
      {page === 'storeSettingsManage' && <StoreSettings />}
      {page === 'storeTipManage' && <StoreTips />}
      {page === 'storeAreaManage' && <StoreAreas />}
      {page === 'storeListManage' && <StoreList />}
      {page === 'storeSelfPackListManage' && <SelfPackList />}
      {page === 'deliverymanList' && <DeliverymanList />}
      {page === 'servicemanList' && <ServicemanList />}
      {(page === 'statementDetails' || page === 'vendorStatementDetails') && <StatementDetails source={page === 'vendorStatementDetails' ? 'vendor' : 'shop'} />}
      {page === 'accountPanelManage' && <AccountPanel />}
      {page === 'distributionCommissionManage' && <DistributionCommission />}
      {page === 'shopWithdrawApplySummary' && <ShopWithdrawApplySummary />}
      {page === 'staffFundWalletManage' && <StaffFundWallet />}
      {page === 'wechatMenu' && <WechatMenu />}
      {page === 'wechatKeywordReply' && <WechatKeywordReply />}
      {page === 'wechatAutoReply' && <WechatAutoReply />}
      {page === 'voiceBroadcastManage' && <VoiceBroadcast />}
      {page === 'promotion0' && <PromotionOverview />}
      {page === 'promotion2' && <PromotionStyle />}
      {page === 'rewardGiftManage' && <RewardGift />}
      {page === 'signInSettingManage' && <SignInSetting />}
      {page === 'eCardManage' && <ECard />}
      {page === 'giftCardManage' && <GiftCard />}
      {page === 'lotteryManage' && <Lottery />}
      {(page === 'decorate0' || page === 'decorate') && <ThemeStyle />}
      {(page === 'mobileDecorateManage' || page === 'decorate1' || page === 'mobileDecorate') && <MobileDecoratePages />}
      {(page === 'mobileSplashAdManage' || page === 'mobileSplashAdManage2') && <MobileSplashAd />}
      {page === 'mobileuserUserOverseasManage' && <MobileUserOverseas />}
      {page === 'mobileSearchStyleManage' && <MobileSearchStyle />}
      {page === 'mobileNavManage' && <MobileNav />}
      {page === 'classifyManage' && <ClassifyDecorate />}
      {page === 'mobileUserManage' && <MobileUserDecorate />}
      {page === 'mobileCatNavManage' && <MobileCatNav />}
      {(page === 'pcDecorateManage' || page === 'decorate2' || page === 'pcDecorate' || page === 'pcDecorateEdit') && <PcDecorateHome />}
      {page === 'pcNavigationManage' && <PcNavigation />}
      {page === 'pcCatFloorManage' && <PcCatFloor />}
      {(page === 'pcDecorateCustomManage' || page === 'pcCustomPage') && <PcCustomPage />}
      {page === 'pcProductStyleManage' && <PcProductStyle />}
      {page === 'pcSearchDecorateManage' && <PcSearchDecorate />}
      {page === 'pcLoginDecorateManage' && <PcLoginDecorate />}
      {(page === 'customerService0' || page === 'kefuHistoryList' || page === 'afterSalesServiceManage') && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
            {page === 'afterSalesServiceManage' ? '商品售后服务管理' : page === 'customerService0' ? '客服工作台' : '历史会话列表'}
          </div>
          <div style={{ color: '#888' }}>
            {page === 'afterSalesServiceManage'
              ? '该模块能力已由统一商品服务管理 (productServicesManage) 全面覆盖。'
              : '当前客服后台依赖的独立 WebSocket/IM 历史会话接口对接中，请关注后续服务升级。'}
          </div>
        </div>
      )}
      {page === 'shopWithdrawApplyManage' && <ShopWithdrawApplies />}
      {page === 'vendorWithdrawApplyManage' && <VendorWithdrawApplies />}
      {page === 'vendorStatementDownload' && <VendorStatementDownload />}
      {page === 'vendorWithdrawApplySummary' && <VendorWithdrawSummary />}
      {page === 'deliveryStaffWithdrawManage' && <DeliveryStaffWithdraw />}
      {page === 'serverStaffWithdrawManage' && <ServerStaffWithdraw />}
      {page === 'wholesalerManage' && <Wholesalers />}
      {page === 'wholesalerGradeManage' && <WholesalerGrades />}
      {page === 'wholesaleSettingManage' && <WholesaleSetting />}
      {page === 'wholesaleProductManage' && <WholesaleProducts />}
      {page === 'storePickupSettingManage' && <StorePickupSetting />}
      {page === 'storeAppointmentTplManage' && <StoreAppointmentTemplates />}
      {page === 'storeEntryRuleSetting' && <StoreEntryRuleSetting />}
      {page === 'wechatLiveMiniAppSetting' && <WechatLiveMiniAppSetting />}
      {page === 'shippingTplManage' && <ShippingTemplates />}
      {page === 'messageTypeManage' && <MessageTypes />}
      {page === 'consumerRanking' && <ConsumerRanking />}
      {page === 'saleTargets' && <SaleTargets />}
      {page === 'statisticsGoods' && <StatisticsGoods />}
      {page === 'statisticsUser' && <StatisticsUser />}
      {page === 'newMembers' && <NewMembers />}
      {page === 'statisticsAccess' && <StatisticsAccess />}
      {page === 'statisticsOrder' && <StatisticsOrder />}
      {page === 'statisticsSale' && <StatisticsSale />}
      {page === 'adminMerchantSettingsManage' && <AdminMerchantSettings />}
      {page === 'deliveryFundSettingsManage' && <StaffFundSettings apiPath="deliveryFundManagement" />}
      {page === 'serverFundSettingsManage' && <StaffFundSettings apiPath="serverFundManagement" />}
      {page === 'deliverManage' && <DeliverOrders />}
      {page === 'exchangeOrderManage' && <DeliverOrders variant="exchange" />}
      {page === 'cycleBuyManage' && <DeliverOrders variant="cycle" />}
      {page === 'proxyShoppingManage' && <ProxyShopping />}
      {page === 'aftersalesManage' && <AftersalesOrders />}
      {page === 'orderExportManage' && <OrderExport />}
      {page === 'couponManage' && <Coupons />}
      {page === 'rechargeSettingManage' && <RechargeSettings />}
      {page === 'pointsExchangeManage' && <PointsExchanges />}
      {page === 'productGiftManage' && <ProductGifts />}
      {page === 'seckillManage' && <Seckills />}
      {page === 'limitdiscountManage' && <TimeDiscounts />}
      {page === 'fullReductionManage' && <ProductPromotions />}
      {page === 'grouponPromotionManage' && <Groupons />}
      {page === 'inventoryQueryManage' && <InventoryQuery />}
      {page === 'productInventoryLogManage' && <ProductInventoryLogs />}
      {page === 'inventoryAdjustmentManage' && <InventoryAdjustments />}
      {page === 'inventoryGoodsArePutIntoStorageManage' && <StockRecords inOrOut={1} />}
      {page === 'inventoryGoodsArePutOutOfStorageManage' && <StockRecords inOrOut={2} />}
      {page === 'storeInventoryTransferManage' && <InventoryTransfers />}
      {page === 'enquiryManage' && <Enquiries />}
      {page === 'stockWarningManage' && <StockWarnings />}
      {page === 'productBatchExportManage' && <ProductBatch mode="export" />}
      {page === 'productBatchAddManage' && <ProductBatch mode="add" />}
      {page === 'productBatchEditManage' && <ProductBatch mode="edit" />}
      {page === 'storeInventoryCalendarManage' && <InventoryCalendars />}
      {page === 'memberTagManage' && <MemberTags />}
      {page === 'feedbackManage' && <Feedbacks />}
      {page === 'messageLogManage' && <MessageLogs />}
      {page === 'levelManageManage' && <MemberLevels />}
      {page === 'shopMemberSettingManage' && <ShopMemberSettings />}
      {page === 'userAuthenticationManage' && <UserAuthenticationSettings />}
      {page === 'userLevelProManage' && <MemberLevelPros />}
      {page === 'articleCategoryManage' && <ArticleCategories />}
      {page === 'kefuManageList' && <KefuList />}
      {page === 'kefuAccessSetting' && <KefuAccessSettings />}
      {page === 'kefuQuickReply' && <KefuQuickReplies />}
      {page === 'kefuAccountInfo' && <KefuAccountInfo />}
      {page === 'wechatLive' && <WechatLives />}
      {page === 'wechatLiveProduct' && <WechatLiveGoods />}
      {(page === 'videoNumberManage' || page === 'videoNumber') && <VideoNumbers />}
      {page === 'baseReceiptManage' && <ReceiptPrintersPage />}
      {page === 'salesman0' && <SalesmanOverview />}
      {page === 'analysisTableManage' && <SalesmanAnalysisTable />}
      {page === 'rankingTableManage' && <SalesmanRankingTable />}
      {page === 'promoteModeManage' && <SalesmanPromoteMode />}
      {page === 'salesmanProductManage' && <SalesmanProducts />}
      {page === 'promoterManage' && <SalesmanPromoters />}
      {page === 'subgroupManage' && <SalesmanSubgroup />}
      {page === 'salesmanDetailedManage' && <SalesmanDetailed />}
      {page === 'customerTransactionsManage' && <CustomerTransactions />}
      {page === 'performanceSettlementSettingManage' && <SalesmanSettlementSetting />}
      {page === 'performanceSettlementManage' && <SalesmanPerformanceSettlement />}
      {page === 'salesmanNoticeManage' && <SalesmanNotice />}
      {page === 'materialCategoryManage' && <SalesmanMaterialCategory />}
      {page === 'materialManage' && <SalesmanMaterial />}
      {page === 'premiumMemberManage' && <PremiumMembers />}
      {page === 'premiumMemberRightManage' && <PremiumMemberRights />}
      {page === 'intraCityDeliveryManage' && <IntraCityDelivery />}
      {page === 'homeServiceManage' && <HomeService />}
      {page === 'languagesListManage' && <LanguagesList />}
      {page === 'currencyManagementManage' && <CurrencyManagement />}
      {page === 'translationContentManage' && <TranslationContent />}
      {page === 'verbalAssociationManage' && <VerbalAssociation />}
      {page === 'areaCodeManage' && <AreaCode />}
      {page === 'aiImageSettingManage' && <AiImageSetting />}
      {page === 'statementDetails' && <StatementDetails source="shop" />}
      {page === 'vendorStatementDetails' && <StatementDetails source="vendor" />}
      {page === 'vendorAccountManage' && <VendorAccountManage />}
      {page === 'vendorFundsManage' && <VendorFundsManage />}
      {page === 'vendorFinancialLogManage' && <VendorFinancialLogManage />}
      {page === 'offlinePaymentClaimManage' && <OfflinePaymentClaimManage />}
      {page === 'imageSearchManage' && <ImageSearchManage />}
      {page === 'shopGroupManage' && <ShopGroupManage />}
      {page === 'shopTipManage' && <ShopTipManage />}
      {page === 'purchaseOrderManage' && <PurchaseOrders />}
      {page === 'purchaseReceiptManage' && <PurchaseInbound />}
      {page === 'purchaseReturnManage' && <PurchaseReturns />}
      {page === 'purchaseReconciliationManage' && <PurchaseReconciliation />}
      {page === 'selfVendorManage' && <SupplierList />}
      {page === 'selfVendorCategoryManage' && <SupplierCategories />}
      {page === 'selfVendorProductManage' && <SupplierProducts />}
      {page === 'purchaseSettingManage' && <PurchaseSetting />}
      {page === 'authorityManage' && <Authorities />}
      {page === 'materialCenter' && <MaterialCenter />}
      {page === 'termOrderManage' && <CreditOrders />}
      {page === 'termPayManage' && <CreditSettlements />}
      {page === 'termMemberManage' && <CreditUsers />}
      {page === 'userCertificationManage' && <UserCertifications />}
      {page === 'shopManage' && <ShopList />}
      {page === 'applyManage' && <MerchantApplies />}
      {page === 'adminMerchantManage' && <Merchants />}
      {page === 'investmentManage' && <InvestmentContent />}
      {page === 'vendorListManage' && <VendorList />}
      {page === 'vendorProductManage' && <VendorProducts />}
      {page === 'vendorOrderManage' && <VendorOrders />}
      {configPages[page] && (
        <AutoConfigPage
          {...configPages[page]}
          onSaved={page === 'globalSetting' ? (values) => applyAndStore(values) : undefined}
        />
      )}
      {page === 'afterSaleService' && (
        <AgreementPage code="afterSalesService" title="售后服务" description="配置售后服务协议内容与启用状态。" />
      )}
      {page === 'orders' && <Orders />}
      {page === 'members' && <Members />}
      {page === 'content' && <Content />}
      {!knownPages.has(page) && <Placeholder page={page} />}
    </AdminLayout>
  );
}
