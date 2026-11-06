import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToDevicePx, designPxToRpx } from "@/components/modules";
import { imageFormat, urlFormat, productImage } from "@/utils/format";
import { redirect, getElementRect } from "@/utils";
import { getProductsList } from "@/api/common";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";
import CommonBuyButton from "@/pages/customPage/modules/commonBuyButton/index";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

export default function ProductCarousel({ module, shopId = -1 }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    // admin defaultProductCarousel 同源 fallback：处理老数据 / 不完整 payload
    const showModuleTitle = useMemo(() => Number(module.showModuleTitle ?? 0) === 1, [module.showModuleTitle]);
    const moduleTitle = useMemo(() => module.moduleTitle || "", [module.moduleTitle]);
    const autoplay = useMemo(() => Number(module.autoplay ?? 0) === 1, [module.autoplay]);
    const showName = useMemo(() => Number(module.showName ?? 1) === 1, [module.showName]);
    const showDesc = useMemo(() => Number(module.showDesc ?? 0) === 1, [module.showDesc]);
    const showPrice = useMemo(() => Number(module.showPrice ?? 1) === 1, [module.showPrice]);
    const showSales = useMemo(() => Number(module.showSales ?? 0) === 1, [module.showSales]);
    const showMarketPrice = useMemo(() => Number(module.showMarketPrice ?? 1) === 1, [module.showMarketPrice]);

    // 图片比例锁定（padding-top 百分比 hack，兼容小程序）；default 不锁比例
    const ratioPaddingMap: Record<string, string> = {
        default: "",
        "1:1": "100%",
        "3:4": "133.333%",
        "3:2": "66.667%"
    };
    const ratioPadding = useMemo(() => ratioPaddingMap[module.productPicRatio || "1:1"] || "", [module.productPicRatio]);

    const getSales = (item: any) => Number(item.salesVolume ?? item.virtualSales ?? 0);
    const marketPriceVisible = (item: any) => Number(item.marketPrice) > Number(item.productPrice);

    const moduleBgUrl = useMemo(() => {
        const url = module.moduleBgImage?.picUrl;
        return url ? imageFormat(url) : "";
    }, [module.moduleBgImage]);

    const outerStyle = useMemo(() => {
        const f: any = module.frame || {};
        return [
            `padding-left:${designPxToRpx(f.boxPadding ?? 0)};`,
            `padding-right:${designPxToRpx(f.boxPadding ?? 0)};`,
            `padding-top:${designPxToRpx(f.boxPaddingTop ?? 10)};`,
            `padding-bottom:${designPxToRpx(f.boxPaddingBottom ?? 10)};`,
            f.backgroundColor ? `background-color:${f.backgroundColor};` : ""
        ].join("");
    }, [module.frame]);

    const titleStyle = useMemo(
        () =>
            `color:${module.moduleTitleColor || "#FFFFFF"};margin-bottom:${designPxToRpx(module.titleContentGap ?? 20)};text-align:${module.textAlign || "left"};`,
        [module.moduleTitleColor, module.titleContentGap, module.textAlign]
    );

    // 卡间距：单卡两侧各留 itemGap/2，相邻卡共得 itemGap
    const cellStyle = useMemo(() => {
        const gap = Number(module.itemGap ?? 10) / 2;
        return `padding-left:${designPxToRpx(gap)};padding-right:${designPxToRpx(gap)};`;
    }, [module.itemGap]);

    const cardVisualStyle = useMemo(() => {
        const r = Number(module.goodsRadius ?? 12);
        const pad = Number(module.innerPadding ?? 10);
        let base = "";
        switch (module.cardStyle) {
            case "noBorderWhite":
                base = "background-color:#fff;";
                break;
            case "shadow":
                base = "background-color:#fff;box-shadow:0 4rpx 8rpx rgba(0,0,0,0.06);";
                break;
            case "border":
                base = "background-color:#fff;border:1px solid rgba(0,0,0,0.08);";
                break;
            default:
                base = "background-color:transparent;";
        }
        return `${base}border-radius:${designPxToRpx(r)};padding:${designPxToRpx(pad)};`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.goodsRadius, module.innerPadding, module.cardStyle]);

    const imgBoxStyle = useMemo(() => {
        const r = designPxToRpx(Number(module.goodsRadius ?? 12));
        const radiusCss = r ? (module.picBottomRadius ? `border-radius:${r};` : `border-radius:${r} ${r} 0 0;`) : "";
        if (ratioPadding) return `${radiusCss}padding-top:${ratioPadding};height:0;`;
        return radiusCss;
    }, [module.goodsRadius, module.picBottomRadius, ratioPadding]);

    const infoStyle = useMemo(() => `text-align:${module.textAlign || "left"};`, [module.textAlign]);
    const nameStyle = useMemo(() => `color:${module.productTitleColor || "#666"};font-weight:${module.textWeight || 400};`, [module.productTitleColor, module.textWeight]);
    const descStyle = useMemo(() => `color:${module.descColor || "#999"};`, [module.descColor]);
    const salesStyle = useMemo(() => `color:${module.salesColor || "#999"};`, [module.salesColor]);

    const priceFontStyle = useMemo(
        () => ({
            color: module.priceColor || "#FF5E96",
            fontWeight: 700,
            fontSize: "32rpx",
            lineHeight: 1.1
        }),
        [module.priceColor]
    );
    const priceCurrencyStyle = useMemo(
        () => ({
            color: module.priceColor || "#FF5E96",
            fontSize: "22rpx"
        }),
        [module.priceColor]
    );
    const marketPriceFontStyle = useMemo(
        () => ({
            color: module.marketPriceColor || "#999",
            fontSize: "22rpx"
        }),
        [module.marketPriceColor]
    );

    // 购买按钮样式兜底：admin「按钮宽度/高度」滑块上限 10、圆角上限 20；老数据/模板可能存在越界值（如 paddingLeftRight:1000）把按钮撑满整行，这里按 admin 合法区间夹紧
    const safeBuyBtnStyle = useMemo(() => {
        const b: any = module.buyBtnStyle;
        if (!b || typeof b !== "object") return null;
        const clamp = (v: any, max: number, fallback: number) => {
            const n = Number(v);
            return Math.min(Math.max(Number.isFinite(n) ? n : fallback, 0), max);
        };
        return {
            ...b,
            paddingLeftRight: clamp(b.paddingLeftRight, 10, 10),
            paddingTopBottom: clamp(b.paddingTopBottom, 10, 0),
            radius: clamp(b.radius, 20, 16)
        };
    }, [module.buyBtnStyle]);

    // 露邻轮播：中间大卡占容器宽度 cardWidthPercent%，两侧露出量 = (100-占比)/2，换算成原生 swiper 的 previous/next-margin
    const [sysWidth, setSysWidth] = useState(375);
    const peekMargin = useMemo(() => {
        const box = designPxToDevicePx(Number(module.frame?.boxPadding ?? 0), sysWidth);
        const container = Math.max(0, sysWidth - box * 2);
        const pct = Number(module.cardWidthPercent ?? 80);
        const margin = (container * (100 - pct)) / 100 / 2;
        return `${Math.max(0, margin)}px`;
    }, [module.frame, module.cardWidthPercent, sysWidth]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const onSwiperChange = (e: any) => {
        setCurrentIndex(e.detail.current);
    };

    // 原生 swiper 需要显式高度：测量最高一张卡（.pc-measure 无 transform，量到的是自然高度；缩放在子级 .pc-card 上不影响父级布局）
    const [swiperHeight, setSwiperHeight] = useState(0);
    const recalcHeight = () => {
        // nextTick → setTimeout 0
        setTimeout(async () => {
            const rects = (await getElementRect(".pc-measure", rootRef.current, true)) as any[];
            if (Array.isArray(rects) && rects.length) {
                const max = Math.max(...rects.map((r: any) => r?.height || 0));
                if (max > 0) setSwiperHeight(max);
            }
        }, 0);
    };

    const [displayList, setDisplayList] = useState<any[]>([]);
    const buildDisplay = async () => {
        const raw = Array.isArray(module.productList) ? module.productList : [];
        // 运行端只渲染真实商品（admin demo 占位 productId:0 不展示）
        const items = raw.filter((i: any) => Number(i?.productId) > 0);
        if (!items.length) {
            setDisplayList([]);
            return;
        }
        const ids = items.map((i: any) => i.productId);
        const fresh: Record<number, any> = {};
        try {
            const param: any = { productStatus: 1, checkStatus: 1, ids: ids.join(","), size: ids.length, page: 1 };
            if (shopId && shopId != -1) param.shopId = shopId;
            const result = await getProductsList(param);
            (result.records || []).forEach((r: any) => {
                fresh[r.productId] = r;
            });
        } catch {
            // 拉取失败回退各 item 快照
        }
        setCurrentIndex(0);
        // 拉到最新商品则整体覆盖快照（携带最新 productPrice / picThumb / salesVolume 等；O2O 还需 deliveryMode / cyclePrice）
        setDisplayList(
            items.map((it: any) => {
                const f = fresh[it.productId];
                return f ? { ...it, ...f } : { ...it };
            })
        );
        recalcHeight();
        setTimeout(recalcHeight, 300);
    };

    // 对应旧 watch(module.productList) + onMounted 首拉：React effect 挂载即执行一次，合并两者
    useEffect(() => {
        void buildDisplay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(module.productList ?? [])]);

    // 对应旧 watch([productPicRatio, cardStyle, ...])：布局相关配置变化后重测 swiper 高度
    useEffect(() => {
        recalcHeight();
        setTimeout(recalcHeight, 300);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        module.productPicRatio,
        module.cardStyle,
        module.innerPadding,
        module.cardWidthPercent,
        module.showName,
        module.showDesc,
        module.showSales,
        module.showPrice,
        module.showMarketPrice
    ]);

    const windowResizeCallback = () => {
        setSysWidth(Taro.getSystemInfoSync().windowWidth || 375);
        recalcHeight();
    };

    // 对应旧 onMounted / onUnmounted：读取窗口宽度 + 注册/注销窗口 resize
    useEffect(() => {
        setSysWidth(Taro.getSystemInfoSync().windowWidth || 375);
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goDetail = (item: any) => {
        if (!item.productId) return;
        redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) });
    };

    if (!(displayList.length > 0)) {
        return null;
    }

    return (
        <View ref={rootRef} className="module-ad-con module-product_carousel" style={outerStyle}>
            {moduleBgUrl ? <Image className="pc-module-bg" src={moduleBgUrl} mode="aspectFill" /> : null}
            <View className="pc-body">
                {showModuleTitle && moduleTitle ? (
                    <View className="pc-module-title" style={titleStyle}>
                        {moduleTitle}
                    </View>
                ) : null}
                <Swiper
                    className="pc-swiper"
                    style={{ height: swiperHeight + "px" }}
                    circular={displayList.length > 2}
                    autoplay={autoplay}
                    interval={3000}
                    duration={500}
                    previousMargin={peekMargin}
                    nextMargin={peekMargin}
                    indicatorDots={false}
                    onChange={onSwiperChange}
                >
                    {displayList.map((item: any, idx: number) => (
                        <SwiperItem key={(item.productId || 0) + "_" + idx}>
                            <View className="pc-cell" style={cellStyle}>
                                <View className="pc-measure">
                                    <View
                                        className={`pc-card ${currentIndex === idx ? "pc-card-active" : ""}`}
                                        style={cardVisualStyle}
                                        onClick={() => goDetail(item)}
                                    >
                                        <View className="pc-photo">
                                            <View className="pc-img-box" style={imgBoxStyle}>
                                                {ratioPadding ? (
                                                    <Image className="pc-img pc-img-ratio" mode="aspectFill" src={productImage(item)} />
                                                ) : (
                                                    <Image className="pc-img pc-img-fluid" mode="widthFix" src={productImage(item)} onLoad={recalcHeight} />
                                                )}
                                            </View>
                                        </View>
                                        <View className="pc-info" style={infoStyle}>
                                            {showName ? (
                                                <View className="pc-name" style={nameStyle}>
                                                    <Text>{item.productName}</Text>
                                                </View>
                                            ) : null}
                                            {showDesc && item.productDesc ? <View className="pc-desc" style={descStyle}>{item.productDesc}</View> : null}
                                            {showSales ? (
                                                <View className="pc-sales" style={salesStyle}>
                                                    {t("已售")}
                                                    {getSales(item)}
                                                </View>
                                            ) : null}
                                            <View className="pc-bottom">
                                                {showPrice ? (
                                                    <View className="pc-prices">
                                                        <View className="price-current">
                                                            <FormatPrice
                                                                fontStyle={priceFontStyle as any}
                                                                currencyStyle={priceCurrencyStyle as any}
                                                                priceData={item.deliveryMode === 2 ? item.cyclePrice : item.productPrice}
                                                            />
                                                        </View>
                                                        {showMarketPrice && marketPriceVisible(item) ? (
                                                            <View className="price-market">
                                                                <FormatPrice
                                                                    fontStyle={marketPriceFontStyle as any}
                                                                    currencyStyle={marketPriceFontStyle as any}
                                                                    priceData={item.marketPrice}
                                                                />
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                                {/* 旧模板把 class="pc-buy" 挂在 commonBuyButton 组件上；React 版 CommonBuyButton 不接收 className，包一层 View 保持布局 */}
                                                {safeBuyBtnStyle && safeBuyBtnStyle.showBtn ? (
                                                    <View className="pc-buy">
                                                        <CommonBuyButton styleOptions={safeBuyBtnStyle} />
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </SwiperItem>
                    ))}
                </Swiper>
            </View>
        </View>
    );
}
