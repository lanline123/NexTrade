import { navGroups, type NavGroup } from './adminMenu';

/**
 * 角色专属菜单组（旧版 asyncRoutes 按角色加载的页面集，报告 §5 四大孤儿域）。
 * 平台端（admin）沿用 navGroups；商户端（shop）/供应商端（vendor）在平台组后
 * 追加自己的自助页面组 —— 这些页面在旧版平台端没有对应物，正是此前整块缺失的
 * 「资产中心 / 财务中心 / 设置与库存」。AdminLayout 按 localStorage.adminType 合并。
 */

/** 商户端（adminType=shop）：资产中心 + 店铺设置（旧 merchant/capitalfund + merchant/setting）。 */
export const shopNavGroups: NavGroup[] = [
  {
    key: 'shopCapital',
    label: '资产中心',
    icon: <span style={{ fontSize: 16, lineHeight: '16px' }}>💰</span>,
    items: [
      { key: 'dashboardManage', label: '资产总览' },
      { key: 'balanceManage', label: '余额明细' },
      { key: 'shopDepositManage', label: '店铺保证金' },
      { key: 'withdrawManage', label: '提现管理' },
      { key: 'accountListManage', label: '收款账户' },
      { key: 'financialLogManage', label: '资金流水' },
      { key: 'merchantApplyManage', label: '商户进件' },
    ],
  },
  {
    key: 'shopSetting',
    label: '店铺设置',
    icon: <span style={{ fontSize: 16, lineHeight: '16px' }}>🏪</span>,
    items: [
      { key: 'ShopInfoManage', label: '店铺信息' },
      { key: 'shopProductCategoryManage', label: '店铺商品分类' },
      { key: 'ShopTeamManage', label: '店铺团队' },
      { key: 'shippingTplManage', label: '配送模板' },
      { key: 'baseReceiptManage', label: '收货设置' },
      { key: 'enquiryManage', label: '询价管理' },
    ],
  },
];

/** 供应商端（adminType=vendor）：财务中心 + 设置与自有库存（旧 vendor/finance + vendor/setting|stock）。 */
export const vendorNavGroups: NavGroup[] = [
  {
    key: 'vendorCapital',
    label: '财务中心',
    icon: <span style={{ fontSize: 16, lineHeight: '16px' }}>💰</span>,
    items: [
      { key: 'dashboardManage', label: '资产总览' },
      { key: 'balanceManage', label: '余额明细' },
      { key: 'vendorDepositManage', label: '供应商保证金' },
      { key: 'withdrawManage', label: '提现管理' },
      { key: 'accountListManage', label: '收款账户' },
      { key: 'financialLogManage', label: '财务日志' },
    ],
  },
  {
    key: 'vendorSetting',
    label: '供应商设置',
    icon: <span style={{ fontSize: 16, lineHeight: '16px' }}>🏭</span>,
    items: [
      { key: 'vendorInfoManage', label: '供应商信息' },
      { key: 'vendorUserManage', label: '员工管理' },
      { key: 'bindShopManager', label: '绑定店铺' },
    ],
  },
  {
    key: 'vendorStock',
    label: '自有库存',
    icon: <span style={{ fontSize: 16, lineHeight: '16px' }}>📦</span>,
    items: [
      { key: 'vendorProductStockManage', label: '商品库存' },
      { key: 'vendorStockLogManage', label: '库存流水' },
    ],
  },
];

/** 平台端：原菜单不变。 */
export const adminNavGroups: NavGroup[] = navGroups;

/** 按角色取有效菜单（AdminLayout 使用）。 */
export function navGroupsForRole(adminType: string | null): NavGroup[] {
  if (adminType === 'shop') return [...navGroups, ...shopNavGroups];
  if (adminType === 'vendor') return [...navGroups, ...vendorNavGroups];
  return navGroups;
}
