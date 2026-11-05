/**
 * 模块共享默认值与样式工具（从 view/admin src/modules/index.ts 逐字段移植，契约冻结）
 */

// 默认值均为纯 JSON 结构，JSON 序列化深拷贝足够（与 lodash cloneDeep 行为一致）
export const cloneDeep = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// 模块设置默认值
export const defaultFrame = {
    textColor: "",
    itemBackgroundColor: "",
    backgroundColor: "#ffffff",
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 10,
    leftAndRightPadding: 0,
    boxPaddingTop: 5,
    boxPaddingBottom: 5
};
// 标题默认值
export const defaultTitle = {
    showTitle: 0,
    titleStyle: 1,
    titleAlign: 1,
    titleBackground: "",
    titleBackground2: "",
    titleBackgroundPic: {
        picUrl: "",
        picThumb: ""
    },
    titleRadius: 0,
    titleText: "标题内容",
    titleColor: "",
    titleWeight: "normal",
    descText: "",
    descColor: "#aaaaaa",
    showMore: 0,
    // 标题右侧内容类型：1=显示更多链接，2=显示倒计时（仅拼团/秒杀等模块开启二选）
    moreType: 1,
    countdownLabel: "",
    moreLink: [],
    moreColor: "#aaaaaa",
    format: {
        titleBackground: "",
        titleRadius: ""
    }
};
// 图片环东效果
export const defaultAnimation = {
    type: "scale",
    duration: 0.5,
    delay: 0.2,
    range: 0.5
};
// 小标题默认值
export const defaultSubTitle = {
    showTitle: 1,
    titleColor: "#454545",
    titleFontSize: 12,
    titleFontBold: 400
};
// 模块样式默认值
export const defaultModuleStyle = {
    boxPaddingTopBottom: 0, // 模块上下间距
    boxPaddingTop: 5, // 模块顶部间距
    boxPaddingBottom: 0, // 模块底部间距
    boxPadding: 10, // 模块左右间距
    boxMargin: 0, // 模块左右外间距
    bannerMarginTop: 10, // banner顶部间距
    backgroundColor: "", // 背景颜色
    backgroundPic: {
        // 背景图片
        picUrl: "",
        picThumb: ""
    },
    backgroundPicFillType: "cover" // 背景图片填充方式
};
// 内容区样式默认值
export const defaultContentStyle = {
    paddingTopBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeftRight: 0,
    padding: 0,
    boxRadiusTop: 0,
    boxRadiusBottom: 0,
    boxRadius: 0,
    gradientType: "upDown",
    gradientColorA: "",
    gradientColorB: "",
    backgroundColor: "",
    backgroundPic: {
        picUrl: "",
        picThumb: ""
    },
    backgroundPicFillType: "cover",
    boxShadow: 0
};

// 购买按钮样式默认值
export const defaultBuyButtonStyle = {
    showBtn: 1, // 是否显示按钮
    btnType: 1, // 按钮类型 0:不显示 1~4:内置图标 5:自定义图片
    iconImage: { picUrl: "", picThumb: "" }, // 自定义图片图标（btnType===5 时使用）
    iconSize: 14, // 图标/图片尺寸（px）
    text: "", // 按钮文字
    textColor: "#ffffff", // 按钮文字颜色
    textSize: 12, // 文字字号（px）
    iconColor: "#ffffff", // 按钮图标颜色
    gradientType: "leftRight", // 按钮背景渐变类型
    gradientColorA: "#333333", // 按钮背景渐变颜色A
    gradientColorB: "#333333", // 按钮背景渐变颜色B
    radius: 16, // 按钮圆角
    paddingTopBottom: 0, // 按钮高度
    paddingLeftRight: 10, // 按钮宽度
    wrap: 0, // 按钮换行显示 0:不换行 1:换行
    wrapAlign: 2 // 换行后对齐 1:居左 2:居中 3:居右
};

// 商品默认值
export const defaultProducts = {
    productSelectType: 1,
    productIds: [],
    productCategoryId: [],
    productNumber: 0,
    productTag: ""
};
// 商品 A1（基于 mobile/product 增强，4 种模板 + 商品标签 + 商品卖点）
export const defaultProductA1Frame = {
    textColor: "",
    itemBackgroundColor: "",
    backgroundColor: "",
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 0,
    leftAndRightPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0
};
export const defaultProductA1 = {
    style: 1,
    goodsStyle: 1,
    goodsRadius: 0,
    textAlign: 1,
    textWeight: 1,
    goodsNameRow: 2,
    goodsNamePadding: 1,
    showName: 1,
    showBrief: 1,
    showPrice: 1,
    showMarketPrice: 0,
    nameAlign: 1,
    priceAlign: 1,
    goodsPadding: 0,
    buyBtnStyle: cloneDeep(defaultBuyButtonStyle),
    backgroundColor: "",
    boxRadius: 0,
    innerPadding: 0,
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    imgPadding: 1,
    showProductLabel: 1,
    tagList: [],
    labelBackgroundColor: "#3DC275",
    labelTextColor: "#FFFFFF",
    labelRadius: 8,
    labelRadiusStyle: 0,
    labelFontSize: 12,
    labelPosition: "top-left",
    labelOffsetX: 0,
    labelOffsetY: 0,
    briefList: [],
    briefStyle: {
        showTitle: 1,
        titleColor: "#FF6600",
        titleFontSize: 11,
        titleFontBold: 400
    },
    briefBackgroundColor: "#FFF1E6",
    itemGap: 0,
    frame: cloneDeep(defaultProductA1Frame),
    products: cloneDeep(defaultProducts)
};
// 新人二重礼（mobilePro 桶；商品 + 优惠券双 section 复合活动卡片）
export const defaultNewcomerComboFrame = {
    textColor: "",
    itemBackgroundColor: "",
    backgroundColor: "",
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 8,
    boxPadding: 10,
    leftAndRightPadding: 0,
    boxPaddingTop: 5,
    boxPaddingBottom: 5
};
export const defaultNewcomerCombo = {
    showHeader: 1,
    headerTitle: "新人专享二重礼",
    headerSubTitle: "限量供应 先到先得",

    showSection1: 1,
    section1Badge: "1重礼",
    section1Title: "新人尝鲜价",
    section1MoreLink: { link: "", title: "" },
    products: cloneDeep(defaultProducts),
    productBriefList: [],
    productImgRadius: 8,
    productPicRatio: "1:1",
    productPicFillType: "cover",
    productPercent: 28,
    showProductName: 1,
    productItemGap: 8,
    productItemPadding: 6,
    showMarketPrice: 1,
    buyBtnStyle: 3,

    showSection2: 1,
    section2Badge: "2重礼",
    section2Title: "新人专享礼包",
    section2MoreLink: { link: "", title: "" },
    couponPerRow: 3,
    coupons: [],

    productTitleColor: "#333333",
    productBriefColor: "#999999",
    productPriceColor: "#FF3630",
    productMarketPriceColor: "#999999",
    productBriefGradientStart: "#FF3630",
    productBriefGradientEnd: "#FF7A45",
    productBriefTextColor: "#FFFFFF",
    buyBtnGradientStart: "#4CD964",
    buyBtnGradientEnd: "#2EBA4F",
    buyBtnTextColor: "#FFFFFF",

    couponBgGradientStart: "#FFF1F1",
    couponBgGradientEnd: "#FFFFFF",
    couponAmountColor: "#FF3630",
    couponConditionColor: "#FF3630",
    couponBtnTextColor: "#FF3630",

    boxGradientStart: "#FF3630",
    boxGradientEnd: "#FF7A45",
    containerBgImage: {
        picUrl: "https://oss.tigshop.com/official/img/pc/202605/1779692078Y9XiHswWUHUVbVb9Aw.webp",
        picThumb: "https://oss.tigshop.com/official/img/pc/202605/1779692078Y9XiHswWUHUVbVb9Aw.webp"
    },
    contentBgColor: "#FFFFFF",
    decorationBgColor: "#FFFFFF",

    frame: cloneDeep(defaultNewcomerComboFrame)
};
// 公告图标图片
export const defaultIcoPic = {
    picUrl: "",
    picThumb: ""
};
// 背景图
export const defaultBackgroundPic = {
    picUrl: "",
    picThumb: ""
};
// 移动端登录页模块默认值：取当前 o2o/标准版登录页展示效果（与 baseLogin.vue 各 CSS 变量兜底一致）
// 链接色/按钮色跟随主题（var(--general)/var(--main-bg)），留空表示继承主题，不写死
// 边距按 px 存储：Admin 直接当 px 用，uniapp 按 px*2 rpx 换算（默认左右 20px→40rpx、顶部 0）
export const defaultMobileLogin = {
    titleColor: "#333333",
    subTextColor: "#999999",
    inputTextColor: "#252525",
    placeholderColor: "#252525",
    linkColor: "",
    buttonColor: "",
    dividerColor: "#eeeeee",
    contentPaddingX: 20,
    contentPaddingTop: 0
};
// 合并默认值（与 Vue 版行为一致：undefined/null/空串 时用默认值回填，原地写回）
export const mergeDefaultModule = (module: any, defaultModule: any) => {
    const dm = cloneDeep(defaultModule);
    Object.keys(dm).forEach((key) => {
        if (module[key] === undefined || module[key] === null || module[key] === "") {
            module[key] = dm[key];
        }
    });
};
// 格式化模块设置
export const formatFrame = (frame: any) => {
    return {
        innerPadding: "padding:" + frame.innerPadding + "px;",
        boxPadding: "margin-left:" + frame.boxPadding + "px;margin-right:" + frame.boxPadding + "px;",
        boxPaddingTop: "padding-top:" + frame.boxPaddingTop + "px;",
        boxPaddingBottom: "padding-bottom:" + frame.boxPaddingBottom + "px;",
        backgroundColor: frame.backgroundColor ? "background-color:" + frame.backgroundColor + ";" : "",
        boxRadius: "border-radius:" + frame.boxRadius + "px;"
    };
};
// 格式化标题
export const formatTitle = (title: any) => {
    let backgroundText = title.titleBackground2
        ? `background:linear-gradient(to right, ${title.titleBackground}, ${title.titleBackground2});`
        : title.titleBackground
          ? "background-color:" + title.titleBackground + ";"
          : "";
    return {
        titleBackground: backgroundText,
        titleRadius: "border-radius:" + title.titleRadius + "px " + title.titleRadius + "px " + "0 0;"
    };
};

export const gradientMap: { [key: string]: string } = {
    upDown: "to bottom",
    leftRight: "to right",
    diagonal: "to right bottom"
};

export const formatCommonStyle = (moduleStyle: any, moduleContentStyle?: any, moduleSubTitle?: any) => {
    const obj: { moduleStyle: any; moduleContentStyle: any; moduleSubTitle: any } = {
        moduleStyle: {},
        moduleContentStyle: {},
        moduleSubTitle: {}
    };
    if (moduleStyle) {
        obj.moduleStyle = {
            boxPaddingTopBottom: `padding-top:${moduleStyle.boxPaddingTopBottom}px;padding-bottom:${moduleStyle.boxPaddingTopBottom}px;`,
            boxPadding: "padding-left:" + moduleStyle.boxPadding + "px;padding-right:" + moduleStyle.boxPadding + "px;",
            boxMargin: "margin-left:" + (moduleStyle.boxMargin ?? 0) + "px;margin-right:" + (moduleStyle.boxMargin ?? 0) + "px;",
            boxPaddingTop: "padding-top:" + moduleStyle.boxPaddingTop + "px;",
            boxPaddingBottom: "padding-bottom:" + moduleStyle.boxPaddingBottom + "px;",
            backgroundColor: moduleStyle.backgroundColor ? "background-color:" + moduleStyle.backgroundColor + ";" : "",
            backgroundImage: moduleStyle.backgroundPic.picUrl
                ? "background-image:url(" + moduleStyle.backgroundPic.picUrl + ");"
                : `background-color:${moduleStyle.backgroundColor};`,
            backgroundSize: `background-size: ${moduleStyle.backgroundPicFillType};`
        };
    }
    if (moduleContentStyle) {
        obj.moduleContentStyle = {
            paddingLeftRight: "padding-left:" + moduleContentStyle.paddingLeftRight + "px;padding-right:" + moduleContentStyle.paddingLeftRight + "px;",
            paddingTopBottom: "padding-top:" + moduleContentStyle.paddingTopBottom + "px;padding-bottom:" + moduleContentStyle.paddingTopBottom + "px;",
            paddingTop: "padding-top:" + moduleContentStyle.paddingTop + "px;",
            paddingBottom: "padding-bottom:" + moduleContentStyle.paddingBottom + "px;",
            innerPadding: "padding:" + moduleContentStyle.padding + "px;",
            backgroundColor: moduleContentStyle.backgroundColor ? "background-color:" + moduleContentStyle.backgroundColor + ";" : "",
            backgroundImage: moduleContentStyle.backgroundPic?.picUrl
                ? "background-image:url(" + moduleContentStyle.backgroundPic.picUrl + ");"
                : `background-image: linear-gradient( ${gradientMap[moduleContentStyle.gradientType]}, ${
                      moduleContentStyle.gradientColorA
                  }, ${moduleContentStyle.gradientColorB});`,
            backgroundSize: `background-size: ${moduleContentStyle.backgroundPicFillType};`,
            boxRadius: `border-radius:${moduleContentStyle.boxRadiusTop}px ${moduleContentStyle.boxRadiusTop}px ${moduleContentStyle.boxRadiusBottom}px ${moduleContentStyle.boxRadiusBottom}px;`,
            boxRadius2: `border-radius:${moduleContentStyle.boxRadius}px;`,
            boxShadow: moduleContentStyle.boxShadow === 1 ? "box-shadow:rgba(0, 0, 0, 0.06) 0px 2px 4px;" : ""
        };
    }

    if (moduleSubTitle) {
        obj.moduleSubTitle = {
            textFontSize: "font-size:" + moduleSubTitle.titleFontSize + "px;",
            textBlod: "font-weight:" + moduleSubTitle.titleFontBold + ";",
            textColor: "color:" + moduleSubTitle.titleColor + ";"
        };
    }
    return obj;
};

export const formatAnimation = (type: string, range: number) => {
    const num = range ? 50 * range : 50 * 0.3;
    switch (type) {
        case "close":
            return ``;
        case "scale":
            return `transform: translate(0px, 0px) scale(${range});opacity:0;`;
        case "slideLeft":
            return `transform: translate(-${num}px, 0px) scale(1);opacity:0;`;
        case "slideRight":
            return `transform: translate(${num}px, 0px) scale(1);opacity:0;`;
        case "slideTop":
            return `transform: translate(0px, ${num}px) scale(1);opacity:0;`;
        case "flip":
            return `transform: translate(0px, 0px) scale(1) rotateY(-180deg);opacity:0;`;
        default:
            return "";
    }
};

export const copyArray = (data: any, num = 1) => {
    let result: any = [];
    for (let i = 0; i < num; i++) {
        if (data && typeof data === "object") {
            result = [...result, ...data];
        } else {
            result = [...result, data];
        }
    }
    return result;
};

export const getDemoList = (list: any) => {
    return list.filter((item: any) => item.productId === 0);
};

// 图片橱窗模块默认演示图片（运营首次拖入时预填；用户删除/替换后不会被填回）
export const defaultImageShowcaseDemoPics = [
    {
        picUrl: "https://oss.tigshop.com/official/img/pc/202605/1779261324QXU5nLdH8b4qUF4CM9.png",
        picThumb: "https://oss.tigshop.com/official/img/pc/202605/1779261324QXU5nLdH8b4qUF4CM9.png",
        picLink: { link: "", title: "" }
    },
    {
        picUrl: "https://oss.tigshop.com/official/img/pc/202605/1779261403hf5gGaRtlmALGOCmT6.png",
        picThumb: "https://oss.tigshop.com/official/img/pc/202605/1779261403hf5gGaRtlmALGOCmT6.png",
        picLink: { link: "", title: "" }
    },
    {
        picUrl: "https://oss.tigshop.com/official/img/pc/202605/1779261407JZ1O44iECmXJHhfmiL.png",
        picThumb: "https://oss.tigshop.com/official/img/pc/202605/1779261407JZ1O44iECmXJHhfmiL.png",
        picLink: { link: "", title: "" }
    },
    {
        picUrl: "https://oss.tigshop.com/official/img/pc/202605/1779261410fhPHeqONn0LxCVgtRZ.png",
        picThumb: "https://oss.tigshop.com/official/img/pc/202605/1779261410fhPHeqONn0LxCVgtRZ.png",
        picLink: { link: "", title: "" }
    }
];

// 图片橱窗模块默认值
export const defaultImageShowcase = {
    picList: cloneDeep(defaultImageShowcaseDemoPics),
    rowNum: 4,
    listStyle: "fixed",
    picRatio: "default",
    picFillType: "cover",
    picRadius: 8, // 0 = 直角，>0 = 圆角
    imgPadding: 4,
    boxShadow: 1,
    moduleStyle: cloneDeep(defaultModuleStyle),
    contentStyle: cloneDeep(defaultContentStyle)
};

// 图片橱窗：比例字面量 → padding-top 百分比（兼容小程序，不依赖 aspect-ratio）
export const imageShowcasePaddingMap: Record<string, string> = {
    default: "", // 不锁比例，图片按原始尺寸显示
    "3:2": "66.667%", // 高:宽 = 2:3
    "1:1": "100%",
    "3:4": "133.333%", // 高:宽 = 4:3
    "2:1": "50%", // 高:宽 = 1:2
    "16:9": "56.25%" // 高:宽 = 9:16
};

// 限时特惠（mobilePro 桶；整体背景图容器 + 右侧横滑商品橱窗）
export const defaultLimitedSpecialFrame = {
    textColor: "",
    itemBackgroundColor: "",
    backgroundColor: "",
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 8,
    boxPadding: 10,
    leftAndRightPadding: 0,
    boxPaddingTop: 5,
    boxPaddingBottom: 5
};
export const defaultLimitedSpecial = {
    containerBgImage: {
        picUrl: "https://cdn.tigshop.com/decorate/FuLzFYlWSi2UWRyPGIQuBX8EBv53.jpg",
        picThumb: "https://cdn.tigshop.com/decorate/FuLzFYlWSi2UWRyPGIQuBX8EBv53.jpg"
    },
    boxGradientStart: "#FF9EC4",
    boxGradientEnd: "#FF6FA8",
    productAreaLeft: 38,
    productAreaPaddingY: 8,
    moreLink: { link: "", title: "" },

    products: cloneDeep(defaultProducts),

    productPercent: 30,
    productItemGap: 8,
    productItemPadding: 6,
    productPicRatio: "1:1",
    productPicFillType: "cover",
    productImgRadius: 8,
    cardRadius: 8,
    textAlign: "center",
    textWeight: 400,
    priceFontSize: 13,
    priceBold: 1,

    showProductName: 0,
    showPrice: 1,
    showMarketPrice: 0,
    showSales: 0,
    showComment: 0,
    buyBtnStyle: 0,
    showBrief: 0,
    productBriefList: [],

    cardBgColor: "#FFFFFF",
    productTitleColor: "#333333",
    productPriceColor: "#FF3B8B",
    productMarketPriceColor: "#999999",
    productSalesColor: "#999999",
    briefGradientStart: "#FF3B8B",
    briefGradientEnd: "#FF7AB0",
    briefTextColor: "#FFFFFF",
    buyBtnGradientStart: "#FF3B8B",
    buyBtnGradientEnd: "#FF7AB0",
    buyBtnTextColor: "#FFFFFF",

    frame: cloneDeep(defaultLimitedSpecialFrame)
};

// 商品滑动（mobilePro 桶；横向滑动主题商品卡）
export const defaultProductSlideFrame = {
    textColor: "",
    itemBackgroundColor: "",
    backgroundColor: "",
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 16,
    boxPadding: 8,
    leftAndRightPadding: 0,
    boxPaddingTop: 5,
    boxPaddingBottom: 0
};
export const defaultProductSlide = {
    products: cloneDeep(defaultProducts),

    cardTitleList: ["服饰专场", "奶粉专场", "母婴健康", "IP专场"],
    cardGradientStartList: ["#B6A8F5", "#FF8FB8", "#FFD98A", "#C7BEF8"],
    cardGradientEndList: ["#8E7BF0", "#FF5E96", "#FBC25A", "#9C8CF0"],

    cardStyle: "transparent",
    productPicFillType: "cover",
    productImgRadius: 12,
    showImagePlatform: 0,
    productPicRatio: "1:1",
    textWeight: 700,
    textAlign: "center",
    layerGap: 10,
    productItemGap: 10,
    productPercent: 42,
    cardRadius: 16,

    showProductName: 1,
    showFeature: 0,
    showBrief: 0,
    showPrice: 1,
    showSales: 0,
    showMarketPrice: 0,
    buyBtnStyle: 0,
    showSlidePeek: 1,
    detailJumpMode: "default",

    priceFontSize: 15,
    priceBold: 1,

    cardTitleColor: "#FFFFFF",
    briefColor: "#FFFFFF",
    descColor: "#FFFFFF",
    productPriceColor: "#FFFFFF",
    productMarketPriceColor: "#FFFFFF",
    productSalesColor: "#FFFFFF",
    badgeColor: "#FE3A01",
    buyBtnTextColor: "#FFFFFF",
    buyBtnGradientStart: "#FF6FA8",
    buyBtnGradientEnd: "#FF3B8B",

    innerBgColor: "#FFFFFF",
    moduleBgImage: { picUrl: "", picThumb: "" },

    frame: cloneDeep(defaultProductSlideFrame)
};

// 商品轮播（mobilePro 桶；真·Swiper 露邻轮播 + 逐项选商品可改图/标题/链接的经典白卡）
export const defaultProductCarouselFrame = {
    textColor: "",
    itemBackgroundColor: "",
    backgroundColor: "",
    innerPadding: 0,
    itemHeight: 35,
    itemRadius: 3,
    boxRadius: 0,
    boxPadding: 0,
    leftAndRightPadding: 0,
    boxPaddingTop: 10,
    boxPaddingBottom: 10
};
// demo 占位卡片（productId:0；admin 首次拖入 / 未选商品 / 拉取失败时兜底，仅本组件局部用，不写真实数据）
export const defaultProductCarouselDemoItems = [
    {
        productId: 0,
        productName: "编辑模块，选择商品后自动加载商品的信息（仅供测试，请勿正式使用）",
        productDesc: "",
        productPrice: 899.0,
        marketPrice: 1299.0,
        picThumb: "https://oss.tigshop.com/img/gallery/202411/17319190474y0XWFxO8GJZF0dg64.jpg"
    },
    {
        productId: 0,
        productName: "编辑模块，选择商品后自动加载商品的信息（仅供测试，请勿正式使用）",
        productDesc: "",
        productPrice: 899.0,
        marketPrice: 1299.0,
        picThumb: "https://oss.tigshop.com/img/gallery/202411/1731919071axvkfUDkQNFbIzF1iY.jpg"
    },
    {
        productId: 0,
        productName: "编辑模块，选择商品后自动加载商品的信息（仅供测试，请勿正式使用）",
        productDesc: "",
        productPrice: 899.0,
        marketPrice: 1299.0,
        picThumb: "https://oss.tigshop.com/img/gallery/202411/1731919071lOa0ZBx2mYlvq1lgjr.jpg"
    },
    {
        productId: 0,
        productName: "编辑模块，选择商品后自动加载商品的信息（仅供测试，请勿正式使用）",
        productDesc: "",
        productPrice: 899.0,
        marketPrice: 1299.0,
        picThumb: "https://oss.tigshop.com/img/gallery/202411/1731919071xUnObq2LokKPFecwXq.jpg"
    }
];
export const defaultProductCarousel = {
    productList: cloneDeep(defaultProductCarouselDemoItems),

    showModuleTitle: 0,
    moduleTitle: "",
    moduleTitleColor: "#FFFFFF",
    titleContentGap: 20,

    autoplay: 0,
    cardWidthPercent: 80,

    cardStyle: "shadow",
    goodsRadius: 12,
    picBottomRadius: 1,
    productPicRatio: "1:1",
    textWeight: 400,
    textAlign: "left",
    itemGap: 10,
    innerPadding: 10,

    showName: 1,
    showDesc: 0,
    showPrice: 1,
    showMarketPrice: 1,
    showSales: 0,
    // 购买按钮：复用 defaultBuyButtonStyle，按设计图覆盖
    buyBtnStyle: cloneDeep({
        ...defaultBuyButtonStyle,
        btnType: 2,
        text: "立即抢购",
        gradientColorA: "#FF8FB8",
        gradientColorB: "#FF5E96",
        radius: 16
    }),

    productTitleColor: "#666",
    descColor: "#999",
    priceColor: "#FF5E96",
    marketPriceColor: "#999",
    salesColor: "#999",
    badgeColor: "#FC7C3D",

    moduleBgImage: { picUrl: "", picThumb: "" },
    bgImageMode: "normal",

    frame: cloneDeep(defaultProductCarouselFrame)
};

// 标签导航（mobilePro 桶；横滑彩色水滴形文字标签，每标签 = 标题 + 链接；颜色按 index%6 循环）
export const defaultTagNav = {
    groupList: [
        { title: "肠胃", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "咽炎", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "上火", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "肾虚", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "减肥", link: { link: { link: "", title: "" }, linkTitle: "" } },
        { title: "失眠", link: { link: { link: "", title: "" }, linkTitle: "" } }
    ],
    textWeight: 700, // 文本样式：400 常规 / 700 加粗
    groupGap: 10, // 标签间距
    groupPadding: 10, // 标签内部左右内边距
    // 第 1~6 个分类的渐变色（colorA~colorB）；默认 A=B 为纯色
    categoryColors: [
        { colorA: "#5FC1E8", colorB: "#5FC1E8" },
        { colorA: "#F5A623", colorB: "#F5A623" },
        { colorA: "#FF5C3A", colorB: "#FF5C3A" },
        { colorA: "#FF6B7A", colorB: "#FF6B7A" },
        { colorA: "#8BC53F", colorB: "#8BC53F" },
        { colorA: "#2BC4B4", colorB: "#2BC4B4" }
    ],
    titleColor: "#ffffff", // 标签标题文字色
    moduleStyle: cloneDeep(defaultModuleStyle) // 模块样式
};
