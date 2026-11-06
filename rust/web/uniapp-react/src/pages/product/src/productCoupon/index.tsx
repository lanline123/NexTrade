import { Fragment, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { pickPic } from "@/utils/format";
/**
 * 商品优惠券领取组件（自旧 pages/product/src/productCoupon.vue 移植）
 * - 弹窗展示可领取的商品优惠券列表
 * - 一键领取优惠券功能
 * - 显示优惠券金额、使用条件、有效期
 * - 旧 tig-popup → NutUI Popup、tig-button → 按视觉重写、tig-fixed-placeholder → fixed 底栏
 */
import type { ProductItem, SkuPromotion } from "@/types/product/product";
import { addCoupon } from "@/api/coupon/coupon";
import type { ProductCouponItem } from "@/types/product/product";
import { getProductCouponList, getProductDetail } from "@/api/product/product";
import { isOverseas } from "@/utils";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    /** 对应旧 v-model（modelValue） */
    modelValue?: boolean;
    /** 对应旧 emit("update:modelValue") */
    onUpdateModelValue?: (val: boolean) => void;
    promotionList?: SkuPromotion[];
    productId?: number;
    shopId?: number;
}

export default function ProductCoupon({
    modelValue = false,
    onUpdateModelValue,
    promotionList = [],
    productId = 0,
    shopId = 0
}: Props) {
    const showCoupon = modelValue;
    const setShowCoupon = (value: boolean) => {
        onUpdateModelValue?.(value);
    };

    const showB2bText = isShowB2bPriceText();

    interface ActivitTextMap {
        [key: number]: string;
    }

    const activitTextMap: ActivitTextMap = {
        3: t("满减"),
        4: t("满折"),
        5: t("满赠")
    };

    const activityList = promotionList.filter((item) => item.type === 3 || item.type === 4);
    const giftList = promotionList.filter((item) => item.type === 5);

    interface GiftDisplayItem {
        key: string;
        giftId: number;
        minAmount: number;
        desc: string;
        productId: number;
        pic: string;
        price: string | number;
    }

    const [giftProductInfoMap, setGiftProductInfoMap] = useState<Record<number, ProductItem>>({});
    const giftProductInfoMapRef = useRef<Record<number, ProductItem>>(giftProductInfoMap);
    giftProductInfoMapRef.current = giftProductInfoMap;

    const getGiftDisplayItems = (giftItem: SkuPromotion): GiftDisplayItem[] => {
        const legacyItems = Array.isArray(giftItem.data?.promotionDesc) ? giftItem.data.promotionDesc : [];
        if (legacyItems.length > 0) {
            return legacyItems.map((item: any, index: number) => {
                const info = item?.gift?.productInfo || {};
                return {
                    key: `${giftItem.promotionId}-legacy-${item?.giftId ?? index}`,
                    giftId: Number(item?.giftId ?? 0),
                    minAmount: Number(item?.minAmount ?? 0),
                    desc: String(item?.desc ?? ""),
                    productId: Number(info.productId ?? 0),
                    pic: pickPic(info),
                    price: info.productPrice ?? 0
                };
            });
        }

        const rules = Array.isArray(giftItem.data?.promotionTypeData) ? giftItem.data.promotionTypeData : [];
        const gifts = Array.isArray(giftItem.data?.productGift) ? giftItem.data.productGift : [];
        return rules.map((rule, index) => {
            const gift = gifts.find((item) => Number(item.id) === Number(rule.giftId));
            const productId = Number(gift?.productId ?? 0);
            const info = giftProductInfoMapRef.current[productId];
            return {
                key: `${giftItem.promotionId}-rule-${rule.giftId ?? index}-${rule.minAmount}`,
                giftId: Number(rule.giftId ?? 0),
                minAmount: Number(rule.minAmount ?? 0),
                desc: String(rule.desc || gift?.giftName || ""),
                productId,
                pic: info ? pickPic(info) : "",
                price: info?.productPrice ?? 0
            };
        });
    };

    const loadGiftProducts = async () => {
        const productIds = giftList
            .flatMap((item) => (Array.isArray(item.data?.productGift) ? item.data.productGift : []))
            .map((item) => Number(item.productId ?? 0))
            .filter((id) => id > 0 && !giftProductInfoMapRef.current[id]);
        const uniqueIds = Array.from(new Set(productIds));
        await Promise.all(
            uniqueIds.map(async (id) => {
                try {
                    const result = await getProductDetail(id);
                    if (result.item) {
                        setGiftProductInfoMap((prev) => ({ ...prev, [id]: result.item }));
                        giftProductInfoMapRef.current = { ...giftProductInfoMapRef.current, [id]: result.item };
                    }
                } catch (error) {
                    console.error(error);
                }
            })
        );
    };

    const [showOfferDetail, setShowOfferDetail] = useState(false);
    const handleShowOfferDetail = () => {
        setShowOfferDetail(!showOfferDetail);
    };

    const getCoupon = async (value: any) => {
        if (value.isReceive === 1 && value.limitNum > 0 && value.receiveNum >= value.limitNum) return;
        try {
            await addCoupon({ couponId: value.couponId });
            Taro.showToast({
                title: t("领取成功"),
                duration: 1000
            });
            setTimeout(() => {
                getCouponList();
            }, 500);
        } catch (error: any) {
            console.log("error", error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };
    const couponStatus = (isReceive: number, limitNum: number, receiveNum: number) => {
        if (limitNum === 0) {
            if (isReceive === 1) {
                return t("已领取");
            } else if (receiveNum > 0) {
                return t("再次领取");
            } else {
                return t("马上领");
            }
        } else {
            if (isReceive === 0) {
                return t("马上领");
            } else if (receiveNum >= limitNum) {
                return t("已领取");
            } else {
                return t("再次领取");
            }
        }
    };
    const isCouponReceived = (isReceive?: number, limitNum?: number, receiveNum?: number) => {
        const limit = Number(limitNum ?? 0);
        const received = Number(receiveNum ?? 0);
        const receiveFlag = Number(isReceive ?? 0);
        return limit === 0 ? receiveFlag === 1 : receiveFlag === 1 && received >= limit;
    };
    const [couponList, setCouponList] = useState<ProductCouponItem[]>([]);
    const getCouponList = async () => {
        try {
            const params = {
                id: Number(productId),
                shopId: Number(shopId)
            };
            const result = await getProductCouponList(params);
            setCouponList(result.map(normalizeCouponItem));
        } catch (error: any) {
            console.error(error.message);
        }
    };

    const handleLink = (id: number) => {
        Taro.navigateTo({
            url: `/pages/product/index?id=${id}`
        });
    };

    // 旧 watchEffect(() => { if (showCoupon.value && props.productId > 0) getCouponList(); })
    useEffect(() => {
        if (showCoupon && productId > 0) {
            void getCouponList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCoupon, productId]);

    // 旧 watch(showCoupon, (open) => { if (open) loadGiftProducts(); })
    useEffect(() => {
        if (showCoupon) {
            void loadGiftProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCoupon]);

    type CouponFallback = ProductCouponItem & {
        id?: number;
        type?: number;
        coupon_amount?: string | number;
        coupon_money?: string | number;
        coupon_discount?: string | number;
        coupon_type?: string | number;
        is_receive?: string | number;
        limit_num?: string | number;
        receive_num?: string | number;
    };

    const normalizeCouponItem = (item: CouponFallback): ProductCouponItem => ({
        ...item,
        couponId: Number(item.couponId ?? item.id ?? 0),
        couponMoney: String(item.couponMoney ?? item.coupon_money ?? item.coupon_amount ?? ""),
        couponDiscount: Number(item.couponDiscount ?? item.coupon_discount ?? 0),
        couponType: Number(item.couponType ?? item.coupon_type ?? item.type ?? 0),
        isReceive: Number(item.isReceive ?? item.is_receive ?? 0),
        limitNum: Number(item.limitNum ?? item.limit_num ?? 0),
        receiveNum: Number(item.receiveNum ?? item.receive_num ?? 0)
    });

    return (
        // 旧 <tig-popup v-model:show="showCoupon" :z-index="999" :show-close="false" background-color="#fff"> → NutUI Popup（bottom + 10px 圆角）
        <Popup
            visible={showCoupon}
            position="bottom"
            closeable={false}
            onClose={() => {
                setShowCoupon(false);
            }}
            style={{ background: "#fff", borderRadius: "20rpx 20rpx 0 0", zIndex: 999 }}
        >
            <View className="coupon-content">
                <View className="coupon-title">{t("优惠")}</View>
                {/* 旧 <scroll-view scroll-y="true" class="promotion-box"> → ScrollView */}
                <ScrollView className="promotion-box" scrollY>
                    <View className="promotion-content">
                        {/* 限时折扣 */}
                        {/* 旧模板 v-if="false"（常闭死代码，按原结构保留：false && ...） */}
                        {false && (
                            <View className="discount-box">
                                <View className="discount-title">
                                    {t("使用以下优惠，预计到手")}
                                    <FormatPrice
                                        showText={false}
                                        fontStyle={{ fontSize: "23rpx", fontWeight: "400", color: "var(--general)" }}
                                        priceData="18"
                                    />
                                    <Text
                                        onClick={() => {
                                            handleShowOfferDetail();
                                        }}
                                    >
                                        ，{t("优惠明细")}{" "}
                                        <Text className={`iconfont-h5 icon-xiajiantou1-copy ${showOfferDetail ? "rotate" : ""}`} />
                                    </Text>
                                </View>
                                {showOfferDetail && !showB2bText ? (
                                    <View className="discount-content">
                                        <View className="discount-item">
                                            <View className="discount-item-label">{t("限时活动价格共计：")}</View>
                                            <View className="discount-item-content">
                                                <FormatPrice showText={false} fontStyle={{ fontSize: "23rpx", fontWeight: "400" }} priceData="18" />
                                            </View>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        )}
                        {activityList.length > 0 || giftList.length > 0 ? (
                            <View className="activity-box">
                                <View className="public-title">{t("促销")}</View>
                                {activityList.length > 0 ? (
                                    <>
                                        {activityList.map((item) => (
                                            <View key={item.promotionId} className="activity-item">
                                                <View className="activity-item-label">{activitTextMap[item.type]}</View>
                                                <View className="activity-item-value">
                                                    <View className="activity-item-name">{item.data.promotionName}</View>
                                                    <View className="activity-item-time">
                                                        {item?.data?.startTime}~{item.data.endTime}
                                                    </View>
                                                    {item.canJoin === false ? (
                                                        <View className="activity-item-time" style={{ color: "var(--tag-text)" }}>
                                                            {item.restrictTip || t("该活动仅限指定会员参与")}
                                                        </View>
                                                    ) : null}
                                                </View>
                                            </View>
                                        ))}
                                    </>
                                ) : null}
                                {giftList.length > 0 ? (
                                    <>
                                        {giftList.map((giftItem) => (
                                            <Fragment key={giftItem.promotionId}>
                                                {getGiftDisplayItems(giftItem).map((item) => (
                                                    <View key={item.key} className="activity-item">
                                                        <View className="activity-item-label">
                                                            {giftItem.data.rulesType === 1
                                                                ? t("实付满{0}元赠", { "0": item.minAmount })
                                                                : t("实付每满{0}元赠", { "0": item.minAmount })}
                                                        </View>
                                                        <View className="activity-product">
                                                            {item.desc ? <View className="activity-name">{item.desc}</View> : null}
                                                            {/* 旧 <scroll-view class="scroll-x" scroll-x="true"> → ScrollView 横向 */}
                                                            <ScrollView className="scroll-x" scrollX>
                                                                <View
                                                                    className="activity-product-item"
                                                                    onClick={() => {
                                                                        handleLink(item.productId);
                                                                    }}
                                                                >
                                                                    {/* 原 <tig-image :src="item.pic" class="gift-img"> → TigImage（className 透传改为外层包装） */}
                                                                    <View className="gift-img">
                                                                        <TigImage src={item.pic} />
                                                                    </View>
                                                                    <View className="gift-price">
                                                                        <FormatPrice
                                                                            showText={false}
                                                                            fontStyle={{ fontSize: "18rpx", fontWeight: "bold" }}
                                                                            isBottom={false}
                                                                            priceData={item.price}
                                                                        />
                                                                    </View>
                                                                </View>
                                                            </ScrollView>
                                                        </View>
                                                    </View>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </>
                                ) : null}
                            </View>
                        ) : null}
                        {couponList.length > 0 ? (
                            <View className="coupon-box">
                                <View className="public-title">{t("可领优惠券")}</View>
                                {couponList.map((item) => (
                                    <View key={item.couponId} className="coupon-item">
                                        <View className="left">
                                            <View className="col-1">
                                                <View className="title">{item.couponName}</View>
                                            </View>
                                            {item.couponDesc ? <View className="col-2">{item.couponDesc}</View> : null}
                                            {item.sendType === 1 ? (
                                                <View className={`col-3 ${!item.couponDesc ? "special-col" : ""}`}>
                                                    {t("有效期")}：{item.useEndDate}
                                                </View>
                                            ) : null}
                                            {item.sendType === 0 && item.delayDay > 0 ? (
                                                <View className={`col-3 ${!item.couponDesc ? "special-col" : ""}`}>
                                                    {/* 领券{{ item.delayDay }}天后生效，有效期{{ item.useDay }}天 */}
                                                    {isOverseas()
                                                        ? t("领券{0}天后生效，有效期{1}天", { "0": item.delayDay, "1": item.useDay })
                                                        : `领券${item.delayDay}天后生效，有效期${item.useDay}天`}
                                                </View>
                                            ) : null}
                                            {item.sendType === 0 && item.delayDay === 0 ? (
                                                <View className={`col-3 ${!item.couponDesc ? "special-col" : ""}`}>
                                                    {/* 领券当日起{{ item.useDay }}天内可用 */}
                                                    {isOverseas() ? t("领券当日起{0}天内可用", { "0": item.useDay }) : `领券当日起${item.useDay}天内可用`}
                                                </View>
                                            ) : null}
                                        </View>
                                        <View className="right">
                                            <View className="right-1">
                                                {item.couponType === 2 ? (
                                                    <>
                                                        <View className="zhekou"> {item.couponDiscount}</View>
                                                        <View className="zhe">{t("折")}</View>
                                                    </>
                                                ) : (
                                                    <FormatPrice
                                                        showText={false}
                                                        fontStyle={{ fontSize: "48rpx", lineHeight: "1", fontWeight: "400" }}
                                                        currencyStyle={{ alignSelf: "flex-end", fontSize: "28rpx" }}
                                                        priceData={item.couponMoney}
                                                    />
                                                )}
                                            </View>
                                            {!isCouponReceived(item.isReceive, item.limitNum, item.receiveNum) ? (
                                                <View className="right-2">
                                                    <View>
                                                        {/* 旧 <tig-button :custom-style="{ height: '55rpx' }" @click="getCoupon(item)"> → 按视觉重写（primary circle） */}
                                                        <View
                                                            className="coupon-claim-btn"
                                                            style={{
                                                                height: "55rpx",
                                                                borderRadius: "27.5rpx",
                                                                background: "var(--main-bg)",
                                                                color: "#fff",
                                                                fontSize: "22rpx",
                                                                padding: "0 25rpx",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center"
                                                            }}
                                                            onClick={() => {
                                                                void getCoupon(item);
                                                            }}
                                                        >
                                                            {couponStatus(item.isReceive!, item.limitNum, item.receiveNum)}
                                                        </View>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View className="already-received-box">
                                                    <View className="already-received-content">
                                                        <View
                                                            className={`already-received-text ${
                                                                couponStatus(item.isReceive!, item.limitNum, item.receiveNum).length > 3 ? "is-multiline" : ""
                                                            }`}
                                                        >
                                                            {couponStatus(item.isReceive!, item.limitNum, item.receiveNum)}
                                                        </View>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                        <View className="dotted-line" />
                                    </View>
                                ))}
                            </View>
                        ) : null}
                        {/* 旧 <tig-fixed-placeholder background-color="#fff"> → fixed 底栏（safe-bottom 由样式承接） */}
                        <View className="fixed-placeholder" style={{ background: "#fff" }}>
                            <View className="btn-box">
                                <View
                                    className="coupon-ensure-btn"
                                    style={{
                                        height: "80rpx",
                                        borderRadius: "40rpx",
                                        background: "var(--main-bg)",
                                        color: "#fff",
                                        fontSize: "28rpx"
                                    }}
                                    onClick={() => {
                                        setShowCoupon(false);
                                    }}
                                >
                                    {t("我知道了")}
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Popup>
    );
}
