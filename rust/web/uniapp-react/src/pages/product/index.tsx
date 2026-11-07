import { useEffect, useMemo, useRef, useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useRouter, useShareAppMessage, useShareTimeline, useUnload } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import ProductGroupon from "./src/productGroupon";
import ProductNav from "./src/productNav";
import ProductImg from "./src/productImg";
import ProductImgDecorate from "./src/productImgDecorate";
import ProductTitleInfo, { type ProductTitleInfoRef } from "./src/productTitleInfo";
import ProductComment from "./src/productComment";
import EvaluateCard from "./src/evaluateCard";
import MerchantShopInfo from "./src/merchantShopInfo";
import Specification, { type SpecificationRef, type SpecificationSendValuePayload } from "@/components/product/specification";
import ProductCoupon from "./src/productCoupon";
import ProductGrouponMore from "./src/productGrouponMore";
import ProductContent from "./src/productContent";
import AttrCard from "./src/attrCard";
import AfterSaleCard from "./src/afterSaleCard";
import ServiceCard from "./src/serviceCard";
import ProductDescription from "./src/productDescription";
import DescriptionCard from "./src/descriptionCard";
import Animation from "./src/animation";
import ErrorComp from "./src/error";
import Recommend from "@/components/recommend";
import ProductActionBar, { type ProductActionBarRef } from "./components/ProductActionBar";
import TigLayout, { type TigLayoutRef } from "@/components/tig/tig-layout/TigLayout";
import MainHeader from "@/components/mainHeader";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigBackTop from "@/components/tig/tig-back-top";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import type { SkuPromotion } from "@/types/product/product";
import { asyncGetCartCount } from "@/api/cart/cart";
import { getH5ProductDetailDecorate } from "@/api/home/home";
import { resolveMiniScene } from "@/api/common";
import { redirect, staticResource, isB2B, parseQueryString, isMerchant, isO2o, isOverseas, rpx2px } from "@/utils";
import { normalizeProductShareUrl, resolveProductShopId } from "@/utils/productShare";
import { productImage } from "@/utils/format";
import { clearJsonLd } from "@/utils/seo";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { useCartStore } from "@/store/cart";
import { t } from "@/utils/i18n";
import {
    useProductDetail,
    useProductAction,
    useProductStyle,
    useProductType,
    type ProductStyle
} from "./composables";
import { useProductRawImageDownload } from "./composables/useProductRawImageDownload";

import "./index.scss";

/**
 * 商品详情页（自旧 uniapp pages/product/index.vue 移植）
 * - 展示商品图片、标题、价格、规格、评论等完整信息
 * - 支持秒杀、拼团、周期购、预约服务等多种商品类型
 * - SKU选择、购物车、立即购买等核心交互
 * - 门店信息、优惠券领取、收藏分享等功能
 */

// ===== 商详装修配置（pageType=8）=====
interface ProductDecorateConfig {
    /** 展示风格：A1-标准 / A2-门店 / A3-跨境 */
    decorateStyle?: ProductStyle;
    /** 主图比例 */
    imageRatio?: "4:3" | "4:5" | "1:1";
    /** 轮播图左右边距（px） */
    imageMargin?: number | string;
    /** 主图显示模式：1-完整显示，2-铺满裁切 */
    imageMode?: number | string;
    /** 主图圆角 */
    imageRadiusStyle?: "square" | "round" | "large";
    /** 标题大小 */
    titleSize?: "large" | "medium" | "small";
    /** 标题颜色 */
    titleColor?: string;
    /** 标题最多显示行数 */
    titleMaxLines?: 1 | 2 | 3;
    /** 价格颜色 */
    priceColor?: string;
    /** 商品划线价颜色 */
    marketPriceColor?: string;
    /** 购买栏样式：1-圆润 2-直角 */
    buyBarStyle?: 1 | 2;
    /** 按钮圆角 */
    buttonRadius?: number;
    /** 底部是否显示首页入口 */
    showHome?: boolean;
    /** 底部是否显示客服入口 */
    showService?: boolean;
    /** 底部是否显示购物车入口 */
    showCart?: boolean;
    /** 是否显示店铺信息 */
    showShop?: boolean;
    /** 页面背景色 */
    backgroundColor?: string;
    /** 内容区块背景色 */
    contentBackgroundColor?: string;
    /** 是否显示 A3 顶部商城头部 */
    showHeader?: boolean;
}

/** 规格弹窗 sendValue 载荷（旧 Ival：discountEndTime/cycleInfo 在 React 规格组件载荷中可能缺省） */
type Ival = SpecificationSendValuePayload;

/** 状态双写（对应旧 ref 同步写语义）：state + ref 镜像 */
function useStateWithRef<T>(initial: T) {
    const [value, setValue] = useState<T>(initial);
    const valueRef = useRef<T>(initial);
    const setBoth = (next: T) => {
        valueRef.current = next;
        setValue(next);
    };
    return [value, valueRef, setBoth] as const;
}

export default function ProductIndex() {
    const router = useRouter();

    const configStoreShowSelledCount = useConfigStore((s) => s.showSelledCount);
    const configStoreProductCommentEnabled = useConfigStore((s) => s.productCommentEnabled);
    const configStoreSafeBottom = useConfigStore((s) => s.safeAreaInsets.bottom);
    const userToken = useUserStore((s) => s.token);
    const userServiceConfigShow = useUserStore((s) => s.serviceConfig.show);
    const setCartCount = useCartStore((s) => s.setCartCount);

    // ===== 页面级状态 =====
    const [type, typeRef, setTypeBoth] = useStateWithRef("");
    const specificationRef = useRef<SpecificationRef | null>(null);
    const titleInfoRef = useRef<ProductTitleInfoRef | null>(null);
    const layoutRef = useRef<TigLayoutRef | null>(null);
    const actionBarRef = useRef<ProductActionBarRef | null>(null);
    const [showAttrRef, setShowAttrRef] = useState(false);
    const [showCoupon, setShowCoupon] = useState(false);
    const [, formTypeRef, setFormTypeBoth] = useStateWithRef(false);
    const [activeModule, setActiveModule] = useState(".product-area");
    const [animationPosition, setAnimationPosition] = useState({
        top: 0,
        left: 0
    });
    const [showAnimation, setShowAnimation] = useState(false);
    const [cartCount, setCartCountState] = useState<number>(0);
    const [isCollectState, setIsCollectState] = useState(false);

    // 页面滚动位置（对应旧 useScrollTop hook：onPageScroll 记录 scrollTop）
    const [scrollTop, setScrollTop] = useState(0);
    Taro.usePageScroll((e) => {
        setScrollTop(e.scrollTop);
    });

    // ===== 商详装修配置（pageType=8）=====
    const [decorateConfig, setDecorateConfig] = useState<ProductDecorateConfig>({});
    const [decorateModuleType, setDecorateModuleType] = useState<string | undefined>(undefined);
    const decorateStyle = decorateConfig.decorateStyle;

    // ===== 商详风格决策（A1 / A2 / A3 三风格切换入口）=====
    const { productStyle, isVortmallStyle, isO2oStyle, isOverseasStyle } = useProductStyle({
        decorateStyle,
        moduleType: decorateModuleType
    });

    // A1 / A3 始终使用装修版轮播，配置异步到达时只更新属性，不切换整个组件。
    const useDecorateImg = isVortmallStyle || isOverseasStyle;

    // 页面底色覆盖模块间距；内容底色控制各内容卡片。旧数据未配置内容底色时保持白色。
    const pageStyle = useMemo<Record<string, string>>(() => {
        const configuredPageBackground = decorateConfig.backgroundColor;
        // A2 历史默认值为 transparent，会透出 tig-layout 的白底，看起来像“背景色无效”；统一迁移为门店风浅灰底。
        const pageBackground =
            productStyle === "A2" && (!configuredPageBackground || configuredPageBackground === "transparent") ? "#f5f5f5" : configuredPageBackground;
        const contentBackground = decorateConfig.contentBackgroundColor || "#ffffff";
        const fallbackPageBackground = isVortmallStyle ? "#f7f7f7" : "#f5f5f5";
        const style: Record<string, string> = {
            "--product-page-bg": pageBackground || fallbackPageBackground,
            "--product-content-bg": contentBackground,
            "--product-title-color": decorateConfig.titleColor || "#1a1a1a",
            "--product-price-color": decorateConfig.priceColor || "#2a3145",
            "--product-market-price-color": decorateConfig.marketPriceColor || "#999"
        };
        return pageBackground ? { ...style, backgroundColor: pageBackground } : style;
    }, [decorateConfig, productStyle, isVortmallStyle]);

    // 装修字段可能以字符串形式下发，统一归一：布尔（"false" 视为 false）、数字
    const toDecorateBool = (val: unknown) => {
        if (val === undefined || val === null || val === "") return undefined;
        return !(val === false || val === "false" || val === 0 || val === "0");
    };
    const toDecorateNumber = (val: unknown) => {
        if (val === undefined || val === null || val === "") return undefined;
        return Number(val);
    };

    // A3 头部是否展示由运行环境、装修风格与显隐配置共同决定；兼容接口下发 false / 0 / "0"。
    const showMainHeader = isOverseas() && isOverseasStyle && toDecorateBool(decorateConfig.showHeader) !== false;

    // A1 / A2 / A3 功能区保持一致：O2O 普通商品均可查看当前门店并切换门店。
    // shopId 未落地时 productShopInfo 会显示商城兜底信息，仍可携带 productId 进入门店列表。
    const showStoreSwitch = isO2o() && type !== "exchange";

    // 底栏装修配置
    const actionBarDecorate = useMemo(
        () => ({
            buyBarStyle: toDecorateNumber(decorateConfig.buyBarStyle) as 1 | 2 | undefined,
            buttonRadius: toDecorateNumber(decorateConfig.buttonRadius),
            showHome: toDecorateBool(decorateConfig.showHome),
            showService: toDecorateBool(decorateConfig.showService),
            showCart: toDecorateBool(decorateConfig.showCart)
        }),
        [decorateConfig]
    );

    /**
     * @description 拉取商详装修配置（pageType=8）
     * 匹配 productDetailA1/A2/A3；decorateStyle 缺失时按 type 回填，保证风格与模块一致
     */
    const fetchDecorateConfig = async (previewId?: string | number) => {
        try {
            const result = await getH5ProductDetailDecorate(previewId);
            const moduleList = Array.isArray(result?.moduleList) ? result.moduleList : [];
            const item = moduleList.find((m: any) => ["productDetailA1", "productDetailA2", "productDetailA3"].includes(m.type ?? "")) ?? moduleList[0];
            const moduleData = { ...(item?.module || {}) } as ProductDecorateConfig;
            const moduleType = item?.type ?? "";
            setDecorateModuleType(moduleType || undefined);
            // 接口未回 decorateStyle 时，按模块 type 回填，避免 A1 误落成门店风
            if (!moduleData.decorateStyle) {
                if (moduleType === "productDetailA1") moduleData.decorateStyle = "A1";
                else if (moduleType === "productDetailA2") moduleData.decorateStyle = "A2";
                else if (moduleType === "productDetailA3") moduleData.decorateStyle = "A3";
            }
            setDecorateConfig(moduleData);
        } catch (error) {
            console.error(error);
            setDecorateConfig({});
            setDecorateModuleType(undefined);
        }
    };

    // ===== 商品详情数据 =====
    const detail = useProductDetail({
        type,
        onDetailLoaded: () => {
            // 对应旧 nextTick(() => layoutRef.value?.handleLog())
            setTimeout(() => {
                layoutRef.current?.handleLog();
            }, 0);
        }
    });
    const {
        productId,
        specificationId,
        skuId,
        product,
        picList,
        videoList,
        attrList,
        serviceList,
        descArr,
        productPrice,
        productStock,
        exchangeIntegral,
        promotionList,
        shopId,
        shopInfo,
        cycleInfo,
        isCycleBuy,
        isSubCard,
        activityBgImage,
        loadEndStatus,
        detailLoaded,
        failLoad,
        productOffline,
        getProductDetail,
        getShopInfo,
        getLoadStatus,
        setSkuId,
        setProductStock,
        setPromotionList,
        setProductPrice,
        setProduct
    } = detail;
    const rawImageDownload = useProductRawImageDownload(detail.rawImageContext, detail.reloadRawImageDetail);

    const showMerchantShop = useMemo(
        () =>
            isMerchant() &&
            type !== "exchange" &&
            toDecorateBool(decorateConfig.showShop) !== false &&
            Object.keys(shopInfo).length > 0 &&
            Number.isInteger(shopInfo.shopId) &&
            shopInfo.shopId > 0,
        [type, decorateConfig.showShop, shopInfo]
    );

    // 跨境风格（A3）商品详情卡展开态
    const [descShowMore, setDescShowMore] = useState(false);
    // 商品详情有内容时默认展开，无内容时保持收起
    useEffect(() => {
        setDescShowMore(!!descArr?.length);
    }, [descArr?.length]);

    // A3 固定购买栏高 120rpx（H5 其他风格保持原 100rpx）；售罄提示再额外占用 60rpx，避免遮住最后一个模块的底部间距。
    const productContentBottomPadding = useMemo(() => {
        const actionBarHeight = isOverseasStyle ? 120 : 100;
        const hasProductStatus = detailLoaded && (product.productStatus === 0 || productStock === 0);
        const statusHeight = hasProductStatus ? 60 : 0;
        let paddingBottom = `${actionBarHeight + statusHeight}rpx`;

        // 对应旧 #ifdef MP-WEIXIN：微信端底栏实际为 110rpx；安全区是 px。A3 内部已有 35rpx，仅补足超出的部分。
        if (process.env.TARO_ENV === "weapp") {
            const miniActionBarHeight = isOverseasStyle ? 120 : 110;
            const windowWidth = Taro.getSystemInfoSync().windowWidth || 375;
            const overseasBaseBottom = (35 * windowWidth) / 750;
            const safeBottom = isOverseasStyle ? Math.max(configStoreSafeBottom - overseasBaseBottom, 0) : configStoreSafeBottom;
            paddingBottom = `calc(${miniActionBarHeight + statusHeight}rpx + ${safeBottom}px)`;
        }

        return paddingBottom;
    }, [isOverseasStyle, detailLoaded, product.productStatus, productStock, configStoreSafeBottom]);

    // A3 标题装修：字号与 Admin 预览的 14 / 15 / 16px 对应为 28 / 30 / 32rpx。
    const overseasTitleSizeMap: Record<NonNullable<ProductDecorateConfig["titleSize"]>, number> = {
        small: 28,
        medium: 30,
        large: 32
    };
    const [isOverseasNameExpanded, setIsOverseasNameExpanded] = useState(false);
    const isOverseasNameExpandedRef = useRef(false);
    const setIsOverseasNameExpandedBoth = (val: boolean) => {
        isOverseasNameExpandedRef.current = val;
        setIsOverseasNameExpanded(val);
    };
    const [showOverseasNameExpandBtn, setShowOverseasNameExpandBtn] = useState(false);

    const overseasNameStyle = useMemo<Record<string, string | number>>(() => {
        const titleSize = overseasTitleSizeMap[decorateConfig.titleSize || "small"] || overseasTitleSizeMap.small;
        const configuredLines = toDecorateNumber(decorateConfig.titleMaxLines);
        const titleMaxLines = configuredLines && configuredLines >= 1 && configuredLines <= 3 ? configuredLines : 2;

        const style: Record<string, string | number> = {
            color: decorateConfig.titleColor || "#1a1a1a",
            fontSize: `${titleSize}rpx`,
            lineHeight: "1.45",
            wordBreak: "break-all"
        };
        if (!isOverseasNameExpanded) {
            style.display = "-webkit-box";
            style.WebkitBoxOrient = "vertical";
            style.WebkitLineClamp = String(titleMaxLines);
            style.overflow = "hidden";
        }
        return style;
    }, [decorateConfig.titleSize, decorateConfig.titleMaxLines, decorateConfig.titleColor, isOverseasNameExpanded]);

    const measureOverseasName = (retries = 3) => {
        if (!isOverseasStyle || !product?.productName) return;
        const titleSize = overseasTitleSizeMap[decorateConfig.titleSize || "small"] || overseasTitleSizeMap.small;
        const configuredLines = toDecorateNumber(decorateConfig.titleMaxLines);
        const titleMaxLines = configuredLines && configuredLines >= 1 && configuredLines <= 3 ? configuredLines : 2;
        const lineHeight = rpx2px(titleSize * 1.45);
        Taro.createSelectorQuery()
            .select(".overseas-head__name-inner")
            .boundingClientRect((rect: any) => {
                if (rect && rect.height > 0) {
                    const overflows = rect.height > lineHeight * (titleMaxLines + 0.25);
                    setShowOverseasNameExpandBtn(overflows);
                    if (overflows) setIsOverseasNameExpandedBoth(false);
                    else setIsOverseasNameExpandedBoth(false);
                } else if (retries > 0) {
                    setTimeout(() => measureOverseasName(retries - 1), 200);
                }
            })
            .exec();
    };

    const checkOverseasNameOverflow = () => {
        if (!isOverseasStyle || !product?.productName) return;
        // 先展开测量完整文本高度，再恢复到默认折叠状态。
        setIsOverseasNameExpandedBoth(true);
        setTimeout(() => measureOverseasName(), 150);
    };

    // 对应旧 watch([productName, productStyle, titleSize, titleMaxLines], ..., { flush: "post" })
    useEffect(() => {
        checkOverseasNameOverflow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.productName, productStyle, decorateConfig.titleSize, decorateConfig.titleMaxLines]);

    // ===== 商品类型判断 =====
    const { isReservation, isPresale, productPresale, isSubCardReservationProduct, reserveModeText, reserveTipText } = useProductType({
        product,
        isSubCard
    });

    // ===== 商品操作 / 拼团 =====
    const action = useProductAction({ specificationRef });
    const {
        showMoreGroupon,
        setShowMoreGroupon,
        grouponEnable,
        grouponRecordInfo,
        groupList,
        twoGroupList,
        totalGroupCount,
        showSpecification,
        showGrouponPopup,
        handleShowMore,
        handleJoinGroup,
        getGrouponRecords
    } = action;

    // 批发态：纯零售构建恒为 false（对应旧 computed isWholesaleMode）
    const isWholesaleMode = false;

    /**
     * @description 规格入口（加购 / 立即购买 / 单独购买）：批发态短路唤起批发弹层，否则委托零售逻辑
     * @param isQuick true=立即购买（加车后进结算页）；其余（含点击事件对象）=加入购物车
     */
    const onShowSpecification = (_isQuick?: unknown) => {
        showSpecification();
    };

    /**
     * @description 开团入口：批发态短路唤起批发弹层（批发不参与拼团开团，退化为加购），否则委托零售开团
     */
    const onShowGrouponPopup = () => {
        showGrouponPopup();
    };

    // ===== SKU 回传状态（number 语义，兼容 productTitleInfo / specification props）=====
    const [skuStr, setSkuStr] = useState<string>("");
    const [productOriginPrice, setProductOriginPrice] = useState<string | number | null>(null);
    const [productNumber, setProductNumber] = useState<number>(1);
    const [isSeckill, setIsSeckill] = useState<number>(0);
    const [seckillValue, setSeckillValue] = useState<any>({});
    const [isDiscount, setIsDiscount] = useState<number>(0);
    const [discountValue, setDiscountValue] = useState<any>({});
    const [, discountEndTimeRef, setDiscountEndTimeBoth] = useStateWithRef<string>("");
    const [isGroupon, setIsGroupon] = useState<number>(0);
    const [grouponValue, setGrouponValue] = useState<any>({});

    // 秒杀属于活动资格购买；限时折扣不满足资格时仍可按普通价格购买
    const memberRestricted = useMemo(() => {
        if (isSeckill) return seckillValue?.canJoin === false;
        return false;
    }, [isSeckill, seckillValue]);

    const memberRestrictTip = useMemo(() => {
        return (isSeckill ? seckillValue?.restrictTip : discountValue?.restrictTip) || "";
    }, [isSeckill, seckillValue, discountValue]);

    /**
     * @description 显示规格参数弹窗
     */
    const showDrawer = () => {
        setShowAttrRef(true);
    };

    /**
     * @description 接收规格组件传递的商品信息
     * 包含价格、库存、促销活动、拼团信息等
     * @param val 商品规格相关数据
     */
    const getValue = (val: Ival) => {
        if (val.productSkuId && val.skuStr) {
            setSkuStr(val.skuStr);
        }
        // 规格组件回传的库存可能是 string/undefined，这里统一转 number，保证后续判断稳定
        setProductStock(Number((val as any)?.productStock ?? 0));
        setPromotionList(val.promotionList);
        setProductPrice(String(val.productPrice));
        setProductOriginPrice((val as any).cycleInfo?.originalPrice || val.productOriginPrice);
        setProduct((prev) => ({ ...prev, marketPrice: (val.marketPrice || val.productOriginPrice || prev.marketPrice) as any }));
        setProductNumber(val.productNumber);
        setIsSeckill(val.isSeckill);
        setSeckillValue(val.seckillValue);
        setIsDiscount(val.isDiscount);
        setDiscountValue(val.discountValue);
        setDiscountEndTimeBoth((val as any).discountEndTime ?? "");
        setGrouponValue(val.grouponValue);
        // 旧 ref 写入后同步读取，这里以本次载荷为据，避免读到上一次渲染的 state
        const nextIsGroupon = val.grouponValue?.productId ? 1 : 0;
        setIsGroupon(nextIsGroupon);

        // 预售优先：预售商品不再叠加秒杀/折扣/拼团活动，避免标题区同时显示秒杀价与预售价
        if (isPresale) {
            setIsSeckill(0);
            setIsDiscount(0);
            setIsGroupon(0);
        }

        if (nextIsGroupon) {
            void getGrouponRecords(product.productId as number);
        }

        // 预售（SKU 联动定金）
        if ((val as any).depositAmount !== undefined && (val as any).depositAmount !== null && isPresale) {
            setProduct((prev) => {
                const next = { ...prev } as any;
                if (!next.presaleInfo) next.presaleInfo = {};
                next.presaleInfo.depositAmount = Number((val as any).depositAmount);
                return next;
            });
        }
    };

    // 定金预售：尾款时间文案
    const paymentTimeText = useMemo(() => {
        const info = productPresale;
        if (!info || Number(info.saleMode) !== 2) return "";

        if (Number(info.finalPaymentType) === 1) {
            return info.finalPaymentRelativeDays ? t("付定金{0}天后开始", { 0: info.finalPaymentRelativeDays }) : "";
        }
        return info.finalPaymentStartTime ? `${info.finalPaymentStartTime}${t("开始")}` : "";
    }, [productPresale]);

    // 预售：发货时间文案
    const deliverTimeText = useMemo(() => {
        const info = productPresale;
        if (!info) return "";

        if (Number(info.deliveryType) === 1) {
            const days = info.deliveryRelativeDays ? `${info.deliveryRelativeDays}${t("天")}` : "";
            const hours = info.deliveryRelativeHours ? `${info.deliveryRelativeHours}${t("小时")}` : "";
            return `${Number(info.saleMode) === 1 ? t("付全款") : t("付尾款")}${days}${hours}${t("后发货")}`;
        }
        return info.deliveryDate ? `${info.deliveryDate}${t("开始")}` : "";
    }, [productPresale]);

    /**
     * @description 获取购物车商品数量（用于底部栏角标显示）
     */
    const _getCartCount = async () => {
        try {
            const result = await asyncGetCartCount();
            const count = Number(result ?? 0);
            setCartCountState(count);
            // A3 跨境风格的顶部购物车使用全局 store 角标，需与详情页本地数量同步。
            setCartCount(count);
        } catch (error) {
            console.error(error);
        }
    };

    /**
     * @description 页面跳转
     * @param url 目标页面路径
     */
    const toPage = (url: string) => {
        redirect({ url });
    };

    /**
     * @description 计算商品参数名称展示文本
     */
    const shuxinText = useMemo(() => {
        if (attrList.normal && attrList.normal.length) {
            const names = attrList.normal.map((item: any) => item.attrName);
            return names.join("/");
        }
        return "";
    }, [attrList.normal]);

    /**
     * @description 跳转首页
     */
    const handleToHome = () => {
        Taro.switchTab({ url: "/pages/index/index" });
    };

    /**
     * @description 商品售罄/下架时跳转商品列表查看其他商品
     */
    const handleToProductList = () => {
        Taro.navigateTo({ url: "/pages/search/result" });
    };

    /**
     * @description 滚动到指定模块位置
     * @param module 模块选择器（如.product-area）
     */
    const handleScrollTo = (module: string) => {
        const query = Taro.createSelectorQuery();
        query.select(module).boundingClientRect();
        query.selectViewport().scrollOffset(() => {});
        query.exec((res: any) => {
            Taro.pageScrollTo({
                scrollTop: res[0].top + res[1].scrollTop - 50,
                duration: 0
            });
        });
    };

    const productObserverRef = useRef<any>(null);
    const evaluateObserverRef = useRef<any>(null);
    const productDetailObserverRef = useRef<any>(null);

    /**
     * @description 创建交叉观察器，用于导航栏高亮切换
     * @param observer 观察器实例
     * @param module 模块选择器
     */
    const getObserver = (observer: any, module: string) => {
        const windowHeight = Taro.getSystemInfoSync().windowHeight || 667;
        observer.relativeToViewport({ bottom: -(windowHeight - 200) }).observe(module, (res: any) => {
            if (res.intersectionRatio > 0) {
                setActiveModule(module);
            }
        });
    };

    // 对应旧 onReady（uni.createIntersectionObserver(instance) → 页面实例作用域）
    useEffect(() => {
        const page = (Taro.getCurrentInstance().page ?? {}) as any;
        productObserverRef.current = Taro.createIntersectionObserver(page, { observeAll: false });
        evaluateObserverRef.current = Taro.createIntersectionObserver(page, { observeAll: false });
        productDetailObserverRef.current = Taro.createIntersectionObserver(page, { observeAll: false });
        getObserver(productObserverRef.current, ".product-area");
        getObserver(evaluateObserverRef.current, ".evaluate-area");
        getObserver(productDetailObserverRef.current, ".product-detail-area");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useUnload(() => {
        rawImageDownload.onUnload();
        // 对应旧 #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            clearJsonLd();
        }
        productObserverRef.current?.disconnect();
        productObserverRef.current = null;
        evaluateObserverRef.current?.disconnect();
        evaluateObserverRef.current = null;
        productDetailObserverRef.current?.disconnect();
        productDetailObserverRef.current = null;

        const pages = Taro.getCurrentPages();
        const index = pages.findIndex((item: any) => item.route === "pages/product/index");
        if (index === -1) {
            Taro.eventCenter.off("refreshStoreInfo");
        }

        // 对应旧 #ifdef H5 || APP（Taro 无 App 运行时，仅 H5 处理）
        if (process.env.TARO_ENV === "h5") {
            (Taro as any).closePreviewImage?.();
        }
    });

    /**
     * @description 保存分销员推广商品关系
     * 用于追踪分销员推广业绩
     * @param salesmanId 分销员ID
     * @param pid 商品ID
     */
    const saveSalesmanProducts = (salesmanId: string, pid: string) => {
        let salesmanProducts = Taro.getStorageSync("salesmanProducts") || [];
        if (salesmanProducts.length > 0) {
            const index = salesmanProducts.findIndex((item: any) => item.productId == pid);
            if (index !== -1) {
                salesmanProducts[index].salesmanId = salesmanId;
            }
        }
        salesmanProducts = [...salesmanProducts, { salesmanId, productId: pid }];
        Taro.setStorageSync("salesmanProducts", salesmanProducts);
    };

    const init = async (option: any) => {
        if (option) {
            // 对应旧 #ifdef MP-WEIXIN
            if (process.env.TARO_ENV === "weapp" && option.scene) {
                const sceneStr = decodeURIComponent(String(option.scene));
                Object.assign(option, parseQueryString(sceneStr));
                if (option.s && !option.salesmanId) {
                    option.salesmanId = option.s;
                }
                if (!option.id && sceneStr && !sceneStr.includes("=")) {
                    try {
                        const resolved = await resolveMiniScene(sceneStr);
                        if (resolved?.id) {
                            option.id = String(resolved.id);
                        }
                        if (resolved?.salesmanId) {
                            option.salesmanId = String(resolved.salesmanId);
                        }
                        if (resolved?.shopId !== undefined && resolved.shopId !== null) {
                            option.shopId = String(resolved.shopId);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }
                // 短码场景下若最终仍未解析出商品 ID，避免页面空白且无任何反馈
                if (!option.id && !option.sn) {
                    Taro.showToast({ title: t("商品参数无效，请重新进入"), icon: "none", duration: 2000 });
                    setTimeout(() => {
                        const pages = Taro.getCurrentPages();
                        if (pages.length > 1) {
                            Taro.navigateBack();
                        } else {
                            Taro.switchTab({ url: "/pages/index/index" });
                        }
                    }, 1500);
                    return;
                }
            }

            if (option.type) {
                // React 适配：旧 ref 写入同步生效；state 需等重渲染后 useProductDetail 的 typeRef 才更新，
                // 这里先写 ref 镜像，再等一拍（flushState）让 hook 读取到最新 type 后再发详情请求。
                typeRef.current = option.type;
                setTypeBoth(option.type);
            }
            const routeShopId = resolveProductShopId(option.shopId, isO2o());
            if (routeShopId !== undefined) {
                detail.setShopId(routeShopId);
                setFormTypeBoth(true);
            }

            const flushState = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
            if (option.type) {
                await flushState();
            }

            if (option.sn) {
                void getProductDetail({ sn: option.sn });
            } else if (option.id) {
                void getProductDetail(String(option.id));
            }
            if (option.skuId) {
                setSkuId(Number(option.skuId));
            }
            if (option.salesmanId) {
                const parsedSalesmanId = Number(option.salesmanId);
                if (Number.isInteger(parsedSalesmanId) && parsedSalesmanId > 0) {
                    saveSalesmanProducts(String(parsedSalesmanId), String(option.id));
                    Taro.setStorageSync("bindSalesmanId", parsedSalesmanId);
                }
            }
        }
    };

    // 对应旧 onLoad（uniapp onLoad 等价于 Taro React 页面首挂载 effect + useRouter.params）
    useEffect(() => {
        void (async () => {
            const option: any = router.params;
            void fetchDecorateConfig(option?.previewId);

            Taro.eventCenter.on("refreshStoreInfo", (id: number) => {
                if (id > -1) {
                    detail.setShopId(id);
                    setTimeout(() => {
                        if (option?.sn) {
                            void getProductDetail({ sn: option.sn });
                        } else if (option?.id) {
                            void getProductDetail(String(option.id));
                        }
                        specificationRef.current?.refresh();
                    }, 0);
                }
            });

            await init(option);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onShow：购物车数量 + 原图下载生命周期（hook 生命周期外置）
    useDidShow(() => {
        void _getCartCount();
        rawImageDownload.onShow();
    });
    // 对应旧 hook 内部 onHide：切后台取消进行中的下载
    useDidHide(() => {
        rawImageDownload.onHide();
    });

    const [cartRect, setCartRect] = useState({
        left: 0,
        top: 0
    });

    /**
     * @description 触发加入购物车动画
     * 底部操作栏已抽为子组件，节点位置须通过子组件自身实例查询，
     * 以兼容小程序自定义组件的节点边界
     * @param val 是否显示动画
     */
    const getShowAnimation = async (val: boolean) => {
        // 购物车入口（飞入终点）
        const cartPos = await actionBarRef.current?.getCartPositionRect();
        if (cartPos) {
            setCartRect((prev) => ({ ...prev, top: cartPos.top - cartPos.height / 2, left: cartPos.left + cartPos.width / 2 }));
        }
        // 加购按钮（飞出起点）
        const cartBtn = await actionBarRef.current?.getCartBtnRect();
        if (cartBtn) {
            setAnimationPosition((prev) => ({ ...prev, top: cartBtn.top - cartBtn.height / 2, left: cartBtn.left + cartBtn.width / 2 }));
        }

        setShowAnimation(val);
        void _getCartCount();
    };

    const styleVariable = useMemo(() => {
        return {
            "--x": cartRect.left - animationPosition.left + "px",
            "--y": "8px"
        };
    }, [cartRect.left, animationPosition.left]);

    const getProductSharePath = () => {
        const pages = Taro.getCurrentPages();
        const options = (pages[pages.length - 1] as any)?.options || {};
        const params = { ...options, id: productId };
        const query = Object.entries(params)
            .filter(([key, value]) => key !== "scene" && value !== undefined && value !== null && value !== "")
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join("&");
        return normalizeProductShareUrl(`/pages/product/index?${query}`, resolveProductShopId(product.shopId, isO2o()));
    };

    // 对应旧 onShareAppMessage / onShareTimeline（weapp 生效；H5 分享由 productShare 组件承载）
    useShareAppMessage(() => {
        return {
            title: product.productName,
            imageUrl: productImage(product),
            path: getProductSharePath()
        };
    });

    useShareTimeline(() => {
        return {
            title: product.productName,
            imageUrl: productImage(product),
            query: getProductSharePath().split("?")[1] || ""
        };
    });

    /**
     * @description 判断是否显示客服入口
     * 店铺配置了客服入口显示在商品详情页时显示
     */
    const showService = useMemo(() => {
        if (Object.keys(shopInfo).length > 0 && shopInfo.shopId !== 0) {
            if (shopInfo.kefuInlet && shopInfo.kefuInlet.length > 0 && shopInfo.kefuInlet.includes(1)) {
                return true;
            }
            return false;
        } else {
            return !!userServiceConfigShow;
        }
    }, [shopInfo, userServiceConfigShow]);

    // ===== 预约卡（A1 批发态与 before-store-switch 插槽复用）=====
    const renderReserveCard = () => (
        <View className="vortmall-reserve-card">
            <View className="reserve-row">
                <Text className="reserve-label">{t("预约方式")}</Text>
                <Text className="reserve-value">{t(reserveModeText)}</Text>
            </View>
            <View className="reserve-row">
                <Text className="reserve-label">{t("说明")}</Text>
                <Text className="reserve-value">{t(reserveTipText)}</Text>
            </View>
        </View>
    );

    return (
        <View className={`product-detail-page product-detail-page--${productStyle}`} style={pageStyle as any}>
            <TigLayout ref={layoutRef} immediateLog={false} overflow={!isOverseasStyle} productId={productId} shopId={product.shopId}>
                {!failLoad ? (
                    <View style={{ display: !loadEndStatus ? undefined : "none" }}>
                        {/* 旧 <mainHeader v-if="showMainHeader" position="sticky" background="var(--product-content-bg, #fff)" />
                            （B6 批次已移植，实挂；sticky 保持在文档流内，无需额外占位） */}
                        {showMainHeader && <MainHeader position="sticky" background="var(--product-content-bg, #fff)" />}
                        <ProductNav
                            modelValue={scrollTop}
                            activeModule={activeModule}
                            onUpdateActiveModule={setActiveModule}
                            event={handleScrollTo}
                            hasMainHeader={showMainHeader}
                            isCollect={isCollectState}
                            layoutStyle={productStyle}
                            showService={showService}
                            productId={productId}
                            shopInfo={shopInfo}
                            showDownload={rawImageDownload.visible}
                            downloadBusy={rawImageDownload.busy}
                            onDownload={rawImageDownload.download}
                            onShare={() => titleInfoRef.current?.handleShare()}
                            onCollect={() => titleInfoRef.current?.addCollect()}
                        />
                        {/* 跨境风格（A3）：标题与已售置于主图上方，标题样式跟随装修配置 */}
                        {isOverseasStyle && (
                            <View className="overseas-head">
                                <View
                                    className="overseas-head__name"
                                    style={overseasNameStyle as any}
                                    onClick={() => {
                                        if (showOverseasNameExpandBtn) setIsOverseasNameExpandedBoth(!isOverseasNameExpandedRef.current);
                                    }}
                                >
                                    <View className="overseas-head__name-inner">
                                        {isPresale && <Text className="overseas-head__presale-tag">{t("预售")}</Text>}
                                        {product.productName}
                                    </View>
                                    {showOverseasNameExpandBtn && !isOverseasNameExpanded && (
                                        <View className="overseas-head__name-btn overseas-head__name-expand">
                                            <Text className="iconfont-h5 icon-a-gengduo20" />
                                        </View>
                                    )}
                                    {showOverseasNameExpandBtn && isOverseasNameExpanded && (
                                        <View className="overseas-head__name-btn overseas-head__name-collapse">
                                            <Text className="iconfont-h5 icon-a-gengduo20 iconTop" />
                                        </View>
                                    )}
                                </View>
                                {!isPresale && !!configStoreShowSelledCount && (
                                    <View className="overseas-head__sold">
                                        {t("已售")}
                                        {product.virtualSales || 0}
                                        {t("件")}
                                    </View>
                                )}
                            </View>
                        )}
                        <View className="product-area-wrapper">
                            {/* A1 使用装修版主图；A2 使用 productV1 全宽主图；A3 按装修比例/圆角决定 */}
                            {useDecorateImg ? (
                                <View className="product-area">
                                    <ProductImgDecorate
                                        isSubCard={isSubCard}
                                        videoList={videoList}
                                        picList={picList}
                                        productInfo={product}
                                        seckillValue={seckillValue}
                                        grouponValue={grouponValue}
                                        productStock={productStock}
                                        detailLoaded={detailLoaded}
                                        imageRatio={decorateConfig.imageRatio}
                                        imageMargin={decorateConfig.imageMargin}
                                        imageMode={decorateConfig.imageMode}
                                        imageRadiusStyle={decorateConfig.imageRadiusStyle}
                                    />
                                </View>
                            ) : (
                                <View className="product-area">
                                    <ProductImg
                                        isSubCard={isSubCard}
                                        videoList={videoList}
                                        picList={picList}
                                        productInfo={product}
                                        seckillValue={seckillValue}
                                        grouponValue={grouponValue}
                                        productStock={productStock}
                                        detailLoaded={detailLoaded}
                                        imageRatio={decorateConfig.imageRatio}
                                        imageMargin={decorateConfig.imageMargin}
                                        imageMode={decorateConfig.imageMode}
                                        imageRadiusStyle={decorateConfig.imageRadiusStyle}
                                    />
                                </View>
                            )}
                        </View>
                        <View
                            className={`productDetail-content ${isVortmallStyle ? "productDetail-content--vortmall" : ""} ${
                                isOverseasStyle ? "productDetail-content--overseas" : ""
                            }`}
                            style={{ paddingBottom: productContentBottomPadding }}
                        >
                            {/* A1 批发态：标题组件会跳过内部插槽，预约信息和门店入口在价格块后独立渲染。 */}
                            {isVortmallStyle && isWholesaleMode && isReservation && renderReserveCard()}

                            <ProductTitleInfo
                                ref={titleInfoRef}
                                layoutStyle={productStyle}
                                titleColor={decorateConfig.titleColor || ""}
                                priceColor={decorateConfig.priceColor || ""}
                                marketPriceColor={decorateConfig.marketPriceColor || ""}
                                titleSize={decorateConfig.titleSize || ""}
                                titleMaxLines={decorateConfig.titleMaxLines || 0}
                                isWholesaleMode={isWholesaleMode}
                                isCycleBuy={isCycleBuy}
                                isSubCard={isSubCard}
                                // 旧 v-model:show-coupon / v-model:is-cycle-buy / v-model:is-sub-card：
                                // React 规格组件为只读 props，showCoupon 走回调回写
                                onUpdateShowCoupon={(val) => setShowCoupon(val)}
                                onCollectChange={setIsCollectState}
                                isSeckill={isSeckill}
                                isGroupon={isGroupon}
                                isPresale={isPresale ? 1 : 0}
                                promotionList={promotionList}
                                productInfo={product}
                                productPrice={productPrice}
                                isDiscount={isDiscount}
                                type={type}
                                exchangeIntegral={exchangeIntegral}
                                productOriginPrice={productOriginPrice as any}
                                grouponValue={grouponValue}
                                productStock={productStock}
                                activityBgImage={activityBgImage}
                                seckillValue={seckillValue}
                                discountValue={discountValue}
                                presaleInfo={productPresale || undefined}
                                presalePaymentTimeText={paymentTimeText}
                                presaleDeliveryTimeText={deliverTimeText}
                                soldCount={product.virtualSales || 0}
                                beforeStoreSwitchSlot={
                                    isVortmallStyle && isReservation ? (
                                        renderReserveCard()
                                    ) : undefined
                                }
                                storeSwitchSlot={
                                    // 同一装修风格下门店卡统一使用 A1 标准样式；活动商品仅调整渲染位置，不改变卡片样式。
                                    null
                                }
                            />

                            {/* A3 活动优惠券统一紧跟价格活动条，对齐海外版商详。 */}
                            {!isWholesaleMode &&
                                isOverseasStyle &&
                                (isSeckill || isDiscount || isGroupon || isPresale || isCycleBuy) &&
                                promotionList.length > 0 && (
                                    <View className="overseas-activity-coupon-box">
                                        <View
                                            className="overseas-activity-coupon"
                                            onClick={() => setShowCoupon(true)}
                                        >
                                            <View className="coupon-title line1">{promotionList[0]?.promotionName || t("优惠活动")}</View>
                                            <View className="coupon-more">
                                                {t("更多优惠券")}
                                                <Text className="iconfont-h5 icon-a-gengduo20" />
                                            </View>
                                        </View>
                                    </View>
                                )}

                            {/* A1 预售优惠券位于门店入口下方，对齐 vortmall 商详的信息顺序。 */}
                            {(() => {
                                // 对应旧 computed showVortmallStandaloneCoupon
                                const showVortmallStandaloneCoupon =
                                    isVortmallStyle &&
                                    promotionList.length > 0 &&
                                    !!(isSeckill || isDiscount || isGroupon || isCycleBuy || isSubCard || isPresale || activityBgImage);
                                if (!showVortmallStandaloneCoupon) return null;
                                return (
                                    <View className="vortmall-presale-coupon" onClick={() => setShowCoupon(true)}>
                                        <View className="coupon-content">
                                            <View className="coupon-title line1">{promotionList[0]?.promotionName || t("优惠活动")}</View>
                                            <View className="coupon-more">
                                                {t("更多优惠券")}
                                                <Text className="iconfont-h5 icon-a-gengduo20" />
                                            </View>
                                        </View>
                                    </View>
                                );
                            })()}

                            {/* A1 标准风：服务保障使用与后台预览一致的独立卡片 */}
                            {isVortmallStyle && serviceList.length > 0 && <ServiceCard serviceList={serviceList} separated={showStoreSwitch} />}

                            {showMerchantShop && isVortmallStyle && (
                                <MerchantShopInfo shopInfo={shopInfo} variant="vortmall" onRefreshShopDetail={(id) => void getShopInfo(id)} />
                            )}

                            {/* A1 补齐旧版除规格外的交易提示；规格快捷入口按当前装修方案保留不展示。 */}
                            {!isWholesaleMode && isGroupon && !!totalGroupCount && (
                                <View className={`group-card-row ${isVortmallStyle ? "group-card-row--vortmall" : ""}`}>
                                    <View className="flex justify-between align-center">
                                        <View className="group-num">{grouponValue.joinNumCount + t("人在拼单，可直接参与")}</View>
                                        <View className="flex align-center group-desc" onClick={handleShowMore}>
                                            {t("查看更多")}
                                            <View className="iconfont-h5 icon-gengduo1 more" />
                                        </View>
                                    </View>
                                    <View className="group">
                                        <ProductGroupon groups={twoGroupList} padding="" vortmall={isVortmallStyle} onJoinClick={handleJoinGroup} />
                                    </View>
                                    <View className="instructions">
                                        <Text className="">{t("拼团说明")}</Text>
                                        <View className="process">
                                            <View className="process-item">
                                                <Image className="process-image" src={staticResource("groupon/groupon_open.png")} />
                                                <Text className="process-text-nowrap">{t("1.开团/参加")}</Text>
                                            </View>
                                            <View className="process-item">
                                                <Image className="process-image" src={staticResource("groupon/groupon_invite.png")} />
                                                <Text>{t("2.邀友参团")}</Text>
                                            </View>
                                            <View className="process-item">
                                                <Image className="process-image" src={staticResource("groupon/groupon_success.png")} />
                                                <Text>{t("3.人满成团")}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {!isOverseasStyle && !isVortmallStyle && (
                                <View className="product-card-row">
                                    <View
                                        className="cart-item flex align-center justify-between"
                                        onClick={() => onShowSpecification()}
                                    >
                                        <View className="flex align-center">
                                            <View className="title">{t("规格")}</View>
                                            <View className="label">
                                                {isB2B() && attrList.spe?.length > 0 ? (
                                                    <>
                                                        {attrList.spe.map((item: any, index: number) => (
                                                            <Text key={String(item.attrName) + "-" + index}>
                                                                {String(item.attrList.length) + t("种") + t(String(item.attrName))}
                                                            </Text>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <>
                                                        {skuStr} {productNumber} {t("件")}
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                        <View>
                                            <Image className="icon-image" src={staticResource("common/more.png")} />
                                        </View>
                                    </View>

                                    {isPresale && productPresale && (
                                        <>
                                            {productPresale.saleMode === 2 && (
                                                <View className="cart-item flex align-center justify-between">
                                                    <View className="flex align-center">
                                                        <View className="title">{t("尾款")}</View>
                                                        <View className="label">{paymentTimeText}</View>
                                                    </View>
                                                </View>
                                            )}
                                            <View className="cart-item flex align-center justify-between">
                                                <View className="flex align-center">
                                                    <View className="title">{t("发货")}</View>
                                                    <View className="label">{deliverTimeText}</View>
                                                </View>
                                            </View>
                                        </>
                                    )}

                                    {(configStoreShowSelledCount || attrList.normal?.length > 0 || product.fixedShippingType === 1 || serviceList.length > 0) && (
                                        <View className="card-row-flex">
                                            {configStoreShowSelledCount && (
                                                <View className="cart-item flex align-center justify-between">
                                                    <View className="flex align-center">
                                                        <View className="title">{t("销量")}</View>
                                                        <View className="label">
                                                            {product.virtualSales} {t("件")}
                                                        </View>
                                                    </View>
                                                </View>
                                            )}

                                            {attrList.normal?.length > 0 && !isOverseasStyle && (
                                                <View className="cart-item flex align-center justify-between" onClick={showDrawer}>
                                                    <View className="flex align-center">
                                                        <View className="title">{t("参数")}</View>
                                                        <View className="label attr_text line1">
                                                            <View className="shuxin">{t(shuxinText)}</View>
                                                        </View>
                                                    </View>
                                                    <View>
                                                        <Image className="icon-image" src={staticResource("common/more.png")} />
                                                    </View>
                                                </View>
                                            )}

                                            {product.fixedShippingType === 1 &&
                                                Number(product.fixedShippingFee) == 0 &&
                                                ![2, 3, 4, 5, 6, 8].includes(product.productType as number) && (
                                                    <View className="cart-item flex align-center justify-between">
                                                        <View className="flex align-center">
                                                            <View className="title">{t("运费")}</View>
                                                            <View className="label attr_text line1">
                                                                <View className="shuxin">
                                                                    {/* 电子礼品卡、虚拟、付费、卡密商品详情页中运费为无需配送 */}
                                                                    {[2, 3, 4, 8].includes(product.productType as number) ? t("无需配送") : t("包邮")}
                                                                </View>
                                                            </View>
                                                        </View>
                                                        <View>
                                                            <Image className="icon-image" src={staticResource("common/more.png")} />
                                                        </View>
                                                    </View>
                                                )}
                                            {(product.productType === 7 || product.productType === 8) && (
                                                <View className="cart-item flex align-center justify-between">
                                                    <View className="flex align-center">
                                                        <View className="title">{t("说明")}</View>
                                                        <View className="label attr_text line1">
                                                            <View className="shuxin">{t("此商品不支持售后，如需售后请联系客服")}</View>
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                            {serviceList.length > 0 && !isVortmallStyle && (
                                                <View className="cart-item">
                                                    <View className="flex">
                                                        <View className="title">{t("服务")}</View>
                                                        <View className="label flex-wrap align-center servicelist">
                                                            {serviceList.map((item: any, index: number) => (
                                                                <View key={index} className="flex align-center service-item">
                                                                    {/* 旧 tig-image 内联 15px 尺寸 → 外层 View 承载（TigImage 无 style prop） */}
                                                                    {item.icoImg ? (
                                                                        <View style={{ width: "15px", height: "15px" }}>
                                                                            <TigImage src={item.icoImg} />
                                                                        </View>
                                                                    ) : null}
                                                                    {item.productServiceName}
                                                                </View>
                                                            ))}
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}

                            {showMerchantShop && isO2oStyle && (
                                <MerchantShopInfo shopInfo={shopInfo} variant="o2o" onRefreshShopDetail={(id) => void getShopInfo(id)} />
                            )}

                            {showMerchantShop && isOverseasStyle && (
                                <MerchantShopInfo shopInfo={shopInfo} variant="overseas" onRefreshShopDetail={(id) => void getShopInfo(id)} />
                            )}

                            {/* A1 / A3：规格参数使用独立折叠卡，对齐后台预览与 VortMall */}
                            {(isVortmallStyle || isOverseasStyle) && attrList.normal?.length > 0 && (
                                <View className="attr-card-box">
                                    <AttrCard normal={attrList.normal} overseas={isOverseasStyle} />
                                </View>
                            )}

                            {/* A1 / A3 使用标准评价卡；A2 保留门店版评价与咨询入口 */}
                            {configStoreProductCommentEnabled === 1 && (isVortmallStyle || isOverseasStyle) ? (
                                <View className="evaluate-area">
                                    <EvaluateCard productId={product.productId} overseas={isOverseasStyle} />
                                </View>
                            ) : configStoreProductCommentEnabled === 1 ? (
                                <View className="evaluate-area">
                                    <ProductComment productId={product.productId} shopId={shopId > -1 ? shopId : undefined} />
                                </View>
                            ) : null}

                            {/* 跨境风格（A3）：售后服务 / 商品描述 / 商品详情 三张可展开卡片，对齐 tigshop-overseas */}
                            {isOverseasStyle ? (
                                <>
                                    <AfterSaleCard id={product.productId} overseas={true} />
                                    <ProductDescription product={product} overseas={true} />
                                    <View className="product-detail-area">
                                        <DescriptionCard
                                            modelValue={descShowMore}
                                            onUpdateModelValue={setDescShowMore}
                                            isBuy={product.isBuy}
                                            paidContent={product.paidContent as any}
                                            productType={product.productType}
                                            descArr={descArr as any}
                                            productId={product.productId}
                                            overseas={true}
                                        />
                                    </View>
                                </>
                            ) : isVortmallStyle ? (
                                <View className="product-detail-area">
                                    <DescriptionCard
                                        modelValue={descShowMore}
                                        onUpdateModelValue={setDescShowMore}
                                        isBuy={product.isBuy}
                                        paidContent={product.paidContent as any}
                                        productType={product.productType}
                                        descArr={descArr as any}
                                        productId={product.productId}
                                    />
                                </View>
                            ) : (
                                <View className="product-detail-area">
                                    <ProductContent
                                        isBuy={product.isBuy}
                                        paidContent={product.paidContent as any}
                                        productType={product.productType}
                                        descArr={descArr as any}
                                        productId={product.productId}
                                    />
                                </View>
                            )}
                        </View>

                        <ProductActionBar
                            ref={actionBarRef}
                            product={product}
                            layoutStyle={productStyle}
                            decorateConfig={actionBarDecorate as any}
                            productStock={productStock}
                            type={type}
                            isGroupon={isGroupon}
                            isPresale={isPresale}
                            productPresale={productPresale}
                            isCycleBuy={isCycleBuy}
                            isSubCard={isSubCard}
                            isSubCardReservationProduct={isSubCardReservationProduct}
                            isReservation={isReservation}
                            detailLoaded={detailLoaded}
                            cartCount={cartCount}
                            showService={showService}
                            shopInfo={shopInfo}
                            productId={productId}
                            memberRestricted={memberRestricted}
                            memberRestrictTip={memberRestrictTip}
                            grouponRestricted={grouponValue?.canJoin === false}
                            onShowSpecification={onShowSpecification}
                            onShowGrouponPopup={onShowGrouponPopup}
                            onToHome={handleToHome}
                            onToProductList={handleToProductList}
                            onToCart={() => toPage(userToken ? "/pages/cartJump/index" : "/pages/cart/index")}
                        />

                        {!isWholesaleMode && (
                            <Specification
                                ref={specificationRef}
                                productId={Number(specificationId)}
                                skuId={skuId}
                                onSkuIdChange={setSkuId}
                                isCycleBuy={isCycleBuy}
                                isSubCard={isSubCard}
                                type={type}
                                grouponEnable={grouponEnable}
                                grouponRecordInfo={grouponRecordInfo}
                                layoutStyle={productStyle as any}
                                decorateConfig={actionBarDecorate as any}
                                onLoadEnd={getLoadStatus}
                                onAddCardSucceed={getShowAnimation}
                                onSendValue={getValue}
                                onClose={() => {
                                    // 对应旧 @close="grouponEnable = true"：
                                    // useProductAction 未暴露 setGrouponEnable，且每次打开入口（单独购买/开团/参团）
                                    // 都会显式设置 grouponEnable，此复位为冗余保护，暂以 TODO 记录。
                                    // TODO(MIGRATION)：useProductAction 增补 setGrouponEnable 后补齐 @close 复位。
                                }}
                            />
                        )}

                        {!isWholesaleMode && (
                            <ProductCoupon
                                modelValue={showCoupon}
                                onUpdateModelValue={(val) => setShowCoupon(val)}
                                productId={Number(productId)}
                                promotionList={promotionList}
                                shopId={shopId}
                            />
                        )}
                        <Popup visible={showAttrRef} onClose={() => setShowAttrRef(false)}>
                            {/* 对应旧 tig-popup（up-popup 封装）→ NutUI Popup */}
                            <ScrollView scrollY className="attr_table-box">
                                <View className="popup-title title">{t("规格参数")}</View>
                                <View className="attr_table">
                                    {(attrList.normal || []).map((item: any, index: number) => (
                                        <View key={index} className="item flex">
                                            <View className="lable">{t(item.attrName)}</View>
                                            {item.attrList.map((attr: any, attrIndex: number) => (
                                                <View key={attrIndex} className="value">
                                                    {attr.attrValue}
                                                </View>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </Popup>
                        {/*更多拼团列表*/}
                        {!isWholesaleMode && (
                            <ProductGrouponMore
                                modelValue={showMoreGroupon}
                                onUpdateModelValue={setShowMoreGroupon}
                                productId={product.productId}
                                groupList={groupList}
                                total={totalGroupCount}
                                onJoinClick={handleJoinGroup}
                            />
                        )}
                        <TigBackTop scrollTop={scrollTop} />
                        <Animation
                            modelValue={showAnimation}
                            onUpdateModelValue={setShowAnimation}
                            styleVariable={styleVariable as any}
                            animationPosition={animationPosition}
                        />
                    </View>
                ) : (
                    <>
                        <ErrorComp productOffline={productOffline} />
                        <Recommend titleBg="#fff" />
                    </>
                )}
            </TigLayout>
            <TigLoadingPage modelValue={loadEndStatus} />
        </View>
    );
}
