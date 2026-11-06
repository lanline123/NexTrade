export interface GuessLikeDataResponse {
    data: GuessLikeProductList[];
    code: number;
    message: string;
}

export interface GuessLikeIdsDataResponse {
    data: string;
    code: number;
    message: string;
}

export interface GuessLikeProductList {
    productId: number;
    picThumb: string;
    picUrl: string;
    productName: string;
    checkStatus: number;
    shopId: number;
    suppliersId: number;
    productType: number;
    productSn: string;
    productPrice: string;
    marketPrice: string;
    productStatus: number;
    isBest: number;
    isNew: number;
    isHot: number;
    productStock: number;
    sortOrder: number;
    seckillPrice: null;
    productSku: ProductSku[];
}

export interface GuessLikeProductSku {
    skuId: number;
    productId: number;
    skuValue: string;
    skuData: SkuDatum[];
    skuSn: string;
    skuStock: number;
    skuTsn: string;
    skuPrice: string;
}

export interface GuessLikeSkuDatum {
    name: string;
    value: string;
}

// 主题

export interface ConfigResponse {
    data: ConfigData;
    code: number;
    message: string;
}

export interface ConfigData {
    shopName: string;
    shopTitle: string;
    shopTitleSuffix: string;
    shopLogo: string;
    shopKeywords: string;
    shopDesc: string;
    storageUrl: string;
    dollarSign: string;
    dollarSignCn: string;
    icoImg: string;
    pcDomain: string;
    h5Domain: string;
    adminDomain: string;
    decoratePageConfig: DecoratePageConfig;
    code: number;
    message: string;
    openWechatOauth: number;
    showService: boolean;
    isEnterprise: number | string;
    deCopyright: number | string;
    number: string;
    poweredByStatus: number | null;
    shopCompany: string;
    categoryDecorateType: number;
    canInvoice: number;
    invoiceAdded: number;
    isOpenMobileAreaCode: number;
    showMarketprice: number;
    showSelledCount: number;
    companyDataType: number;
    companyDataTips: string;
    isIdentity: number;
    shopRegClosed: number;
    closeOrder: number;
    useCoupon: number;
    usePoints: number;
    useSurplus: number;
    memberWithdrawalEnabled?: number; // 会员余额提现开关，0-关闭，1-开通（D1107）
    memberWithdrawalReceiptMethod?: number[]; // 提现到账方式，1银行卡 2支付宝 3微信（D1107）
    memberWithdrawalDescription?: string; // 会员余额提现说明（HTML，D1197）
    commissionWithdrawalEnabled?: number; // 分销佣金提现开关，0-关闭，1-开通（D1107）
    googleLoginOn: number;
    facebookLoginOn: number;
    defaultTechSupport: string;
    poweredByLogo: string;
    openEmailRegister: number;
    integralName: string;
    storeCustomSubmitShippingType: number;
    poweredBy: number;
    openWechatRegister: number;
    wechatShareNeedLogin?: number;
    wechatRegisterBindPhone: number;
    twitterLoginOn?: number;
    closeAuth: number;
    bulkPurchase: number;
    version: string;
    shopIcpNo: string;
    shopCompanyTxt: string;
    isGuestLikeGoods: number;
    guestLikeGoodsName: string;
    personApplyEnabled: number;
    enableAttributeFilter: number;
    productRawImageDownloadEnabled?: number;
    productRawImageDownloadChannels?: string[];
    productRawImageDownloadScopes?: string[];
    productCommentEnabled?: number | string;
    anonymousCommentEnabled?: number | string;
    searchSelfStore?: number;
    useNewMemberCenter?: number | string;
    buyerShowEnabled?: number;
    buyerShowMobileShowName?: string;
    buyerShowGuidanceContent?: string;
    buyerShowTemplateStyle?: number;
    defaultAvatar: string;
    defaultLogisticsName: string;
    growUpSetting?: GrowUpSetting;
    mapProvider?: "amap" | "tianditu"; // 地图服务商，来源为后台地图设置；缺省按 amap 处理
    tiandituJsTk?: string; // 天地图 JS API 密钥，仅 mapProvider 为 tianditu 时使用
    amapJsKey?: string; // 高德 JS API Key，H5 运行时替换 manifest 中的 key
    amapJsSecret?: string | null; // 高德 JS 安全密钥；演示站不下发，H5 改走 /_AMapService 代理
}

export interface GrowUpSetting {
    evpi: number;
    evpiGrowth: number;
    bindPhone: number;
    bindPhoneGrowth: number;
    buyGoods: number;
    buyGoodsMoney: number;
    buyGoodsGrowth: number;
    buyOrder: number;
    buyOrderNumber: number;
    buyOrderGrowth: number;
}

export interface DecoratePageConfig {
    type: string;
    module: any[];
    backgroundRepeat: string;
    backgroundSize: string;
    style: number;
    title: string;
    titleColor: string;
    titleBackgroundColor: string;
    backgroundImage: BackgroundImage;
    backgroundColor: string;
    headerStyle: number;
    logo: BackgroundImage;
    active: boolean;
}

export interface BackgroundImage {
    picUrl: string;
    picThumb: string;
}

export interface ThemeResponse {
    data: {
        themeStyle: string;
    };
    code: number;
    message: string;
}
export interface LangListResponse {
    data: LangListItem[];
    code: number;
    message: string;
}

export interface LangListItem {
    id: number;
    localeCode: string;
    language: string;
    flagPicture: string;
    lastUpdated: string;
    isEnabled: number;
    isDefault: number;
}

export interface DefaultLangResponse {
    data: DefaultLangItem;
    code: number;
    message: string;
}
export interface DefaultLangItem {
    id: number;
    localeCode: string;
    language: string;
    flagPicture: string;
    lastUpdated: string;
    isEnabled: number;
    isDefault: number;
}

export interface CurrencyResponse {
    data: CurrencyItem[];
    code: number;
    message: string;
}

export interface CurrencyItem {
    id: number;
    name: string;
    symbol: string;
    localesId: number;
    isDefault: number;
    rate: string;
}

export interface MobileAreaCodeResponse {
    data: MobileAreaCodeList[];
    code: number;
    message: string;
}

export interface MobileAreaCodeList {
    id: number;
    code: string;
    name: string;
    isAvailable: number;
    isDefault: number;
    label: string;
    labelName: string;
}

export interface ProductsListResponse {
    data: ProductsListData;
    code: number;
    message: string;
}

export interface ProductsListData {
    records: ProductsListResult[];
    total: number;
}

export interface Filter {
    isShow: number;
    page: number;
    size: number;
    sortField: string;
    sortOrder: string;
    productId: number;
    isDelete: number;
    categoryId: number;
    brandId: number;
    ids: null;
    shopId: number;
    introType: string;
    couponId: number;
    shopCategoryId: number;
    withCartSum: number;
    productStatus: number;
}

export interface ProductsListResult {
    categoryId: number;
    brandId: number;
    productTsn: string;
    marketPrice: string;
    shippingTplId: number;
    freeShipping: number;
    productId: number;
    picUrl: string;
    picThumb: string;
    productName: string;
    checkStatus: number;
    checkReason: string;
    shopId: number;
    suppliersId: number;
    productType: number;
    productSn: string;
    productPrice: string;
    productStatus: number;
    isBest: number;
    isNew: number;
    isHot: number;
    productStock: number;
    sortOrder: number;
    productSku: ProductSku[];
    shop: ShopSimple | null;
}

export interface ProductSku {
    skuId: number;
    productId: number;
    skuValue: string;
    skuData: SkuDatum[];
    skuSn: string;
    skuStock: number;
    skuTsn: string;
    skuPrice: string;
}

export interface SkuDatum {
    name: string;
    value: string;
}

export interface ShopSimple {
    statusText: string;
    shopId: number;
    shopTitle: string;
}
