import { forwardRef, useImperativeHandle, useMemo } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import Service from "@/components/service";
import FormatPrice from "@/components/format-price/FormatPrice";
import { staticResource } from "@/utils";
import { useConfigStore } from "@/store/config";
import type { ProductItem } from "@/types/product/product";
import type { PresaleInfo } from "@/types/presale/presale";
import type { ShopDetailItem } from "@/types/shop/shop";
import { t } from "@/utils/i18n";

import "./index.scss";

/** 底栏装修配置（风格一 透传；其余风格不传，默认保持原样） */
export interface DecorateBarConfig {
    /** 购买栏样式：A1 为 1-简约、2-经典；A2/A3 为 1-圆润、2-直角 */
    buyBarStyle?: 1 | 2;
    /** 按钮圆角（直角样式下生效，单位 rpx） */
    buttonRadius?: number;
    /** 是否显示首页入口 */
    showHome?: boolean;
    /** 是否显示客服入口 */
    showService?: boolean;
    /** 是否显示购物车入口 */
    showCart?: boolean;
}

export interface ProductActionBarRef {
    /** 购物车入口位置（加购动画飞入终点） */
    getCartPositionRect: () => Promise<any>;
    /** 加购按钮位置（加购动画飞出起点） */
    getCartBtnRect: () => Promise<any>;
}

interface Props {
    /** 商品详情 */
    product: ProductItem;
    /** 店铺信息（客服入口用） */
    shopInfo: ShopDetailItem;
    /** 当前库存 */
    productStock?: number;
    /** 商品模式：exchange 为积分兑换 */
    type?: string;
    /** 是否拼团（o2o 沿用 number 语义） */
    isGroupon?: number;
    /** 是否预售 */
    isPresale?: boolean;
    /** 预售信息 */
    productPresale?: PresaleInfo | null;
    /** 是否周期购 */
    isCycleBuy?: boolean;
    /** 是否次卡 */
    isSubCard?: boolean;
    /** 是否次卡预约商品 */
    isSubCardReservationProduct?: boolean;
    /** 是否预约商品（兼容 productType 5/6 与 flowType 9/10） */
    isReservation?: boolean;
    /** 详情是否已加载（控制售罄提示时机） */
    detailLoaded?: boolean;
    /** 购物车角标数量 */
    cartCount?: number | string;
    /** 是否展示客服入口 */
    showService?: boolean;
    /** 商品 ID（字符串透传） */
    productId?: string;
    /** 底栏装修配置（风格一 透传） */
    decorateConfig?: DecorateBarConfig;
    /** 布局风格：A1 / A2 / A3，A3 走直角描边风 */
    layoutStyle?: string;
    /** 当前用户不满足商品的会员购买门槛 */
    memberRestricted?: boolean;
    /** 会员门槛提示文案，为空时用默认文案 */
    memberRestrictTip?: string;
    /** 当前用户不满足拼团的会员参团门槛 */
    grouponRestricted?: boolean;
    /** 打开规格弹窗（加购 / 立即购买 / 单独购买 / 兑换 / 预约 / 预售）；isQuick=true 表示立即购买 */
    onShowSpecification?: (isQuick?: boolean) => void;
    /** 打开开团规格弹窗 */
    onShowGrouponPopup?: () => void;
    /** 跳转首页 */
    onToHome?: () => void;
    /** 跳转商品列表 */
    onToProductList?: () => void;
    /** 跳转购物车 */
    onToCart?: () => void;
}

/**
 * 商品详情底部操作栏（自旧 pages/product/components/ProductActionBar.vue 移植）
 * - 首页 / 客服 / 购物车快捷入口
 * - 按商品类型（普通 / 拼团 / 预售 / 兑换 / 预约 / 周期购 / 次卡）渲染对应按钮矩阵
 * - 下架 / 售罄状态提示
 */
const ProductActionBar = forwardRef<ProductActionBarRef, Props>(function ProductActionBar(
    {
        product,
        shopInfo,
        productStock = 0,
        type = "",
        isGroupon = 0,
        isPresale = false,
        productPresale = null,
        isCycleBuy = false,
        isSubCard = false,
        isSubCardReservationProduct = false,
        isReservation = false,
        detailLoaded = false,
        cartCount = 0,
        showService = false,
        productId = "",
        decorateConfig = {},
        layoutStyle = "",
        memberRestricted = false,
        memberRestrictTip = "",
        grouponRestricted = false,
        onShowSpecification,
        onShowGrouponPopup,
        onToHome,
        onToProductList,
        onToCart
    },
    ref
) {
    const configStoreSafeBottom = useConfigStore((s) => s.safeAreaInsets.bottom);

    // A3 与 A2 使用相同语义：1-经典连体，2-简约分离。
    const isOverseasBar = layoutStyle === "A3";
    const isOverseasClassicBar = isOverseasBar && decorateConfig?.buyBarStyle === 1;
    const isOverseasSimpleBar = isOverseasBar && !isOverseasClassicBar;
    const isVortmallBar = layoutStyle === "A1";
    const isO2oSimpleBar = layoutStyle === "A2" && decorateConfig?.buyBarStyle === 2;
    const isVortmallSimpleBar = isVortmallBar && decorateConfig?.buyBarStyle !== 2;
    const isVortmallClassicBar = isVortmallBar && decorateConfig?.buyBarStyle === 2;

    /**
     * 底部安全区：H5 保持原有 rpx 逻辑；微信端使用系统返回的真实 px。
     * A3 自身已有 35rpx 底部留白，仅补足超过该留白的安全区，避免重复叠加。
     */
    const actionBarSafeBottomStyle = useMemo(() => {
        let paddingBottom = `${configStoreSafeBottom}rpx`;
        // 对应旧 #ifdef MP-WEIXIN
        if (process.env.TARO_ENV === "weapp") {
            const windowWidth = Taro.getSystemInfoSync().windowWidth || 375;
            const overseasBaseBottom = (35 * windowWidth) / 750;
            const safeBottom = isOverseasBar ? Math.max(configStoreSafeBottom - overseasBaseBottom, 0) : configStoreSafeBottom;
            paddingBottom = `${safeBottom}px`;
        }
        return { paddingBottom };
    }, [configStoreSafeBottom, isOverseasBar]);

    // ===== 装修字段：底栏入口显隐（未配置视为显示，保持门店风原样）=====
    const decShowHome = decorateConfig?.showHome !== false;
    const decShowService = decorateConfig?.showService !== false;
    const decShowCart = decorateConfig?.showCart !== false;

    // ===== 装修字段：A1 简约风使用可配圆角；A2/A3 的直角风继续使用原有圆角覆盖 =====
    const isSquareBar = !isVortmallBar && decorateConfig?.buyBarStyle === 2;
    const btnRadius = `${decorateConfig?.buttonRadius ?? 8}rpx`;
    const vortmallSimpleRadius = `${Number(decorateConfig?.buttonRadius ?? 5) * 2}rpx`;
    const fullBtnStyle = useMemo(() => {
        if (isVortmallSimpleBar) return `border-radius:${vortmallSimpleRadius}`;
        return isSquareBar ? `border-radius:${btnRadius}` : "";
    }, [isVortmallSimpleBar, isSquareBar, vortmallSimpleRadius, btnRadius]);

    // 简约风按钮相互分离；经典风沿用 A2 的连体胶囊半边圆角。
    const cartBtnStyle = useMemo(() => {
        if (isVortmallSimpleBar) return `border-radius:${vortmallSimpleRadius}`;
        if (isO2oSimpleBar) return `border-radius:${btnRadius}`;
        if (isOverseasSimpleBar) return `border-radius:${btnRadius}`;
        if (isOverseasClassicBar) return "border-radius:100rpx 0 0 100rpx";
        return isSquareBar ? `border-radius:${btnRadius} 0 0 ${btnRadius}` : "";
    }, [isVortmallSimpleBar, isO2oSimpleBar, isOverseasSimpleBar, isOverseasClassicBar, isSquareBar, vortmallSimpleRadius, btnRadius]);

    const buyBtnStyle = useMemo(() => {
        if (isVortmallSimpleBar) return `border-radius:${vortmallSimpleRadius}`;
        if (isO2oSimpleBar) return `border-radius:${btnRadius}`;
        if (isOverseasSimpleBar) return `border-radius:${btnRadius}`;
        if (isOverseasClassicBar) return "border-radius:0 100rpx 100rpx 0";
        return isSquareBar ? `border-radius:0 ${btnRadius} ${btnRadius} 0` : "";
    }, [isVortmallSimpleBar, isO2oSimpleBar, isOverseasSimpleBar, isOverseasClassicBar, isSquareBar, vortmallSimpleRadius, btnRadius]);

    /**
     * 查询组件内部节点位置（用组件自身实例，兼容小程序自定义组件边界）
     * @param selector 节点选择器
     */
    const getRect = (selector: string): Promise<any> => {
        return new Promise((resolve) => {
            Taro.createSelectorQuery()
                .select(selector)
                .boundingClientRect((data) => {
                    resolve(data || null);
                })
                .exec();
        });
    };

    useImperativeHandle(ref, () => ({
        /** 购物车入口位置（加购动画飞入终点） */
        getCartPositionRect: () => getRect(".cart-position"),
        /** 加购按钮位置（加购动画飞出起点） */
        getCartBtnRect: () => getRect(".cart")
    }));

    const showOfflineStatus = (product.productStatus === 0 || productStock === 0) && !isSubCardReservationProduct;

    return (
        <View
            style={actionBarSafeBottomStyle as any}
            className={`bottom-bar-box ${isOverseasBar ? "bottom-bar-box--overseas" : ""} ${
                isOverseasSimpleBar ? "bottom-bar-box--overseas-simple" : ""
            } ${isOverseasClassicBar ? "bottom-bar-box--overseas-classic" : ""} ${isVortmallSimpleBar ? "bottom-bar-box--vortmall-simple" : ""} ${
                isVortmallClassicBar ? "bottom-bar-box--vortmall-classic" : ""
            } ${isO2oSimpleBar ? "bottom-bar-box--o2o-simple" : ""}`}
        >
            <View className="bottom-bar flex align-center">
                {!isOverseasBar && (
                    <View className="icon-box">
                        {decShowHome && (
                            <View
                                className="label"
                                onClick={() => {
                                    onToHome?.();
                                }}
                            >
                                <View>
                                    <Image mode="widthFix" src={staticResource("product/home.png")} className="img" />
                                </View>
                                <View className="label-text">
                                    <Text>{t("首页")}</Text>
                                </View>
                            </View>
                        )}

                        {showService && decShowService && (
                            <View className="label">
                                <Service phone={shopInfo.kefuPhone} productId={Number(productId)} shopId={shopInfo.shopId}>
                                    <View>
                                        <Image mode="widthFix" src={staticResource("product/service.png")} className="img" />
                                    </View>
                                    <View className="label-text">
                                        <Text>{t("客服")}</Text>
                                    </View>
                                </Service>
                            </View>
                        )}

                        {!isCycleBuy && !isPresale && decShowCart && (
                            <View
                                className="label cart-position"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToCart?.();
                                }}
                            >
                                {/* 旧 uni-badge absolute="rightTop" → 等价绝对定位角标重写 */}
                                <View className="cart-badge-wrap">
                                    <Image mode="widthFix" src={staticResource("product/cart.png")} className="img" />
                                    {!!Number(cartCount) && (
                                        <View className="cart-badge badgecolor">{Number(cartCount) > 99 ? "99+" : cartCount}</View>
                                    )}
                                </View>
                                <View className="label-text">
                                    <Text>{t("购物车")}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
                <View className="btn-box">
                    {product.productType === 4 && product.isBuy === 1 ? (
                        <View className="isBuyBtn isBuyBtn--disabled" style={fullBtnStyle as any}>
                            {t("商品已购买")}
                        </View>
                    ) : showOfflineStatus ? (
                        <View
                            className="other-products-btn"
                            style={fullBtnStyle as any}
                            onClick={() => {
                                onToProductList?.();
                            }}
                        >
                            {t("查看其他商品")}
                        </View>
                    ) : (
                        <>
                            {type === "exchange" ? (
                                <View
                                    className="other-products-btn"
                                    style={fullBtnStyle as any}
                                    onClick={() => {
                                        onShowSpecification?.();
                                    }}
                                >
                                    {t("立即兑换")}
                                </View>
                            ) : (
                                <>
                                    {isPresale && productPresale ? (
                                        <View
                                            className="other-products-btn"
                                            style={fullBtnStyle as any}
                                            onClick={() => {
                                                onShowSpecification?.();
                                            }}
                                        >
                                            {productPresale.saleMode === 2 ? (
                                                <>
                                                    <FormatPrice
                                                        fontStyle={{ fontWeight: "bold" }}
                                                        decimalsStyle={{
                                                            fontSize: "24rpx",
                                                            fontWeight: "bold"
                                                        }}
                                                        currencyStyle={{
                                                            fontSize: "24rpx",
                                                            fontWeight: "bold"
                                                        }}
                                                        priceData={productPresale.depositAmount}
                                                    />
                                                    {t("立即预定")}
                                                </>
                                            ) : (
                                                t("立即预购")
                                            )}
                                        </View>
                                    ) : (
                                        <>
                                            {product.productType === 1 || isGroupon ? (
                                                isGroupon ? (
                                                    <>
                                                        <View
                                                            className="btn cart"
                                                            style={cartBtnStyle as any}
                                                            onClick={() => {
                                                                onShowSpecification?.();
                                                            }}
                                                        >
                                                            {t("单独购买")}
                                                        </View>
                                                        {grouponRestricted ? (
                                                            <View className="btn buy btn-restricted" style={buyBtnStyle as any}>
                                                                {t("我要开团")}
                                                            </View>
                                                        ) : (
                                                            <View
                                                                className="btn buy"
                                                                style={buyBtnStyle as any}
                                                                onClick={() => {
                                                                    onShowGrouponPopup?.();
                                                                }}
                                                            >
                                                                {t("我要开团")}
                                                            </View>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        {isCycleBuy || isSubCard ? (
                                                            <View
                                                                className="other-products-btn"
                                                                style={fullBtnStyle as any}
                                                                onClick={() => {
                                                                    onShowSpecification?.();
                                                                }}
                                                            >
                                                                {t("立即购买")}
                                                            </View>
                                                        ) : memberRestricted ? (
                                                            <>
                                                                <View className="btn cart btn-restricted" style={cartBtnStyle as any}>
                                                                    {t("加入购物车")}
                                                                </View>
                                                                <View className="btn buy btn-restricted" style={buyBtnStyle as any}>
                                                                    {t("立即购买")}
                                                                </View>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <View
                                                                    className="btn cart"
                                                                    style={cartBtnStyle as any}
                                                                    onClick={() => {
                                                                        onShowSpecification?.();
                                                                    }}
                                                                >
                                                                    {t("加入购物车")}
                                                                </View>
                                                                <View
                                                                    className="btn buy"
                                                                    style={buyBtnStyle as any}
                                                                    onClick={() => {
                                                                        onShowSpecification?.(true);
                                                                    }}
                                                                >
                                                                    {t("立即购买")}
                                                                </View>
                                                            </>
                                                        )}
                                                    </>
                                                )
                                            ) : (
                                                <View
                                                    className="other-products-btn"
                                                    style={fullBtnStyle as any}
                                                    onClick={() => {
                                                        onShowSpecification?.();
                                                    }}
                                                >
                                                    {isReservation && !isSubCardReservationProduct ? t("立即预约") : t("立即购买")}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </View>
                {memberRestricted ? (
                    <View className="product-status member-restrict-status">
                        <Text className="iconfont-h5 icon-tishi" />
                        {memberRestrictTip || t("该商品仅限指定会员购买")}
                    </View>
                ) : isGroupon && grouponRestricted ? (
                    <View className="product-status member-restrict-status">
                        <Text className="iconfont-h5 icon-tishi" />
                        {t("该商品仅限指定会员购买")}
                    </View>
                ) : null}
                {detailLoaded && (product.productStatus === 0 || productStock === 0) && !isSubCardReservationProduct && (
                    <View className="product-status">{t(product.productStatus === 0 ? "商品已下架" : "商品已售罄")}</View>
                )}
            </View>
        </View>
    );
});

export default ProductActionBar;
