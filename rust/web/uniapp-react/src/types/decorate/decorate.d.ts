import { ComputedRef } from "vue";
// 列表查询时筛选参数类型
export interface ModulesType {
    moduleList: ModuleType[];
    pageModule: ModuleType;
}

export interface EditResult {
    item: {
        data: {
            moduleList?: ModuleType[];
            pageModule?: ModuleType;
        };
    };
}
export interface ModuleType {
    module: {};
    moduleIndex?: number;
    isShow?: boolean;
    active?: boolean;
    type: string;
    text?: string;
    style: number;
    lineType?: number;
    lineStyle?: number;
    blankHeight?: number;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundRepeat: string;
    backgroundSize: string;
    products?: ModuleProductsType;
    title?: ModuleTitleType;
    frame?: ModuleFrameType;
    icoPic?: ModuleIcoPicType;
}
//分类导航结构
export interface ModuleCatNavType {
    navBackgroundPic?: ModuleIcoPicType;
    logoPic?: ModuleIcoPicType;
    itemWidth?: number;
    textColor?: string;
    backgroundColor?: string;
    itemBackgroundColor?: string;
    searchTextColor?: string;
    isGanged?: number;
    logoHeight?: number;
    searchText?: string;
    boxPadding?: number;
    itemRadius?: number;
    boxPaddingTop?: number;
    boxPaddingBottom?: number;
}
//优惠券结构
export interface ModuleCouponType {
    showTitle?: number;
    title?: string;
    desc?: string;
    colorStyle?: number;
    itemBackgroundColor?: string;
    backgroundColor?: string;
    itemPadding?: number;
    boxRadius?: number;
    boxPadding?: number;
    boxPaddingTop?: number;
    boxPaddingBottom?: number;
}
//活动结构
export interface ModuleActivityType {
    style?: number;
    goodsStyle?: number;
    goodsRadius?: number;
    goodsRadioStyle?: number;
    textAlign?: number;
    textWeight?: number;
    goodsNameRow?: number;
    goodsNamePadding?: number;
    showName?: number;
    showBrief?: number;
    showPrice?: number;
    goodsPadding?: number;
    buyBtnStyle?: number;
    backgroundColor?: string;
    boxRadius?: number;
    innerPadding?: number;
    boxPadding?: number;
    boxPaddingTop?: number;
    boxPaddingBottom?: number;
    title?: ModuleTitleType;
}
// 结构
export interface ModuleFrameType {
    textColor?: string;
    itemBackgroundColor?: string;
    itemRadius?: string;
    itemHeight?: string;
    backgroundColor?: string;
    innerPadding?: number;
    boxRadius?: number;
    boxPadding?: number;
    boxPaddingTop?: number;
    boxPaddingBottom?: number;
    titleFontSize?: number;
    titleFontWeight?: number;
    format?: {
        backgroundColor?: string;
        innerPadding?: string;
        boxRadius?: string;
        boxPadding?: string;
        boxPaddingTop?: string;
        boxPaddingBottom?: string;
    };
}

export interface ModuleStyle {
    boxPaddingTopBottom: number;
    boxPaddingTop: number;
    boxPaddingBottom: number;
    boxPadding: number;
    boxMargin?: number;
    backgroundColor: string;
    backgroundPic: {
        picUrl: string;
        picThumb: string;
    };
    backgroundPicFillType: string;
}

export interface ModuleContentStyle {
    paddingTopBottom: number;
    paddingTop: number;
    paddingBottom: number;
    paddingLeftRight: number;
    padding: number;
    boxRadiusTop: number;
    boxRadiusBottom: number;
    boxRadius: number;
    gradientType: string;
    gradientColorA: string;
    gradientColorB: string;
    backgroundColor: string;
    backgroundPic: {
        picUrl: string;
        picThumb: string;
    };
    backgroundPicFillType: string;
    boxShadow: number;
}

export interface ModuleSubTitle {
    showTitle?: number;
    titleFontSize?: number;
    titleFontBold?: number;
    titleColor?: string;
}

// 新人二重礼 newcomerCombo（mobilePromotion 体系：商品横滑 + 优惠券横排复合活动卡片）
// 优惠券 item：admin 端配置仅含 couponId/btnText；运行端期望后端聚合返回 info（完整优惠券信息）
export interface NewcomerCouponItem {
    couponId: number;
    btnText?: string;
    info?: {
        couponName?: string;
        couponType?: number;
        couponMoney?: number;
        couponDiscount?: number;
        minOrderAmount?: number;
        reduceType?: number;
    };
}

export interface NewcomerComboType {
    showHeader?: number;
    headerTitle?: string;
    headerSubTitle?: string;

    showSection1?: number;
    section1Badge?: string;
    section1Title?: string;
    section1MoreLink?: LinkType;
    products?: ModuleProductsType;
    productBriefList?: string[];
    productImgRadius?: number;
    productPicRatio?: "default" | "1:1" | "3:4" | "3:2";
    productPicFillType?: "cover" | "contain";
    productPercent?: number;
    showProductName?: number;
    productItemGap?: number;
    productItemPadding?: number;
    showMarketPrice?: number;
    buyBtnStyle?: number;

    showSection2?: number;
    section2Badge?: string;
    section2Title?: string;
    section2MoreLink?: LinkType;
    couponPerRow?: 1 | 2 | 3 | 4;
    coupons?: NewcomerCouponItem[];

    productTitleColor?: string;
    productBriefColor?: string;
    productPriceColor?: string;
    productMarketPriceColor?: string;
    productBriefGradientStart?: string;
    productBriefGradientEnd?: string;
    productBriefTextColor?: string;
    buyBtnGradientStart?: string;
    buyBtnGradientEnd?: string;
    buyBtnTextColor?: string;

    couponBgGradientStart?: string;
    couponBgGradientEnd?: string;
    couponAmountColor?: string;
    couponConditionColor?: string;
    couponBtnTextColor?: string;

    boxGradientStart?: string;
    boxGradientEnd?: string;
    containerBgImage?: {
        picUrl?: string;
        picThumb?: string;
    };
    contentBgColor?: string;
    decorationBgColor?: string;

    frame?: ModuleFrameType;
}

// 商品 A1（基于 ModuleActivityType 扩展：每商品独立标签 + 卖点 + 标签样式）
// 购买按钮样式（与 admin BuyButtonStyleType 同源；复用共享 commonBuyButton 渲染）
export interface BuyButtonStyleType {
    showBtn?: number;
    btnType?: number; // 0:不显示 1~4:内置iconfont图标 5:自定义图片
    iconImage?: ModulePicListType; // btnType===5 时使用的自定义图片图标
    iconSize?: number; // 图标/图片尺寸（px），缺省回退 14
    text?: string;
    textColor?: string;
    textSize?: number; // 文字字号（px），缺省回退 12
    iconColor?: string;
    gradientType?: string;
    gradientColorA?: string;
    gradientColorB?: string;
    radius?: number;
    paddingTopBottom?: number;
    paddingLeftRight?: number;
    wrap?: number; // 按钮换行显示 0:不换行 1:换行
    wrapAlign?: number; // 换行后对齐 1:居左 2:居中 3:居右
}

export interface ProductA1Type {
    showProductLabel?: number;
    tagList?: string[];
    labelBackgroundColor?: string;
    labelTextColor?: string;
    labelRadius?: number;
    labelRadiusStyle?: number;
    labelFontSize?: number;
    labelPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    labelOffsetX?: number;
    labelOffsetY?: number;
    showMarketPrice?: number;
    nameAlign?: number;
    priceAlign?: number;
    briefList?: string[];
    briefStyle?: ModuleSubTitle;
    briefBackgroundColor?: string;
    itemGap?: number;
    buyBtnStyle?: BuyButtonStyleType; // 购买按钮（复用共享 commonBuyButton 系统）
}

// 限时特惠（mobilePro：整体背景图容器 + 右侧横滑商品卡）
export interface LimitedSpecialType {
    containerBgImage?: {
        picUrl?: string;
        picThumb?: string;
    };
    boxGradientStart?: string;
    boxGradientEnd?: string;
    productAreaLeft?: number;
    productAreaPaddingY?: number;
    moreLink?: LinkType;
    products?: ModuleProductsType;
    productPercent?: number;
    productItemGap?: number;
    productItemPadding?: number;
    productPicRatio?: "default" | "1:1" | "3:4" | "3:2";
    productPicFillType?: "cover" | "contain";
    productImgRadius?: number;
    cardRadius?: number;
    textAlign?: "left" | "center" | "right";
    textWeight?: number;
    priceFontSize?: number;
    priceBold?: number;
    showProductName?: number;
    showPrice?: number;
    showMarketPrice?: number;
    showSales?: number;
    showComment?: number;
    buyBtnStyle?: number;
    showBrief?: number;
    productBriefList?: string[];
    cardBgColor?: string;
    productTitleColor?: string;
    productPriceColor?: string;
    productMarketPriceColor?: string;
    productSalesColor?: string;
    briefGradientStart?: string;
    briefGradientEnd?: string;
    briefTextColor?: string;
    buyBtnGradientStart?: string;
    buyBtnGradientEnd?: string;
    buyBtnTextColor?: string;
    frame?: ModuleFrameType;
}

// 商品滑动（mobilePro；横向滑动主题商品卡：逐卡渐变 + 逐卡标题 + 商品图 + 价格）
export interface ProductSlideType {
    products?: ModuleProductsType;
    cardTitleList?: string[];
    cardGradientStartList?: string[];
    cardGradientEndList?: string[];
    cardStyle?: "noBorderWhite" | "shadow" | "border" | "transparent";
    productPicFillType?: "cover" | "contain";
    productImgRadius?: number;
    showImagePlatform?: number;
    productPicRatio?: "default" | "1:1" | "3:4" | "3:2";
    textWeight?: number;
    textAlign?: "left" | "center" | "right";
    layerGap?: number;
    productItemGap?: number;
    productPercent?: number;
    cardRadius?: number;
    showProductName?: number;
    showFeature?: number;
    showBrief?: number;
    showPrice?: number;
    showSales?: number;
    showMarketPrice?: number;
    buyBtnStyle?: number;
    showSlidePeek?: number;
    detailJumpMode?: "default" | "native";
    priceFontSize?: number;
    priceBold?: number;
    cardTitleColor?: string;
    briefColor?: string;
    descColor?: string;
    productPriceColor?: string;
    productMarketPriceColor?: string;
    productSalesColor?: string;
    badgeColor?: string;
    buyBtnTextColor?: string;
    buyBtnGradientStart?: string;
    buyBtnGradientEnd?: string;
    innerBgColor?: string;
    moduleBgImage?: {
        picUrl?: string;
        picThumb?: string;
    };
    frame?: ModuleFrameType;
}

// 商品轮播（mobilePro；原生 swiper 露邻轮播：中间大卡两侧露出 + 缩放，选商品自动带信息）
export type ProductCarouselCardStyle = "noBorderWhite" | "shadow" | "border" | "transparent";
export type ProductCarouselPicRatio = "default" | "1:1" | "3:4" | "3:2";
export type ProductCarouselBgMode = "normal" | "repeat" | "fixed";

export interface ProductCarouselBuyBtnStyle {
    showBtn?: number;
    btnType?: number;
    text?: string;
    textColor?: string;
    iconColor?: string;
    gradientType?: string;
    gradientColorA?: string;
    gradientColorB?: string;
    radius?: number;
    paddingTopBottom?: number;
    paddingLeftRight?: number;
}

export interface ProductCarouselItem {
    productId?: number;
    productName?: string;
    productDesc?: string;
    productPrice?: number | string;
    marketPrice?: number | string;
    salesVolume?: number;
    picThumb?: string;
    picUrl?: string;
    picLarge?: string;
}

export interface ProductCarouselType {
    productList?: ProductCarouselItem[];
    showModuleTitle?: number;
    moduleTitle?: string;
    moduleTitleColor?: string;
    titleContentGap?: number;
    autoplay?: number;
    cardWidthPercent?: number;
    cardStyle?: ProductCarouselCardStyle;
    goodsRadius?: number;
    picBottomRadius?: number;
    productPicRatio?: ProductCarouselPicRatio;
    textWeight?: number;
    textAlign?: "left" | "center" | "right";
    itemGap?: number;
    innerPadding?: number;
    showName?: number;
    showDesc?: number;
    showPrice?: number;
    showMarketPrice?: number;
    showSales?: number;
    buyBtnStyle?: ProductCarouselBuyBtnStyle;
    productTitleColor?: string;
    descColor?: string;
    priceColor?: string;
    marketPriceColor?: string;
    salesColor?: string;
    badgeColor?: string;
    moduleBgImage?: {
        picUrl?: string;
        picThumb?: string;
    };
    bgImageMode?: ProductCarouselBgMode;
    frame?: ModuleFrameType;
}

// 标题

export interface ModuleTitleType {
    showTitle?: number;
    titleStyle?: number;
    titleAlign?: number;
    titleBackground?: string;
    titleBackground2?: string;
    titleBackgroundPic?: {
        picUrl?: string;
        picThumb?: string;
    };
    titleRadius?: number;
    titleText?: string;
    titleColor?: string;
    descText?: string;
    descColor?: string;
    showMore?: number;
    moreLink?: any;
    moreColor?: string;
    format?: {
        titleBackground?: string;
        titleRadius?: string;
    };
}
export interface ModuleImageType {
    picType: number;
    picPageType: number;
    navType?: number;
    navStyle?: number;
    rowNum?: number;
    colNum?: number;
    radioStyle?: number;
    swiperPageColor?: string;
    swiperPreView?: number;
    imgPadding?: number;
    isFluxWidth?: number;
    picRadioStyle?: number;
    picList: ModulePicListType[];
    format?: {
        imgPadding?: string;
    };
}
// 图片橱窗 imageShowcase（mobilePro 新体系：moduleStyle + contentStyle）
// 比例字面量；'default' 表示不锁比例，按图片原始尺寸
export type ImageShowcasePicRatio = "default" | "3:2" | "1:1" | "3:4" | "2:1" | "16:9";
export type ImageShowcaseListStyle = "fixed" | "scroll";
export type ImageShowcasePicFillType = "cover" | "contain";

export interface ImageShowcaseType {
    picList: ModulePicListType[];
    rowNum: 1 | 2 | 3 | 4 | 5 | 6;
    listStyle: ImageShowcaseListStyle;
    picRatio: ImageShowcasePicRatio;
    picFillType: ImageShowcasePicFillType;
    picRadius: number;
    imgPadding: number;
    boxShadow: 0 | 1;
    moduleStyle?: ModuleStyle;
    contentStyle?: ModuleContentStyle;
}

// 标签导航 tagNav（mobilePro 新体系：moduleStyle）
export interface ModuleTagNavGroupType {
    title?: string; // 标签标题
    link?: ModuleLinkListType; // 跳转链接
}
export interface ModuleTagNavColorType {
    colorA?: string; // 渐变起始色
    colorB?: string; // 渐变结束色
}
export interface ModuleTagNavType {
    groupList?: ModuleTagNavGroupType[]; // 标签列表（标题 + 链接）
    textWeight?: number; // 文本样式 400 常规 / 700 加粗
    groupGap?: number; // 标签间距
    groupPadding?: number; // 标签内部左右内边距
    categoryColors?: ModuleTagNavColorType[]; // 渐变色，标签按 index % 长度 循环取色
    titleColor?: string; // 标签标题文字色
    titleBgColor?: string; // 标签标题文字背景色（默认透明）
    moduleStyle?: ModuleStyle; // 模块样式
}

// 热图
export interface ModuleImageHotareaType {
    picList?: ModuleImageHotareaPicListType[];
    imgPadding: number;
    picRadioStyle?: number;
    format?: {
        imgPadding?: string;
    };
}
export interface ModuleImageHotareaPicListType {
    picTitle?: string;
    picUrl?: string;
    picDesc?: string;
    hotarea?: HotareaType[];
}

export interface HotareaType {
    link?: LinkType;
    title?: string;
    width?: number;
    height?: number;
    left?: number;
    top?: number;
    position?: string;
}

// 商品
export interface ModuleProductsType {
    productSelectType?: number;
    productIds?: number[];
    productCategoryId?: number;
    productNumber?: number;
    productTag?: string;
}
export interface ModulePicListType {
    picUrl?: string;
    picThumb?: string;
    picLink?: {
        link?: string;
        title?: string;
    };
    picTitle?: string;
    picDesc?: string;
}
export interface ModuleLinkListType {
    link?: {
        link?: string;
        title?: string;
    };
    linkTitle?: string;
}

//公告图标
export interface ModuleIcoPicType {
    picUrl?: string;
    picThumb?: string;
}

export interface FilterParams {
    page: number;
    size: number;
    sortField: string;
    sortOrder: string;
    keyword?: string;
    isShow?: number;
}

// 获取列表返回参数类型
export interface FilterResult {
    records: FilterState[];
    filter: {
        page: number;
    };
    total: number;
}
export interface FilterState {
    exampleId?: number;
    exampleName?: string;
    exampleLogo?: string;
    isShow?: boolean;
    sortOrder?: number;
}

// 获取详情返回参数类型
export interface FormResult {
    item: FormState;
}
export interface FormState {
    exampleName?: string;
    exampleLogo?: string;
    exampleDesc?: string;
    sortOrder?: string;
    isShow?: number;
}
// PC端
export interface PcPageHeaderType {
    logo?: {
        picUrl?: string;
        picThumb?: string;
    };
    headerStyle?: number;
}
export interface PcCatProductType {
    categoryId?: number;
    title?: string;
    shortTitle?: string;
    enTitle?: string;
    color?: string;
    color2?: string;
    picList?: ModulePicListType[];
    picList2?: ModulePicListType[];
    picList3?: ModulePicListType[];
    linkList?: ModuleLinkListType[];
    productIds?: number[];
}
export interface PcBannerType {
    logo?: {
        picUrl?: string;
        picThumb?: string;
    };
    bannerStyle?: number;
    showCat?: number;
    picList?: ModulePicListType[];
    picList2?: ModulePicListType[];
    picList3?: ModulePicListType[];
}

export interface PcCustomAd1Type {
    picList?: ModulePicListType[];
    picList2?: ModulePicListType[];
    picList3?: ModulePicListType[];
}
export interface PcCustomAd2Type {
    linkList?: ModuleLinkListType[];
    picList?: ModulePicListType[];
    picList2?: ModulePicListType[];
    picList3?: ModulePicListType[];
}
export interface PcRecommendProduct {
    titleName?: string;
    products?: ModuleProductsType;
}
export interface PcSeckillType {
    seckillTitle?: string;
}

export interface LinkType {
    path?: string;
    name?: string;
    label?: string;
    id?: number;
    sn?: string;
    link?: string;
    appLink?: string;
}
