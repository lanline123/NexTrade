export interface PageResult<T> {
  records: T[];
  total: number;
  size: number;
  current: number;
  pages: number;
}

export interface DashboardData {
  awaitAfterSale: number;
  awaitComment: number;
  awaitPay: number;
  awaitShip: number;
  buyerGrowthRate: number;
  orderAmountGrowthRate: number;
  orderGrowthRate: number;
  consoleData: {
    awaitAfterSale: number;
    awaitComment: number;
    awaitPay: number;
    awaitShip: number;
    productOnSaleNum: number;
    productTotalNum: number;
    todayBuyerNum: number;
    todayOrderAmount: number;
    todayOrderNum: number;
    todayViewNum: number;
    todayVisitNum: number;
  };
  panelStatisticalData: {
    buyerGrowthRate: number;
    orderAmountGrowthRate: number;
    orderGrowthRate: number;
    todayBuyerNum: number;
    todayOrderAmount: number;
    todayOrderNum: number;
    todayViewNum: number;
    todayVisitNum: number;
    yesterdayBuyerNum: number;
    yesterdayOrderAmount: number;
    yesterdayOrderNum: number;
    yesterdayViewNum: number;
    yesterdayVisitNum: number;
  };
}

export interface ProductRow {
  productId: number;
  productName: string;
  productSn: string;
  productPrice: string;
  marketPrice: string;
  productStock: number;
  productStatus: number;
  /** 在售状态：1 可售 / 0 禁售（v5.8.61 saleStatus） */
  saleStatus?: number;
  checkStatus: number;
  picThumb: string;
  picUrl: string;
  virtualSales: number;
  skuCount: number;
  categoryId: number;
  brandId: number;
  productBrief: string;
  shopId: number;
}

export interface OrderRow {
  orderId: number;
  orderSn: string;
  userId: number;
  orderStatus: number;
  orderStatusName: string;
  payStatus: number;
  payStatusName: string;
  shippingStatus: number;
  shippingStatusName: string;
  consignee: string;
  mobile: string;
  totalAmount: string;
  paidAmount: string;
  addTime: string;
  /** 配送方式：3 为同城配送，列表行操作文案用「完成配送」而非「确认收货」。 */
  shippingTypeId?: number;
  /** 自提订单不展示确认收货入口。 */
  isPickup?: boolean;
  items?: Array<{ productName?: string; productNum?: number; productImage?: string }>;
  /** 行级「取消订单/取消发货」入口（旧版 isChangeOrderStatus，1 展示）。 */
  isChangeOrderStatus?: number;
  /** 取消目标状态：3 取消订单 / 1 取消发货（旧版 ChangeStatus preOrderStatus）。 */
  preOrderStatus?: number;
  availableActions?: {
    deliver?: boolean;
    confirmReceipt?: boolean;
    cancelOrder?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface MemberRow {
  userId: number;
  username: string;
  nickname: string;
  mobile: string;
  email: string;
  avatar: string;
  balance: string;
  points: number;
  orderCount: number;
  orderAmount: string;
  regTime: string;
  rankName: string;
  isSvip: number;
  status?: number;
  fromTag?: number;
  fromTagName?: string;
  isCompanyAuth?: number;
  frozenBalance?: string;
  rankLogo?: string;
  mark?: number;
  adminNote?: string;
  growthPoints?: number;
}

export interface RegionRow {
  regionId: number;
  regionName: string;
  parentId?: number;
  parentName?: string;
  firstWord?: string;
  isHot?: number;
  sortOrder?: number;
}

export interface ProductServiceRow {
  productServiceId: number;
  productServiceName: string;
  productServiceDesc?: string;
  icoImg?: string;
  sortOrder?: number;
  defaultOn?: number;
}

export interface CategoryRow {
  categoryId: number;
  categoryName: string;
  shortName?: string;
  parentId?: number;
  sortOrder?: number;
  measureUnit?: string;
  categoryPic?: string;
  seoTitle?: string;
  keywords?: string;
  categoryDesc?: string;
  isShow?: number;
  isHot?: number;
  hasChildren?: number;
  depth?: number;
  children?: CategoryRow[];
}

export interface BrandRow {
  brandId: number;
  brandName: string;
  brandLogo?: string;
  brandDesc?: string;
  firstWord?: string;
  brandIsHot?: number;
  isShow?: number;
  sortOrder?: number;
  status?: number;
  statusText?: string;
  rejectRemark?: string;
  shop?: { shopId: number; shopTitle: string };
}

export interface ArticleRow {
  articleId: number;
  articleTitle: string;
  articleCategoryId: number;
  articleCategoryName?: string;
  articleThumb?: string;
  articleAuthor: string;
  articleSn?: string;
  articleTag?: string;
  articleType?: number;
  articleTypeText?: string;
  description: string;
  isShow: number;
  isHot: number;
  isTop: number;
  clickCount: number;
  addTime: number;
  link?: string;
  keywords?: string;
  content?: string;
}

export interface ArticleCategoryRow {
  articleCategoryId: number;
  articleCategoryName: string;
  parentId: number;
  categorySn: string;
  sortOrder?: number;
  categoryType?: number;
}
