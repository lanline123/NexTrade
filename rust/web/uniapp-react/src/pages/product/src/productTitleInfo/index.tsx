import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import type { ProductItem, SkuPromotion } from "@/types/product/product";
import type { PresaleInfo } from "@/types/presale/presale";
import { getCollectProduct, delCollectProduct, updateCollectProduct } from "@/api/product/product";
import FormatPrice from "@/components/format-price/FormatPrice";
import ProductShare from "../productShare";
import ActivityCard from "@/components/masonry/ActivityCard";
import { staticResource, rpx2px } from "@/utils";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import { ensureShareLogin } from "@/utils/shareLogin";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import ProductGrouponTitle from "../productGrouponTitle";
import ProductSeckillTitle from "../productSeckillTitle";
import ProductDiscountTitle from "../productDiscountTitle";
import ProductPresaleTitle from "../productPresaleTitle";

import "./index.scss";

export interface ProductTitleInfoRef {
    /** 收藏/取消收藏（对应旧 defineExpose addCollect） */
    addCollect: () => Promise<void>;
    /** 处理分享（对应旧 defineExpose handleShare） */
    handleShare: () => void;
    /** 是否已收藏（对应旧 defineExpose isCollect，ref 镜像读取） */
    readonly isCollect: boolean;
}

interface Props {
    productInfo?: ProductItem;
    productPrice?: string | number;
    isSeckill?: number;
    isGroupon?: number;
    isDiscount?: number;
    isPresale?: number;
    promotionList?: SkuPromotion[];
    showCoupon?: boolean;
    type?: string;
    exchangeIntegral?: number;
    productOriginPrice?: string | number;
    grouponValue?: Record<string, any>;
    productStock?: number;
    activityBgImage?: string;
    seckillValue?: Record<string, any>;
    discountValue?: Record<string, any>;
    presaleInfo?: PresaleInfo | null;
    presalePaymentTimeText?: string;
    presaleDeliveryTimeText?: string;
    soldCount?: number;
    /** 批发态标记：由详情页下传；纯零售构建下详情页该值被裁切为 undefined，此处默认 false 保证零售渲染 */
    isWholesaleMode?: boolean;
    /** 标题颜色（风格一 装修字段，未配置时用默认色） */
    titleColor?: string;
    /** 普通价格颜色（风格一 装修字段，仅作用于非活动价格；活动标题保持主题色） */
    priceColor?: string;
    /** 普通商品划线价颜色（A1/A2/A3 共用，未配置时保持当前默认色） */
    marketPriceColor?: string;
    /** 标题字号（风格一 装修字段：large/medium/small） */
    titleSize?: string;
    /** 标题最多显示行数（风格一 装修字段：1/2/3；配置后按行数截断，替代默认展开/收起） */
    titleMaxLines?: number;
    /** 布局风格：A1 标准风 / A2 门店风 / A3 跨境风 */
    layoutStyle?: string;
    /** 是否周期购（旧 defineModel，组件内只读） */
    isCycleBuy?: boolean;
    /** 是否次卡（旧 defineModel，组件内只读） */
    isSubCard?: boolean;
    /** 对应旧 emit("update:showCoupon") */
    onUpdateShowCoupon?: (val: boolean) => void;
    /**
     * React 适配：旧页面通过 defineExpose 的 isCollect（响应式 ref）传给 productNav，
     * React ref 读取不具备响应性，改为收藏状态变化回调（页面用于 productNav 的 isCollect 展示）。
     */
    onCollectChange?: (collect: boolean) => void;
    /** 对应旧 slot "before-store-switch" */
    beforeStoreSwitchSlot?: React.ReactNode;
    /** 对应旧 slot "store-switch" */
    storeSwitchSlot?: React.ReactNode;
}

/**
 * 商品标题信息组件（自旧 pages/product/src/productTitleInfo.vue 移植）
 * - 显示商品名称、副标题、价格、划线价
 * - 销量统计、收藏功能
 * - 分享入口、活动标签展示
 */
const ProductTitleInfo = forwardRef<ProductTitleInfoRef, Props>(function ProductTitleInfo(
    {
        productInfo = {} as ProductItem,
        productPrice = "0",
        isSeckill = 0,
        isGroupon = 0,
        isDiscount = 0,
        isPresale = 0,
        promotionList = [],
        type = "",
        exchangeIntegral = 0,
        productOriginPrice = "0",
        grouponValue = {},
        productStock = 0,
        activityBgImage = "",
        seckillValue = {},
        discountValue = {},
        presaleInfo = null,
        soldCount = 0,
        isWholesaleMode = false,
        titleColor = "",
        priceColor = "",
        marketPriceColor = "",
        titleSize = "",
        titleMaxLines = 0,
        layoutStyle = "o2o",
        isCycleBuy = false,
        isSubCard = false,
        onUpdateShowCoupon,
        onCollectChange,
        beforeStoreSwitchSlot,
        storeSwitchSlot
    },
    ref
) {
    const configStoreShowSelledCount = useConfigStore((s) => s.showSelledCount);
    const configStoreShowMarketprice = useConfigStore((s) => s.showMarketprice);

    /** 标准风（A1）：标题在上、价格在下，对齐后台预览 */
    const isVortmallLayout = layoutStyle === "A1";

    /** 跨境风（A3）：标题+已售在主图上方由页面渲染，本组件在主图下方只渲染价格与优惠券 */
    const isOverseasLayout = layoutStyle === "A3";

    /** A1 活动商品复用 A3 活动卡片结构，A2 保持原有活动样式。 */
    const useActivityCardLayout = isVortmallLayout || isOverseasLayout;

    const showB2bText = useMemo(() => isShowB2bPriceText(), []);

    const [isNameExpanded, setIsNameExpanded] = useState(false);
    const [showNameExpandBtn, setShowNameExpandBtn] = useState(false);
    const isNameExpandedRef = useRef(false);
    const setIsNameExpandedBoth = (val: boolean) => {
        isNameExpandedRef.current = val;
        setIsNameExpanded(val);
    };

    const doMeasureName = (retries = 3) => {
        // 风格一配置了最大行数时改用 line-clamp 截断，无需测高与展开按钮
        if (titleMaxLines) {
            setShowNameExpandBtn(false);
            return;
        }
        Taro.createSelectorQuery()
            .select(".product-name-inner")
            .boundingClientRect((rect: any) => {
                if (rect && rect.height > 0) {
                    const lineHeight = rpx2px(36) * 1.4;
                    const overflows = rect.height > lineHeight * 2.5;
                    setShowNameExpandBtn(overflows);
                    if (overflows) setIsNameExpandedBoth(false);
                } else if (retries > 0) {
                    setTimeout(() => doMeasureName(retries - 1), 200);
                } else {
                    setIsNameExpandedBoth(false);
                }
            })
            .exec();
    };

    const checkNameOverflow = () => {
        setIsNameExpandedBoth(true);
        setTimeout(() => doMeasureName(), 150);
    };

    const nameCollapsedStyle = useMemo(() => {
        if (isNameExpanded) return {};
        return {
            maxHeight: `${Math.ceil(50.4 * 2)}rpx`,
            overflow: "hidden"
        };
    }, [isNameExpanded]);

    // ===== 标题装修（风格一）：字号与行数截断，与标准风视觉一致 =====
    const titleSizeMap: Record<string, string> = { large: "36rpx", medium: "31rpx", small: "28rpx" };

    const titleFontStyle = titleSize ? { fontSize: titleSizeMap[titleSize] || "31rpx" } : {};

    // 配置了最大行数时用 line-clamp 截断，替代默认展开/收起逻辑
    const nameClampStyle = useMemo(() => {
        if (!titleMaxLines) return {};
        return {
            display: "-webkit-box",
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: String(titleMaxLines)
        };
    }, [titleMaxLines]);

    const isActivityProduct = !!(isSeckill || isDiscount || isGroupon || isCycleBuy || isSubCard || isPresale || activityBgImage);

    const isNormalWithActivityBg =
        !isSeckill && !isDiscount && !isGroupon && !isCycleBuy && !isSubCard && !isPresale && !!activityBgImage;

    const isSupplierProduct = useMemo(() => {
        const suppliersId = productInfo?.suppliersId;
        // 旧 Vue 判空包含 ""（接口可能下发空串），此处保持等价判断
        if (suppliersId === null || suppliersId === undefined || (suppliersId as unknown) === "") {
            return false;
        }
        const numericId = Number(suppliersId);
        return Number.isFinite(numericId) && numericId > 0;
    }, [productInfo?.suppliersId]);

    const normalStrikePrice = useMemo(() => {
        // 供应商商品：仅使用市场价作为划线价，没有市场价则不展示划线价
        if (isSupplierProduct) {
            if (productInfo.marketPrice && Number(productInfo.marketPrice) > 0) {
                return productInfo.marketPrice;
            }
            return null;
        }
        if (productOriginPrice && Number(productOriginPrice) > Number(productPrice)) {
            return productOriginPrice;
        }
        if (productInfo.marketPrice && Number(productInfo.marketPrice) > 0) {
            return productInfo.marketPrice;
        }
        return null;
    }, [isSupplierProduct, productInfo.marketPrice, productOriginPrice, productPrice]);

    const showMarketPrice = Number(configStoreShowMarketprice) === 1 && !!normalStrikePrice;

    const [isCollect, setIsCollect] = useState(false);
    const isCollectRef = useRef(false);
    const setIsCollectBoth = (val: boolean) => {
        isCollectRef.current = val;
        setIsCollect(val);
        onCollectChange?.(val);
    };

    const productIdRef = useRef<number>(0);

    const handleCoupon = () => {
        onUpdateShowCoupon?.(true);
    };

    const getCollect = async (id: any) => {
        try {
            const result = await getCollectProduct({ id });
            setIsCollectBoth(!!result);
        } catch (error: any) {
            if (error.code === 401) {
                setIsCollectBoth(false);
                return;
            }
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const addCollect = async () => {
        try {
            if (isCollectRef.current) {
                await delCollectProduct({
                    id: productIdRef.current
                });
            } else {
                await updateCollectProduct({
                    productId: productIdRef.current
                });
            }
            Taro.showToast({
                title: isCollectRef.current ? t("取消收藏成功") : t("收藏成功"),
                icon: "none"
            });
            await getCollect(productIdRef.current);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const [showShare, setShowShare] = useState(false);
    const handleShare = useCallback(() => {
        if (!ensureShareLogin(true)) {
            return;
        }
        setShowShare(true);
    }, []);

    // 对应旧 watch(() => props.productInfo)
    const productInfoId = productInfo?.productId;
    const productName = productInfo?.productName;
    useEffect(() => {
        if (productInfoId) {
            productIdRef.current = productInfoId;
            void getCollect(productInfoId);
            checkNameOverflow();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productInfoId, productName]);

    // 对应旧 onMounted
    useEffect(() => {
        if (productName) {
            checkNameOverflow();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
        addCollect,
        handleShare,
        get isCollect() {
            return isCollectRef.current;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }));

    const nameTextStyle = {
        ...(titleMaxLines ? nameClampStyle : nameCollapsedStyle),
        ...titleFontStyle,
        ...(titleColor ? { color: titleColor } : {})
    } as Record<string, string | number>;

    const renderNameExpandBtns = () => (
        <>
            {!titleMaxLines && showNameExpandBtn && !isNameExpanded && (
                <View className="product-name-btn product-name-expand">
                    <Text className="iconfont-h5 icon-a-gengduo20" />
                </View>
            )}
            {!titleMaxLines && showNameExpandBtn && isNameExpanded && (
                <View className="product-name-btn product-name-collapse">
                    <Text className="iconfont-h5 icon-a-gengduo20 iconTop" />
                </View>
            )}
        </>
    );

    const renderExchangeBox = () => (
        <View className="exchange-box">
            <Text className="exchange-icon">+</Text>
            <Image className="exchange-img" src={staticResource("exchange/exchange.png")} />
            <Text className="exchange-text">{exchangeIntegral}</Text>
        </View>
    );

    return (
        <View
            className={`product-title-info ${isNormalWithActivityBg ? "has-activity-bg" : ""} ${isVortmallLayout ? "is-vortmall-layout" : ""} ${
                isWholesaleMode ? "is-wholesale-mode" : ""
            }`}
        >
            {/* 批发态：隐藏零售价与营销标题，价格改由详情页外部 WholesalePriceTable 渲染 */}
            {!isWholesaleMode && (
                <>
                    {!!isSeckill && !isPresale && (
                        <ProductSeckillTitle
                            productInfo={productInfo}
                            productOriginPrice={productOriginPrice}
                            productPrice={productPrice}
                            seckillValue={seckillValue}
                            activityBgImage={activityBgImage}
                            overseas={useActivityCardLayout}
                        />
                    )}
                    {!!isDiscount && !isPresale && (
                        <ProductDiscountTitle
                            productInfo={productInfo}
                            productOriginPrice={productOriginPrice}
                            productPrice={productPrice}
                            discountValue={discountValue}
                            productStock={productStock}
                            activityBgImage={activityBgImage}
                            overseas={useActivityCardLayout}
                        />
                    )}
                    {!!isPresale && (
                        <ProductPresaleTitle
                            productInfo={productInfo}
                            productPrice={productPrice}
                            presaleInfo={presaleInfo as PresaleInfo}
                            soldCount={soldCount}
                            activityBgImage={activityBgImage}
                            overseas={useActivityCardLayout}
                        />
                    )}
                    {!!isGroupon && !isPresale && (
                        <ProductGrouponTitle
                            productInfo={productInfo}
                            productOriginPrice={productOriginPrice}
                            productPrice={productPrice}
                            grouponValue={grouponValue}
                            productStock={productStock}
                            activityBgImage={activityBgImage}
                            vortmall={false}
                            overseas={useActivityCardLayout}
                        />
                    )}
                    {isNormalWithActivityBg && (
                        <View className="activity-bg-banner" style={{ background: `url(${activityBgImage}) center/cover no-repeat` }}>
                            <View className="activity-bg-overlay" />
                            <View className="activity-bg-content">
                                <View className="activity-bg-price-row">
                                    <FormatPrice
                                        fontStyle={{ fontSize: "48rpx", fontWeight: "bold" }}
                                        decimalsStyle={{ fontSize: "32rpx", fontWeight: "bold" }}
                                        currencyStyle={{ fontSize: "28rpx", fontWeight: "bold" }}
                                        priceData={productPrice}
                                    />
                                    {type === "exchange" ? (
                                        renderExchangeBox()
                                    ) : showMarketPrice && !showB2bText ? (
                                        <View className="activity-bg-origin-price">
                                            <FormatPrice isBottom={false} priceData={normalStrikePrice as any} fontStyle={{ textDecoration: "line-through" }} />
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                    )}

                    {!isSeckill && !isDiscount && !isGroupon && !isCycleBuy && !isSubCard && !isPresale && !isNormalWithActivityBg && (
                        <>
                            {isVortmallLayout ? (
                                // 标准风（A1）：标题 → 销量 → 价格，对齐后台预览与 vortmall
                                <View className="vortmall-hero">
                                    <View
                                        className="product-name-text"
                                        style={nameTextStyle as any}
                                        onClick={() => {
                                            if (!titleMaxLines && showNameExpandBtn) setIsNameExpandedBoth(!isNameExpandedRef.current);
                                        }}
                                    >
                                        <View className="product-name-inner">{productInfo.productName}</View>
                                        {renderNameExpandBtns()}
                                    </View>
                                    {!!configStoreShowSelledCount && (
                                        <View className="vortmall-sold">
                                            {t("已售")}
                                            {soldCount || productInfo.virtualSales || 0}
                                            {t("件")}
                                        </View>
                                    )}
                                    <View className="vortmall-price">
                                        <FormatPrice
                                            fontStyle={{ fontSize: "49rpx", fontWeight: "600" }}
                                            decimalsStyle={{ fontSize: "49rpx", fontWeight: "600" }}
                                            currencyStyle={{ fontSize: "30rpx", fontWeight: "600" }}
                                            priceData={productPrice}
                                        />
                                        {type === "exchange" ? (
                                            renderExchangeBox()
                                        ) : (
                                            <>
                                                {type !== "exchange" && showMarketPrice && !showB2bText && (
                                                    <View className="title-top-market_price">
                                                        <FormatPrice
                                                            isBottom={false}
                                                            priceData={normalStrikePrice as any}
                                                            fontStyle={{
                                                                fontWeight: "400",
                                                                textDecoration: "line-through",
                                                                fontSize: "26rpx",
                                                                color: marketPriceColor || "#999"
                                                            }}
                                                        />
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    {beforeStoreSwitchSlot}
                                    {/* A1 门店卡与活动/批发态使用同一外层宽度，避免被标题内容的横向内边距挤窄。 */}
                                    <View className="vortmall-store-switch">{storeSwitchSlot}</View>
                                    {promotionList.length > 0 && (
                                        <View className="vortmall-coupon" onClick={handleCoupon}>
                                            <View className="vortmall-coupon-text line1">{promotionList[0]?.promotionName || t("优惠活动")}</View>
                                            <View className="vortmall-coupon-more">
                                                {t("更多优惠券")}
                                                <Text className="iconfont-h5 icon-a-gengduo20" />
                                            </View>
                                        </View>
                                    )}
                                    {!!productInfo.productBrief && <View className="product-brief-text">{productInfo.productBrief}</View>}
                                </View>
                            ) : (
                                // 门店风（A2）等：价格在上、标题卡片在下
                                <View className={`title-info-top ${isOverseasLayout ? "title-info-top--overseas" : ""}`}>
                                    <View className="title-top-price" style={priceColor ? { color: priceColor } : {}}>
                                        <FormatPrice
                                            fontStyle={{ fontSize: "48rpx", fontWeight: "bold" }}
                                            decimalsStyle={{ fontSize: "32rpx", fontWeight: "bold" }}
                                            currencyStyle={{ fontSize: "28rpx", fontWeight: "bold" }}
                                            priceData={productPrice}
                                        />
                                        {type === "exchange" ? (
                                            renderExchangeBox()
                                        ) : (
                                            <>
                                                {type !== "exchange" && showMarketPrice && !showB2bText && (
                                                    <View className="title-top-market_price">
                                                        <FormatPrice
                                                            isBottom={false}
                                                            priceData={normalStrikePrice as any}
                                                            fontStyle={{ textDecoration: "line-through", color: marketPriceColor || "#999" }}
                                                        />
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </View>
                                    {/* 跨境风（A3）：优惠券条与价格同处一张白底卡片，样式与标准风（A1）一致 */}
                                    {isOverseasLayout && promotionList.length > 0 && (
                                        <View className="vortmall-coupon" onClick={handleCoupon}>
                                            <View className="vortmall-coupon-text line1">{promotionList[0]?.promotionName || t("优惠活动")}</View>
                                            <View className="vortmall-coupon-more">
                                                {t("更多优惠券")}
                                                <Text className="iconfont-h5 icon-a-gengduo20" />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}
                        </>
                    )}
                </>
            )}

            <ProductShare
                modelValue={showShare}
                productId={Number(productIdRef.current)}
                productInfo={productInfo}
                productPrice={productPrice}
                layoutStyle={layoutStyle}
                onUpdateModelValue={(val) => setShowShare(val)}
            />
            {/* A2 名称卡片；A1 普通商品标题在 hero 中渲染，活动商品名称统一位于活动卡片下方 */}
            {!isWholesaleMode && (isOverseasLayout ? !!productInfo.productBrief : !isVortmallLayout || isActivityProduct) && (
                <View
                    className={`product-name-card ${isActivityProduct && !isVortmallLayout ? "has-activity" : ""} ${
                        isActivityProduct && isVortmallLayout ? "product-name-card--vortmall-activity" : ""
                    }`}
                >
                    {promotionList.length > 0 && !isOverseasLayout && !isVortmallLayout && (
                        <View className="activity-box" onClick={handleCoupon}>
                            <View className="flex">
                                {(promotionList.length > 2 ? promotionList.slice(0, 2) : promotionList).map((item) => (
                                    <ActivityCard key={item.promotionId} activityInfo={item} cardType="detail" />
                                ))}
                            </View>
                            <View className="activity-btn">
                                {t("领券")}
                                <Text className="iconfont-h5 icon-youjiantou" />
                            </View>
                        </View>
                    )}
                    {!isOverseasLayout && (
                        <View
                            className="product-name-text"
                            style={nameTextStyle as any}
                            onClick={() => {
                                if (!titleMaxLines && showNameExpandBtn) setIsNameExpandedBoth(!isNameExpandedRef.current);
                            }}
                        >
                            <View className="product-name-inner">{productInfo.productName}</View>
                            {renderNameExpandBtns()}
                        </View>
                    )}
                    {isVortmallLayout && isActivityProduct && !!configStoreShowSelledCount && (
                        <View className="vortmall-activity-name-sold">
                            {t("已售")}
                            {soldCount || productInfo.virtualSales || 0}
                            {t("件")}
                        </View>
                    )}
                    {!!productInfo.productBrief && <View className="product-brief-text">{productInfo.productBrief}</View>}
                </View>
            )}
        </View>
    );
});

export default ProductTitleInfo;
