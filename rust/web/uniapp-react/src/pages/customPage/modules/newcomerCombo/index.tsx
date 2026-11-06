import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";

import { designPxToRpx } from "@/components/modules";
import { urlFormat, productImage } from "@/utils/format";
import { getProductsList } from "@/api/common";
import { redirect } from "@/utils";
import { getCouponListByIds } from "@/api/coupon/coupon";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

// ========== 优惠券信息 Map（对应旧 hooks/useCouponInfoMap.ts，module-level 单例） ==========
// 跨同页多个模块共享，避免重复请求；并发同批 ids 合并为一次 HTTP 请求，已缓存 id 自动跳过
const couponInfoMap = new Map<number, any>();
const couponInFlight = new Map<string, Promise<void>>();
const fetchCouponInfo = async (ids: number[]) => {
    const unique = Array.from(new Set(ids))
        .filter((id) => Number(id) > 0 && !couponInfoMap.has(id))
        .sort((a, b) => a - b);
    if (!unique.length) return;
    const key = unique.join(",");
    let promise = couponInFlight.get(key);
    if (!promise) {
        promise = (async () => {
            try {
                const fresh = await getCouponListByIds(unique);
                if (Array.isArray(fresh)) {
                    fresh.forEach((c: any) => {
                        if (c?.couponId) couponInfoMap.set(c.couponId, c);
                    });
                }
            } catch {
                // 接口报错时静默降级（缺失 info 的项由 displayCoupons 自动隐藏，不显示空壳卡）
            } finally {
                couponInFlight.delete(key);
            }
        })();
        couponInFlight.set(key, promise);
    }
    await promise;
};

export default function NewcomerCombo({ module, shopId = -1 }: Props) {
    // admin defaultNewcomerCombo 同源 fallback：处理老数据 / 不完整 payload，保证视觉与 admin canvas 一致
    const showHeaderFinal = useMemo(() => Number(module.showHeader ?? 1) === 1, [module.showHeader]);
    const headerTitle = useMemo(() => module.headerTitle ?? t("新人专享二重礼"), [module.headerTitle]);
    const headerSubTitle = useMemo(() => module.headerSubTitle ?? t("限量供应 先到先得"), [module.headerSubTitle]);

    const showSection1Final = useMemo(() => Number(module.showSection1 ?? 1) === 1, [module.showSection1]);
    const section1Badge = useMemo(() => module.section1Badge ?? t("1重礼"), [module.section1Badge]);
    const section1Title = useMemo(() => module.section1Title ?? t("新人尝鲜价"), [module.section1Title]);
    const section1MoreLink = useMemo(() => module.section1MoreLink ?? { link: "", title: "" }, [module.section1MoreLink]);

    const showSection2Final = useMemo(() => Number(module.showSection2 ?? 1) === 1, [module.showSection2]);
    const section2Badge = useMemo(() => module.section2Badge ?? t("2重礼"), [module.section2Badge]);
    const section2Title = useMemo(() => module.section2Title ?? t("新人专享礼包"), [module.section2Title]);
    const section2MoreLink = useMemo(() => module.section2MoreLink ?? { link: "", title: "" }, [module.section2MoreLink]);

    const showProductNameFinal = useMemo(() => Number(module.showProductName ?? 1) === 1, [module.showProductName]);
    const showMarketPriceFinal = useMemo(() => Number(module.showMarketPrice ?? 1) === 1, [module.showMarketPrice]);
    const buyBtnStyleNum = useMemo(() => Number(module.buyBtnStyle ?? 3), [module.buyBtnStyle]);

    const productTitleColor = useMemo(() => module.productTitleColor ?? "#333333", [module.productTitleColor]);
    const productBriefColor = useMemo(() => module.productBriefColor ?? "#999999", [module.productBriefColor]);
    const productPriceColor = useMemo(() => module.productPriceColor ?? "#FF3630", [module.productPriceColor]);
    const productMarketPriceColor = useMemo(() => module.productMarketPriceColor ?? "#999999", [module.productMarketPriceColor]);
    const productBriefGradientStart = useMemo(() => module.productBriefGradientStart ?? "#FF3630", [module.productBriefGradientStart]);
    const productBriefGradientEnd = useMemo(() => module.productBriefGradientEnd ?? "#FF7A45", [module.productBriefGradientEnd]);
    const productBriefTextColor = useMemo(() => module.productBriefTextColor ?? "#FFFFFF", [module.productBriefTextColor]);
    const buyBtnGradientStart = useMemo(() => module.buyBtnGradientStart ?? "#4CD964", [module.buyBtnGradientStart]);
    const buyBtnGradientEnd = useMemo(() => module.buyBtnGradientEnd ?? "#2EBA4F", [module.buyBtnGradientEnd]);
    const buyBtnTextColor = useMemo(() => module.buyBtnTextColor ?? "#FFFFFF", [module.buyBtnTextColor]);

    const couponBgGradientStart = useMemo(() => module.couponBgGradientStart ?? "#FFF1F1", [module.couponBgGradientStart]);
    const couponBgGradientEnd = useMemo(() => module.couponBgGradientEnd ?? "#FFFFFF", [module.couponBgGradientEnd]);
    const couponAmountColor = useMemo(() => module.couponAmountColor ?? "#FF3630", [module.couponAmountColor]);
    const couponConditionColor = useMemo(() => module.couponConditionColor ?? "#FF3630", [module.couponConditionColor]);
    const couponBtnTextColor = useMemo(() => module.couponBtnTextColor ?? "#FF3630", [module.couponBtnTextColor]);

    const boxGradientStart = useMemo(() => module.boxGradientStart ?? "#FF3630", [module.boxGradientStart]);
    const boxGradientEnd = useMemo(() => module.boxGradientEnd ?? "#FF7A45", [module.boxGradientEnd]);
    const containerBgImage = useMemo(() => module.containerBgImage ?? { picUrl: "", picThumb: "" }, [module.containerBgImage]);
    const contentBgColor = useMemo(() => module.contentBgColor ?? "#FFFFFF", [module.contentBgColor]);
    const decorationBgColor = useMemo(() => module.decorationBgColor ?? "#FFFFFF", [module.decorationBgColor]);

    const productPicRatio = useMemo<string>(() => module.productPicRatio || "1:1", [module.productPicRatio]);
    const productPicFillType = useMemo<string>(() => module.productPicFillType || "cover", [module.productPicFillType]);
    const productImgRadius = useMemo(() => Number(module.productImgRadius ?? 8), [module.productImgRadius]);
    const productPercent = useMemo(() => Number(module.productPercent ?? 28), [module.productPercent]);
    const productItemGap = useMemo(() => Number(module.productItemGap ?? 8), [module.productItemGap]);
    const productItemPadding = useMemo(() => Number(module.productItemPadding ?? 6), [module.productItemPadding]);
    const couponPerRow = useMemo(() => Number(module.couponPerRow ?? 3), [module.couponPerRow]);

    const productBriefListSafe = useMemo<string[]>(() => (Array.isArray(module.productBriefList) ? module.productBriefList : []), [module.productBriefList]);

    const frameSafe = useMemo<any>(() => module.frame ?? {}, [module.frame]);

    const outerStyle = useMemo(() => {
        const f = frameSafe;
        return [
            `padding-left:${designPxToRpx(f.boxPadding ?? 10)};`,
            `padding-right:${designPxToRpx(f.boxPadding ?? 10)};`,
            `padding-top:${designPxToRpx(f.boxPaddingTop ?? 5)};`,
            `padding-bottom:${designPxToRpx(f.boxPaddingBottom ?? 5)};`,
            f.backgroundColor ? `background-color:${f.backgroundColor};` : ""
        ].join("");
    }, [frameSafe]);

    const containerBgStyle = useMemo(() => {
        const a = boxGradientStart;
        const b = boxGradientEnd;
        const r = frameSafe.boxRadius ?? 8;
        const bgImg = containerBgImage?.picUrl;
        const layers: string[] = [];
        const sizes: string[] = [];
        if (bgImg) {
            layers.push(`url(${bgImg})`);
            sizes.push("cover");
        }
        layers.push(`linear-gradient(to bottom, ${a}, ${b})`);
        sizes.push("auto");
        return `background-image:${layers.join(",")};background-size:${sizes.join(",")};background-position:center;background-repeat:no-repeat;border-radius:${designPxToRpx(r)};`;
    }, [boxGradientStart, boxGradientEnd, frameSafe, containerBgImage]);

    const badgeStyle = useMemo(() => {
        const bg = productBriefGradientStart;
        const color = productBriefTextColor;
        return `background-color:${bg};color:${color};`;
    }, [productBriefGradientStart, productBriefTextColor]);

    const productBriefStyle = useMemo(() => {
        const a = productBriefGradientStart;
        const b = productBriefGradientEnd;
        const color = productBriefTextColor;
        return `background-image:linear-gradient(to bottom, ${a}, ${b});color:${color};`;
    }, [productBriefGradientStart, productBriefGradientEnd, productBriefTextColor]);

    const ratioPaddingMap: Record<string, string> = {
        default: "",
        "1:1": "100%",
        "3:4": "133.333%",
        "3:2": "66.667%"
    };

    const productTrackStyle = useMemo(() => `gap:${designPxToRpx(productItemGap)};`, [productItemGap]);

    const productItemStyle = useMemo(() => {
        const padding = productItemPadding;
        const percent = productPercent;
        const bg = contentBgColor;
        return [bg ? `background-color:${bg};` : "", `padding:${designPxToRpx(padding)};box-sizing:border-box;`, `flex:0 0 ${percent}%;width:${percent}%;`].join("");
    }, [productItemPadding, productPercent, contentBgColor]);

    const productPhotoStyle = useMemo(() => {
        const r = productPicRatio;
        const padding = ratioPaddingMap[r];
        return padding ? `padding-top:${padding};` : "padding-top:0;";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productPicRatio]);

    const productImgWrapStyle = useMemo(() => {
        const radius = productImgRadius;
        const r = productPicRatio;
        const padding = ratioPaddingMap[r];
        if (padding) {
            return `border-radius:${designPxToRpx(radius)};position:absolute;left:0;right:0;top:0;bottom:0;`;
        }
        return `border-radius:${designPxToRpx(radius)};position:static;`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productImgRadius, productPicRatio]);

    const productImgStyle = useMemo(() => {
        const r = productPicRatio;
        const padding = ratioPaddingMap[r];
        if (padding) {
            return `position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;display:block;`;
        }
        return `width:100%;height:auto;display:block;`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productPicRatio]);

    const imageMode = useMemo(() => {
        const r = productPicRatio;
        if (!ratioPaddingMap[r]) return "widthFix";
        return productPicFillType === "contain" ? "aspectFit" : "aspectFill";
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productPicRatio, productPicFillType]);

    const moreLinkPillStyle = useMemo(() => {
        const bg = couponBgGradientStart;
        const finalBg = bg === "#FFF1F1" ? "#FFEAD8" : bg;
        const color = couponBtnTextColor;
        return `background-color:${finalBg};color:${color};`;
    }, [couponBgGradientStart, couponBtnTextColor]);

    const buyBtnInlineStyle = useMemo(() => {
        const a = buyBtnGradientStart;
        const b = buyBtnGradientEnd;
        const color = buyBtnTextColor;
        return `background-image:linear-gradient(to right, ${a}, ${b});color:${color};`;
    }, [buyBtnGradientStart, buyBtnGradientEnd, buyBtnTextColor]);

    const couponItemStyle = useMemo(() => {
        const a = couponBgGradientStart;
        const b = couponBgGradientEnd;
        const n = couponPerRow;
        const gap = 8;
        const basis = `calc((100% - ${designPxToRpx((n - 1) * gap)}) / ${n})`;
        const bg = decorationBgColor;
        return `background-image:linear-gradient(to bottom, ${a}, ${b});flex:0 0 ${basis};max-width:${basis};--dec-bg:${bg};`;
    }, [couponBgGradientStart, couponBgGradientEnd, couponPerRow, decorationBgColor]);

    const formatPrice = (v: number | string | undefined | null): string => {
        const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
        const safe = Number.isFinite(Number(n)) ? Number(n) : 0;
        const round = Math.round((safe + Number.EPSILON) * 100) / 100;
        return round.toFixed(2);
    };

    const marketPriceVisible = (item: any) => {
        const mp = Number(item.marketPrice);
        const pp = Number(item.productPrice);
        return mp > 0 && mp > pp;
    };

    const onMoreClick = (link: any) => {
        if (!link) return;
        const url = urlFormat(link);
        if (url) redirect({ url });
    };

    const paramsValueMap: Record<number, string[]> = {
        1: ["productIds"],
        2: ["productCategoryId", "productNumber"],
        3: ["productTag", "productNumber"]
    };
    const paramsKeyMap: Record<string, string> = {
        productIds: "ids",
        productCategoryId: "categoryId",
        productNumber: "size",
        productTag: "introType"
    };
    const [productList, setProductList] = useState<any[]>([]);
    const _getProductList = async () => {
        const param: any = {};
        const products = module.products as any;
        if (!products || typeof products !== "object" || !products.productSelectType) {
            setProductList([]);
            return;
        }
        const type = products.productSelectType;
        const keys = paramsValueMap[type];
        if (!keys) {
            setProductList([]);
            return;
        }
        if (type == 1) {
            const ids: number[] = products.productIds || [];
            if (!ids.length) {
                setProductList([]);
                return;
            }
            param[paramsKeyMap[keys[0]]] = ids.join(",");
            param.size = ids.length;
        } else {
            param.page = 1;
            keys.forEach((key) => {
                param[paramsKeyMap[key]] = products[key];
            });
        }
        if (shopId && shopId != -1) {
            param.shopId = shopId;
        }
        try {
            const result = await getProductsList(param);
            setProductList(result.records ?? []);
        } catch (error) {
            setProductList([]);
        }
    };

    // 对应旧 setup 立即调用 + watch(module.products)：初次挂载拉取一次，products 变化时重新拉取
    useEffect(() => {
        void _getProductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(module.products ?? {})]);

    // 优惠券：按 coupons[].couponId 主动调 promotion/coupon/listByIds 拉真实数据（与 admin 同接口）
    // - 优先用 c.info（后端预聚合场景的快速路径）
    // - 否则从 module-level 单例 couponInfoMap 取（avoid 重复请求）
    const couponIdsKey = useMemo(() => {
        const list = Array.isArray(module.coupons) ? module.coupons : [];
        return list
            .map((c: any) => Number(c?.couponId))
            .filter((id) => id > 0)
            .sort((a, b) => a - b)
            .join(",");
    }, [module.coupons]);

    // 对应旧 watch(couponIdsKey, { immediate: true })：React effect 挂载即执行，天然 immediate
    // couponInfoMap 变化需触发重渲染：模块级 Map 不进 React 状态，用版本号驱动
    const [couponInfoVersion, setCouponInfoVersion] = useState(0);
    useEffect(() => {
        const ids = (Array.isArray(module.coupons) ? module.coupons : []).map((c: any) => Number(c?.couponId)).filter((id) => id > 0);
        if (!ids.length) return;
        let cancelled = false;
        void fetchCouponInfo(ids).then(() => {
            if (!cancelled) setCouponInfoVersion((v) => v + 1);
        });
        return () => {
            cancelled = true;
        };
    }, [couponIdsKey]);

    const displayCoupons = useMemo(() => {
        void couponInfoVersion; // 依赖版本号：fetchCouponInfo 完成后重算
        const list = Array.isArray(module.coupons) ? module.coupons : [];
        return list
            .map((c: any) => ({
                ...c,
                info: c?.info || couponInfoMap.get(Number(c?.couponId))
            }))
            .filter((c: any) => c.info);
    }, [module.coupons, couponInfoVersion]);

    const shouldRender = useMemo(() => {
        const section1Visible = showSection1Final && productList.length > 0;
        const section2Visible = showSection2Final && displayCoupons.length > 0;
        const headerVisible = showHeaderFinal && (section1Visible || section2Visible);
        return section1Visible || section2Visible || headerVisible;
    }, [showSection1Final, productList.length, showSection2Final, displayCoupons.length, showHeaderFinal]);

    if (!shouldRender) {
        return null;
    }

    return (
        <View className="module-ad-con module-newcomer_combo" style={outerStyle}>
            <View className="combo-wrap" style={containerBgStyle}>
                {showHeaderFinal && (
                    <View className="combo-header">
                        <Text className="header-title">{headerTitle}</Text>
                        {headerSubTitle && <Text className="header-sub">（{headerSubTitle}）</Text>}
                    </View>
                )}

                {showSection1Final && productList.length > 0 && (
                    <View className="combo-card combo-card-section1" style={{ backgroundColor: decorationBgColor }}>
                        <View className="card-head">
                            <Text className="card-badge" style={badgeStyle}>
                                {section1Badge}
                            </Text>
                            <Text className="card-title" style={{ color: productTitleColor }}>
                                {section1Title}
                            </Text>
                            <View className="more-link" style={{ color: productBriefColor || "#999999" }} onClick={() => onMoreClick(section1MoreLink)}>
                                {t("查看更多")}
                            </View>
                        </View>
                        <ScrollView scrollX className="product-scroll" showScrollbar={false}>
                            <View className="product-track" style={productTrackStyle}>
                                {productList.map((item: any, idx: number) => (
                                    <View
                                        key={(item.productId || 0) + "_" + idx}
                                        className="product-item"
                                        style={productItemStyle}
                                        // 旧 navigator :url → View onClick + redirect
                                        onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                    >
                                        <View className="product-photo" style={productPhotoStyle}>
                                            <View className="product-img-wrap" style={productImgWrapStyle}>
                                                <Image src={productImage(item)} mode={imageMode as any} style={productImgStyle} />
                                            </View>
                                            {productBriefListSafe[Number(idx)] && (
                                                <Text className="product-brief-overlap" style={productBriefStyle}>
                                                    {productBriefListSafe[Number(idx)]}
                                                </Text>
                                            )}
                                        </View>
                                        {showProductNameFinal && (
                                            <View className="product-name" style={{ color: productTitleColor }}>
                                                {item.productName}
                                            </View>
                                        )}
                                        <View className="product-bottom">
                                            <View className="product-prices">
                                                <Text className="price-current" style={{ color: productPriceColor }}>
                                                    <Text className="cur-prefix">¥</Text>
                                                    <Text className="cur-num">{formatPrice(item.productPrice)}</Text>
                                                </Text>
                                                {showMarketPriceFinal && marketPriceVisible(item) && (
                                                    <Text className="price-market" style={{ color: productMarketPriceColor }}>
                                                        ¥{formatPrice(item.marketPrice)}
                                                    </Text>
                                                )}
                                            </View>
                                            {buyBtnStyleNum > 0 && (
                                                <View className={`buy-btn buy-btn-style__${buyBtnStyleNum}`} style={buyBtnInlineStyle}>
                                                    {buyBtnStyleNum === 5 || buyBtnStyleNum === 6 ? (
                                                        <Text>{t("购买")}</Text>
                                                    ) : buyBtnStyleNum === 7 || buyBtnStyleNum === 8 ? (
                                                        <Text>{t("马上抢")}</Text>
                                                    ) : buyBtnStyleNum === 1 ? (
                                                        <Text className="iconfont-h5 icon-gouwuche" />
                                                    ) : buyBtnStyleNum === 2 ? (
                                                        <Text className="iconfont-h5 icon-gouwuche1" />
                                                    ) : buyBtnStyleNum === 3 ? (
                                                        <Text className="iconfont-h5 icon-jia" />
                                                    ) : buyBtnStyleNum === 4 ? (
                                                        <Text className="iconfont-h5 icon-jia1" />
                                                    ) : null}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {showSection2Final && displayCoupons.length > 0 && (
                    <View className="combo-card combo-card-section2" style={{ backgroundColor: decorationBgColor }}>
                        <View className="card-head">
                            <Text className="card-badge" style={badgeStyle}>
                                {section2Badge}
                            </Text>
                            <Text className="card-title" style={{ color: productTitleColor }}>
                                {section2Title}
                            </Text>
                            <View className="more-link more-link-pill" style={moreLinkPillStyle} onClick={() => onMoreClick(section2MoreLink)}>
                                {t("查看更多")}
                            </View>
                        </View>
                        <ScrollView scrollX className="coupon-row-scroll" showScrollbar={false}>
                            <View className="coupon-row">
                                {displayCoupons.map((c: any, i: number) => (
                                    <View key={(c.couponId || 0) + "_" + i} className="coupon-item" style={couponItemStyle}>
                                        <View className="coupon-amount" style={{ color: couponAmountColor }}>
                                            {Number(c.info?.couponType) === 2 ? (
                                                <>
                                                    <Text className="amount-num">{c.info?.couponDiscount}</Text>
                                                    <Text className="amount-prefix">{t("折")}</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <Text className="amount-prefix">¥</Text>
                                                    <Text className="amount-num">{c.info?.couponMoney}</Text>
                                                </>
                                            )}
                                        </View>
                                        <View className="coupon-condition" style={{ color: couponConditionColor }}>
                                            {Number(c.info?.reduceType) === 2 || !Number(c.info?.minOrderAmount) ? (
                                                <Text>{t("无门槛")}</Text>
                                            ) : (
                                                <Text>
                                                    {t("满")} {c.info?.minOrderAmount} {t("可用")}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    );
}
