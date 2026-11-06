import { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useReachBottom, useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigBackTop from "@/components/tig/tig-back-top";
import TigImage from "@/components/tig/tig-image/TigImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import EmptyBox from "@/components/empty-box/EmptyBox";
import Specification from "@/components/product/specification";
import type { SpecificationRef } from "@/components/product/specification";
import { getMyCouponInfo, addCoupon, getCouponDiscount } from "@/api/coupon/coupon";
import type { CouponDetailItem, DiscountAmountData } from "@/types/coupon/coupon";
import { getCategoryProduct } from "@/api/search/search";
import type { ProductList } from "@/types/search/search";
import { useScrollTop } from "@/hooks";
import { useProductStyle } from "@/hooks/useProductStyle";
import { useCurrencyStore } from "@/store/currency";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { isOverseas, moneyFormat, redirect, staticResource } from "@/utils";
import { pickPic } from "@/utils/format";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";

import "./detail.scss";
import { usePageGuards } from "@/utils/pageMixin";

interface FilterParams {
    page: number;
    size: number;
    sort: string;
    order: string;
    keyword: string;
    couponId: number;
    shopId?: number;
}

interface TabItem {
    label: string;
    value: string;
    order?: string;
}

/**
 * 优惠券详情页（自旧 pages/coupon/detail.vue 移植）
 * - 展示优惠券详细信息
 * - 显示适用商品列表
 * - 支持领取和使用
 */
export default function CouponDetail() {
    usePageGuards();
    const router = useRouter();
    const options = (router.params || {}) as Record<string, any>;
    const { scrollTop } = useScrollTop();

    const dollarSign = useConfigStore((s) => s.dollarSign);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);
    const langCode = useI18nStore((s) => s.langCode);
    const isZh = isOverseas() ? (langCode ? langCode.includes("zh") : true) : true;

    // 旧 onLoad：id/shopId 写入查询参数
    const id = Number(options.id) || undefined;
    const filterParamsRef = useRef<FilterParams>({
        page: 1,
        size: 20,
        sort: "",
        order: "asc",
        keyword: "",
        couponId: id ?? 0,
        shopId: options.shopId ? Number(options.shopId) : undefined
    });

    const [detailData, setDetailData] = useState<CouponDetailItem>({} as CouponDetailItem);
    const [keyword, setKeyword] = useState("");
    const [tabIndex, setTabIndex] = useState("default");
    const [tabList, setTabList] = useState<TabItem[]>([
        {
            label: t("默认"),
            value: "default"
        },
        {
            label: t("销量"),
            value: "sale"
        },
        {
            label: t("价格"),
            value: "price",
            order: "desc"
        }
    ]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [productList, setProductList] = useState<ProductList[]>([]);
    const { styleMap } = useProductStyle(productList);
    const [discountAmount, setDiscountAmount] = useState<DiscountAmountData>({
        minOrderAmount: "0",
        couponMoney: "0",
        productPrice: "0",
        discountMoney: "0",
        couponUnit: 0,
        quantityCount: 0
    });
    const [productId, setProductId] = useState(0);
    const specificationRef = useRef<SpecificationRef | null>(null);
    const currentItemRef = useRef<any>({});

    const formatDisplayMoney = (amount: number | string) => {
        const symbol = isOverseas() ? currentCurrencyData.symbol || dollarSign : dollarSign;
        let value = Number(amount || 0);
        if (isOverseas() && currentCurrencyData.rate) {
            value *= Number(currentCurrencyData.rate);
        }
        return `${symbol}${moneyFormat(String(value))}`;
    };

    const getDetail = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            if (id) {
                const result = await getMyCouponInfo({ id });
                setDetailData(result);
            }
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    const couponStatus = (() => {
        if (detailData.limitNum === 0) {
            if (detailData.isReceive === 1) {
                return t("已领取");
            } else {
                return t("马上领");
            }
        } else {
            if (detailData.isReceive === 0) {
                return "马上领";
            } else if (detailData.receiveNum >= detailData.limitNum) {
                return "已领取";
            } else {
                return t("再次领取");
            }
        }
    })();

    const resetList = () => {
        setProductList([]);
        filterParamsRef.current.page = 1;
    };

    const __getCategoryProduct = async () => {
        try {
            const productInfo = await getCategoryProduct({ ...filterParamsRef.current });
            setTotal(productInfo.total);
            productInfo.records.forEach((item) => (item.isCheck = false));
            // 接口泛型为 Record[]，页面沿用旧 ProductList 结构（字段完全覆盖）
            const records = productInfo.records as unknown as ProductList[];
            setProductList((prev) => [...prev, ...records]);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoading(false);
        }
    };

    const __getCouponDiscount = async () => {
        try {
            const result = await getCouponDiscount(id!);
            setDiscountAmount(result);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            console.error(error);
        }
    };

    // 对应旧 onLoad：注册搜索回传监听 + 首次拉取商品
    useEffect(() => {
        const handleSearchReturn = (val: any) => {
            filterParamsRef.current.keyword = val;
            setKeyword(val);
            resetList();
            void __getCategoryProduct();
        };
        Taro.eventCenter.on("coupon-search-return", handleSearchReturn);

        void __getCategoryProduct();

        // 对应旧 onUnload
        return () => {
            Taro.eventCenter.off("coupon-search-return", handleSearchReturn);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onShow
    useDidShow(() => {
        if (id) {
            void getDetail();
            void __getCouponDiscount();
        }
    });

    // 对应旧 onReachBottom
    useReachBottom(() => {
        if (filterParamsRef.current.page < Math.ceil(total / filterParamsRef.current.size)) {
            filterParamsRef.current.page++;
            void __getCategoryProduct();
        }
    });

    const handleSubmit = async () => {
        if (couponStatus === "已领取") {
            Taro.showToast({
                title: t("已领取"),
                icon: "none",
                duration: 1500
            });
            return;
        }

        try {
            if (id) {
                await addCoupon({ couponId: id });
                void getDetail();
                Taro.showToast({
                    title: t("领取成功"),
                    duration: 1500
                });
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1500
            });
            console.error(error);
        }
    };

    const onChangeTab = (item: any) => {
        const nextOrder = item.value == "price" ? (item.order === "desc" ? "asc" : "desc") : "";
        setTabList((prev) =>
            prev.map((tab) => (tab.value === item.value ? { ...tab, order: nextOrder } : { ...tab, order: tab.order }))
        );
        setTabIndex(item.value);
        filterParamsRef.current.sort = item.value;
        filterParamsRef.current.order = nextOrder;
        resetList();
        void __getCategoryProduct();
    };

    const handleToSearch = () => {
        Taro.navigateTo({
            url: "/pages/coupon/search"
        });
    };

    // 旧页面保留了未使用的 handleSearch，此处同样保留以对齐
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSearch = () => {
        resetList();
        void __getCategoryProduct();
    };

    const tipText = (() => {
        let text = "";
        if (Number(discountAmount.productPrice) == 0) {
            text = t("快去选购商品参与优惠活动");
        } else if (discountAmount.couponUnit === 1) {
            if (Number(discountAmount.productPrice) > Number(discountAmount.minOrderAmount)) {
                text = isOverseas()
                    ? t("已满足优惠条件，用券下单立减{0}", { 0: formatDisplayMoney(discountAmount.discountMoney) })
                    : t("已满足优惠条件，用券下单立减{0}元", { 0: discountAmount.discountMoney });
            } else {
                text = isOverseas()
                    ? t("还需{0}，即可用券下单立减{1}，快去选购商品参与优惠活动", {
                          0: formatDisplayMoney(Number(discountAmount.minOrderAmount) - Number(discountAmount.productPrice)),
                          1: formatDisplayMoney(discountAmount.discountMoney)
                      })
                    : `还需${Number(discountAmount.minOrderAmount) - Number(discountAmount.productPrice)}元，即可用券下单立减${
                          discountAmount.discountMoney
                      }元，快去选购商品参与优惠活动`;
            }
        } else {
            if (Number(discountAmount.quantityCount) >= Number(discountAmount.minOrderAmount)) {
                text = isOverseas()
                    ? t("已满足优惠条件，用券下单立减{0}", { 0: formatDisplayMoney(discountAmount.discountMoney) })
                    : `已满足优惠条件，用券下单立减${discountAmount.discountMoney}元`;
            } else {
                text = isOverseas()
                    ? t("还差{0}件，即可用券下单立减{1}，快去选购商品参与优惠活动", {
                          0: Number(discountAmount.minOrderAmount) - Number(discountAmount.quantityCount),
                          1: formatDisplayMoney(discountAmount.discountMoney)
                      })
                    : `还差${Number(discountAmount.minOrderAmount) - Number(discountAmount.quantityCount)}件，即可用券下单立减${
                          discountAmount.discountMoney
                      }元，快去选购商品参与优惠活动`;
            }
        }

        return text;
    })();

    const handleToCart = () => {
        redirect({ url: "/pages/cart/index" });
    };

    const handleToDetail = (productIdValue: number) => {
        Taro.navigateTo({
            url: `/pages/product/index?id=${productIdValue}`
        });
    };

    const couponBg = `url(${staticResource("coupon/coupon-bg2.png")})`;

    const handleBuy = (item: any) => {
        if (item.isCheck) return;
        item.isCheck = true;
        currentItemRef.current = item;
        setProductList((prev) =>
            prev.map((it) => (it.productId === item.productId ? { ...it, isCheck: true } : it))
        );
        setProductId(item.productId);
    };
    const loadEnd = () => {
        specificationRef.current?.handleShowPopup();
        currentItemRef.current.isCheck = false;
        setProductList((prev) =>
            prev.map((it) =>
                it.productId === currentItemRef.current.productId ? { ...it, isCheck: false } : it
            )
        );
    };
    const handleClose = () => {
        setProductId(0);
    };

    const getAddCardSucceed = () => {
        void __getCouponDiscount();
    };

    return (
        <TigLayout title={t("优惠券")}>
            {detailData ? (
                <>
                    <View className="coupon-detail-title">
                        <View className="detail-title-box">
                            {isZh ? (
                                <Image className="img-box" src={staticResource("coupon/coupon-bg1.png")} />
                            ) : (
                                <View className="img-box-con">
                                    <Image className="img-box" src={staticResource("coupon/overseas-coupon-bg.png")} />
                                    <View className="img-box-text">{t("用券买 更划算")}</View>
                                </View>
                            )}

                            <View className="coupon-box">
                                <View className="coupon-item" style={{ backgroundImage: couponBg }}>
                                    <View className="left">
                                        {detailData.couponType === 2 ? (
                                            <View className="zhekou-box">
                                                <View className="zhekou"> {detailData.couponDiscount}</View>
                                                <View className="zhe">{t("折")}</View>
                                            </View>
                                        ) : (
                                            <FormatPrice
                                                showText={false}
                                                currencyStyle={{ selfAlign: "end", fontSize: "24rpx" }}
                                                decimalsStyle={{ selfAlign: "end", fontSize: "28rpx" }}
                                                fontStyle={{ fontSize: "48rpx", lineHeight: "1" }}
                                                priceData={detailData.couponMoney}
                                            />
                                        )}

                                        <View className="left-name line1">{detailData.couponName}</View>
                                    </View>
                                    <View className="middle">
                                        <View className="middle-title">{t("优惠券")}</View>
                                        {detailData.sendType === 1 && (
                                            <View className="sub">
                                                {" "}
                                                {t("有效期")}：{detailData.useEndDate}{" "}
                                            </View>
                                        )}
                                        {detailData.sendType === 0 && detailData.delayDay > 0 && (
                                            <View className="sub">
                                                {isOverseas() ? (
                                                    <>{t("领券{0}天后生效，有效期{1}天", { 0: detailData.delayDay, 1: detailData.useDay })}</>
                                                ) : (
                                                    <>{`领券${detailData.delayDay}天后生效，有效期${detailData.useDay}天`}</>
                                                )}
                                            </View>
                                        )}
                                        {detailData.sendType === 0 && detailData.delayDay === 0 && (
                                            <View className="sub">
                                                {isOverseas() ? (
                                                    <>{t("领券当日起{0}天内可用", { 0: detailData.useDay })}</>
                                                ) : (
                                                    <>{`领券当日起${detailData.useDay}天内可用`}</>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                    <View
                                        className={`coupon-btn${couponStatus === "已领取" ? " disabled" : ""}`}
                                        onClick={handleSubmit}
                                    >
                                        {" "}
                                        {t(couponStatus)}{" "}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View
                        className="sticky"
                        style={process.env.TARO_ENV === "weapp" ? { top: "var(--nav-height)" } : undefined}
                    >
                        <View className="coupon-menu">
                            <View className="coupon-search" onClick={handleToSearch}>
                                <View className="coupon-search-box">
                                    {!keyword ? (
                                        <View className="search-text">
                                            {" "}
                                            <Text className="iconfont-h5 icon-sousuo sousuo-icon" />
                                            {t("搜索")}{" "}
                                        </View>
                                    ) : (
                                        <View className="search-text is-value">
                                            {" "}
                                            <Text className="iconfont-h5 icon-sousuo sousuo-icon" />
                                            {keyword}{" "}
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View className="coupon-content">
                                {tabList.map((item, index) => (
                                    <View
                                        key={`${item.value}-${index}`}
                                        className={`coupon-item${tabIndex === item.value ? " active" : ""}`}
                                        onClick={() => onChangeTab(item)}
                                    >
                                        <Text>{t(item.label)}</Text>
                                        {item.value === "price" && (
                                            <View className="price-ico-box flex flex-column">
                                                <Text
                                                    className={`iconfont-h5 icon-shangjiantou price-icon${
                                                        tabIndex === "price" && item.order === "asc" ? " order" : ""
                                                    }`}
                                                />
                                                <Text
                                                    className={`iconfont-h5 icon-xiajiantou price-icon${
                                                        tabIndex === "price" && item.order === "desc" ? " order" : ""
                                                    }`}
                                                />
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                    {productList.length > 0 && (
                        <View className="product-list">
                            {productList.map((item) => (
                                <View className="product-item" key={item.productId}>
                                    <View className="item-left" onClick={() => handleToDetail(item.productId!)}>
                                        <TigImage src={pickPic(item)} />
                                        <View className="product-status-box">
                                            {(shouldShowSoldOut(item) || item.productStatus == 0) && (
                                                <View className="outsale">
                                                    {shouldShowSoldOut(item) ? t("已售罄") : t("已下架")}
                                                </View>
                                            )}
                                        </View>
                                        {styleMap[item.productId!]?.borderImage && (
                                            <Image
                                                className="product-style-border"
                                                src={styleMap[item.productId!].borderImage!}
                                                mode="scaleToFill"
                                            />
                                        )}
                                    </View>
                                    <View className="item-right">
                                        <View className="item-right-title line2" onClick={() => handleToDetail(item.productId!)}>
                                            {item.productName}
                                        </View>
                                        <View className="item-right-price">
                                            <FormatPrice
                                                decimalsStyle={{
                                                    fontSize: "24rpx",
                                                    fontWeight: "bold"
                                                }}
                                                currencyStyle={{
                                                    fontSize: "23rpx",
                                                    fontWeight: "bold"
                                                }}
                                                fontStyle={{ fontSize: "32rpx" }}
                                                priceData={item.price}
                                            />
                                        </View>
                                        <View className="buy_icon">
                                            <View className="buy_btn" onClick={() => handleBuy(item)}>
                                                {item.isCheck ? (
                                                    // TODO(MIGRATION)：旧 up-loading-icon 以自绘 loading 圆环等价替代
                                                    <View className="buy_loading" />
                                                ) : (
                                                    <Text className="iconfont-h5 icon-gouwuche3 buy_btn_icon" />
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                    {!loading && total === 0 && <EmptyBox text={t("好狠的筛选条件啊，把相关的商品都埋没了！")} />}
                    {/* TODO(MIGRATION)：旧 tig-fixed-placeholder 未移植，暂内联等价固定底栏 + 安全区占位 */}
                    <View className="fixed-placeholder">
                        <View className="btn-box">
                            <View className="btn-box-left">
                                <View className="left-text"> {t("合计")}： </View>
                                <View className="total-money">
                                    <FormatPrice
                                        decimalsStyle={{
                                            fontSize: "26rpx"
                                        }}
                                        currencyStyle={{
                                            fontSize: "23rpx"
                                        }}
                                        fontStyle={{ fontSize: "36rpx" }}
                                        priceData={discountAmount.productPrice.toString()}
                                    />
                                </View>
                            </View>
                            <View className="btn-box-right" onClick={handleToCart}>
                                {t("去购物车")}
                            </View>
                            <View className="tip line2">{tipText}</View>
                        </View>
                    </View>
                    <View className="btn-placeholder" />
                    <Specification
                        ref={specificationRef}
                        productId={productId}
                        onAddCardSucceed={getAddCardSucceed}
                        onLoadEnd={loadEnd}
                        onClose={handleClose}
                    />
                    <TigBackTop scrollTop={scrollTop} bottom={90} />
                </>
            ) : null}
        </TigLayout>
    );
}