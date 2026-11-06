export interface PicItem {
    picId: number;
    picThumb: string;
    picUrl: string;
    picName: string;
}

export interface TitleBackgroundPic {
    picUrl: string;
    picThumb: string;
}

export interface TitleFormat {
    titleBackground: string;
    titleRadius: string;
}

export interface Title {
    showTitle: number;
    titleStyle: number;
    titleBackground: string;
    titleBackgroundPic: TitleBackgroundPic;
    titleRadius: number;
    titleText: string;
    descText: string;
    descColor: string;
    showMore: number;
    moreLink: any[]; // 这里假设more_link是一个任意对象数组，具体类型需要根据实际情况补充
    moreColor: string;
    format: TitleFormat;
}

export interface Frame {
    backgroundColor: string;
    innerPadding: number;
    boxRadius: number;
    boxPadding: number;
    boxPaddingTop: number;
    boxPaddingBottom: number;
}

export interface Module {
    picType: number;
    picList: PicItem[];
    swiperPreView: number;
    swiperPageColor: string;
    imgPadding: number;
    picPageType: number;
    picRadioStyle: number;
    isFluxWidth: number;
    frame: Frame;
    title: Title;
}

export interface ModuleListItem {
    type: string;
    label: string;
    module: Module;
    isShow: boolean;
    moduleIndex: number;
    active: boolean;
}
interface BackgroundImage {
    picUrl: string;
    picThumb: string;
    picId: string;
    picName: string;
}

export interface PageModule {
    backgroundColor: string;
    backgroundImage: BackgroundImage;
    backgroundRepeat: string;
    backgroundSize: string;
    colorStyle: string;
    headerStyle: string;
    module: any[]; // 如果知道具体模块类型，可以替换为更具体的类型
    style: string;
    title: string;
    titleBackgroundColor: string;
    titleColor: string;
    type: string;
}

// 首页
export interface HomeResponse {
    message: string;
    data: HomeData;
    code: number;
}

export interface HomeData {
    moduleList: ModuleListItem[];
    decorateId: number;
    /** 后端 DecorateModuleListVO.bindDecorateId：H5 端命中后跳转 PC 对应装修页（旧项目 4 处使用，类型定义此前缺失） */
    bindDecorateId?: number;
    pageModule: PageModule;
}

/*      分类商品列表    */
export interface GetCateProductFilterParams {
    categoryId?: number;
    page: number;
    size?: number;
    keyword?: string;
    shopId?: number;
    productGroupId?: number | string;
    deliveryTypes?: string;
}

export interface GetCateProductResponse {
    data: GetCateProductData;
    code: number;
    message: string;
}

export interface GetCateProductData {
    records: GetProductFilterResult[];
    filter: Filter;
    total: number;
    waitingCheckedCount: number;
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
}

export interface GetProductFilterResult {
    productId?: number;
    picThumb?: string;
    picUrl?: string;
    productName?: string;
    checkStatus?: number;
    shopId?: number;
    suppliersId?: number;
    productType?: number;
    productSn?: string;
    productPrice?: number;
    marketPrice?: number;
    productStatus?: number;
    isBest?: number;
    isNew?: number;
    isHot?: number;
    productStock?: number;
    sortOrder?: number;
    seckillPrice?: number;
    orgProductPrice?: number;
    isCheck?: boolean;
    quantity?: number;
    price: number;
    deliveryMode?: number;
    deliveryType?: number;
}

/* 秒杀 */
export interface SeckillListResponse {
    data: SeckillListData;
    code: number;
    message: string;
}

export interface SeckillListData {
    records: SeckillList[];
    total: number;
}

export interface SeckillList {
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
    seckillPrice: string;
    orgProductPrice: string;
    productSku: ProductSku[];
    seckillLimitNum: number;
    seckillSales: number;
    seckkillData: SeckkillData;
    canJoin?: boolean;
    restrictTip?: string;
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

export interface SeckkillData {
    seckillId: number;
    seckillName: string;
    seckillStartTime: string;
    seckillEndTime: string;
    seckillLimitNum: number;
    productId: number;
    seckillItem: SeckillItem[];
}

export interface SeckillItem {
    seckillId: number;
    productId: number;
}

/* 优惠券 */
export interface CouponResponse {
    data: CouponList[];
    code: number;
    message: string;
}

export interface CouponList {
    isReceive: number;
    couponId: number;
    couponName: string;
    couponMoney: string;
    couponDiscount: number;
    couponDesc: string;
    couponType: number;
    sendRange: number;
    sendRangeData: number[];
    minOrderAmount: string;
    sendStartDate: string;
    sendEndDate: string;
    sendType: number;
    useDay: number;
    useStartDate: string;
    useEndDate: string;
    isShow: number;
    isGlobal: number;
    isNewUser: number;
    enabledClickGet: number;
    limitUserRank: null;
    shopId: number;
}

export interface GrouponItem {
    grouponPromotionItemId: number;
    productId: number;
    minGrouponPrice: number;
    productName: string;
    productBrief?: string;
    productPrice: number;
    picThumb: string;
    picUrl: string;
    joinNumCount: number;
    startTime: string;
    endTime: string;
    minGroupNum: number;
    grouponPrice: number; // 拼团价格
    groupNum: string;
    canJoin?: boolean;
    restrictTip?: string;
}

// 拼团
export interface GrouponItemListResponse {
    data: GrouponItemListtData;
    code: number;
    message: string;
}

export interface GrouponItemListtData {
    records: GrouponItem[];
    total: number;
}

export interface GrouponItem {
    grouponPromotionItemId: number;
    productId: number;
    minGrouponPrice: number;
    productName: string;
    productBrief?: string;
    productPrice: number;
    picThumb: string;
    picUrl: string;
    joinNumCount: number;
    startTime: string;
    endTime: string;
    minGroupNum: number;
    grouponPrice: number; // 拼团价格
    groupNum: string;
    canJoin?: boolean;
    restrictTip?: string;
}

export interface WechatLiveRoomFilterParams {
    keyword?: string;
    liveStatus?: number;
    startTime?: string;
    endTime?: string;
    sortField?: string;
    sortOrder?: string;
    page: number;
    size: number;
}

export interface WechatLiveRoomState {
    wechatLiveId: number;
    roomId: number;
    roomIdStr: string;
    name: string;
    wechatLiveTitle?: string;
    coverImg?: string;
    shareImg?: string;
    feedsImg?: string;
    shareCardCover?: string;
    liveCardCover?: string;
    backgroundWall?: string;
    anchorName?: string;
    anchorWechat?: string;
    anchorOpenid?: string;
    isOfficialFeed?: number;
    isFeedsPublic?: number;
    auditStatus?: number;
    auditStatusText?: string;
    liveStatus?: number;
    liveStatusText?: string;
    startTime?: string;
    endTime?: string;
    createTime?: string;
    lastUpdateTime?: string;
}

export interface WechatLiveRoomFilterResult {
    records: WechatLiveRoomState[];
    total: number;
}

export interface WechatLiveGoodsState {
    id: number;
    roomId: number;
    wechatGoodsId?: number;
    productId?: number;
    goodsName?: string;
    coverImg?: string;
    price?: number;
    priceType?: number;
    url?: string;
    auditStatus?: number;
    auditStatusText?: string;
    sort?: number;
    isShow?: number;
}
