import { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useReachBottom, useRouter } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import FormatPrice from "@/components/format-price/FormatPrice";
import { addCoupon, getCouponList, getMyCouponList } from "@/api/coupon/coupon";
import type { CouponData, CouponFilterParams, CouponFilterResult } from "@/types/coupon/coupon";
import { useConfigStore } from "@/store/config";
import { isOverseas, staticResource } from "@/utils";
import { setPageMeta } from "@/utils/seo";
import { t } from "@/utils/i18n";

import Tag from "./src/Tag";

import "./index.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 优惠券中心页（自旧 pages/coupon/index.vue 移植）
 * - 展示可领取和我的优惠券列表
 * - 支持一键领取优惠券
 * - Tab 切换领券中心/我的优惠券（pageType）
 */
export default function CouponIndex() {
    usePageGuards();
    const router = useRouter();
    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    const options = (router.params || {}) as Record<string, any>;
    // 旧 onLoad：type 决定列表接口，shopId 决定店铺优惠券标题（shopId 分支后置，会覆盖 type 标题）
    const pageType = Number(options.type) || 1;
    const navbarTitle = (() => {
        // 旧 onLoad 中 shopId 分支在 type 分支之后执行，会覆盖「我的优惠券」
        if (options.shopId) return t("店铺优惠券");
        if (Number(options.type) === 2) return "我的优惠券";
        return t("优惠券");
    })();

    // 旧 filterParams 为 reactive 对象并被原地改写分页字段，这里用 ref 保持同一语义
    const filterParamsRef = useRef<CouponFilterParams>({
        page: 1,
        size: 10,
        shopId: options.shopId ? Number(options.shopId) : undefined
    });
    const totalRef = useRef(0);

    const [couponList, setCouponList] = useState<CouponFilterResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingSet, setClaimingSet] = useState<Set<number>>(new Set());
    const [showRulePopup, setShowRulePopup] = useState(false);
    const [currentCouponDesc, setCurrentCouponDesc] = useState("");

    // 对应旧 onMounted（#ifdef H5）
    useEffect(() => {
        setPageMeta({
            title: `${t("优惠券中心")} - ${shopTitle}`,
            description: `${t("领取")}${shopTitle}${t("优惠券")}`
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopTitle]);

    const __getCouponList = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            let result = {} as CouponData;
            if (pageType === 1) {
                result = await getCouponList(filterParamsRef.current);
            } else {
                result = await getMyCouponList(filterParamsRef.current);
            }
            setCouponList((prev) => [...prev, ...result.records]);
            totalRef.current = result.total;
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
            setLoading(false);
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
                return "马上领";
            } else if (receiveNum >= limitNum) {
                return "已领取";
            } else {
                return "再次领取";
            }
        }
    };

    const handleReceiveCoupon = async (item: CouponFilterResult) => {
        if (claimingSet.has(item.couponId)) return;
        if (couponStatus(item.isReceive, item.limitNum, item.receiveNum) === "已领取") {
            Taro.showToast({
                title: t("已领取"),
                icon: "none",
                duration: 1500
            });
            return;
        }

        setClaimingSet((prev) => {
            const next = new Set(prev);
            next.add(item.couponId);
            return next;
        });
        try {
            await addCoupon({ couponId: item.couponId });
            // 旧实现直接改 item.isReceive / item.receiveNum（Vue 响应式可追踪），React 需不可变更新
            setCouponList((prev) =>
                prev.map((it) =>
                    it.couponId === item.couponId
                        ? { ...it, isReceive: 1, receiveNum: (Number(it.receiveNum) || 0) + 1 }
                        : it
                )
            );
            Taro.showToast({
                title: t("领取成功"),
                duration: 1500
            });
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1500
            });
        } finally {
            setClaimingSet((prev) => {
                const next = new Set(prev);
                next.delete(item.couponId);
                return next;
            });
        }
    };

    const handleReceiveCouponClick = (item: CouponFilterResult) => {
        // 旧 u-button disabled 时点击不触发事件，这里保持同样语义
        if (
            claimingSet.has(item.couponId) ||
            couponStatus(item.isReceive, item.limitNum, item.receiveNum) === "已领取"
        ) {
            return;
        }
        void handleReceiveCoupon(item);
    };

    const toPages = (item: any) => {
        const couponInfo = {
            couponId: item.couponId,
            couponName: t(item.couponName ?? "")
        };
        Taro.navigateTo({
            url: "/pages/search/result?couponInfo=" + encodeURIComponent(JSON.stringify(couponInfo))
        });
    };

    /** 打开使用规则弹窗 */
    const handleShowRule = (item: CouponFilterResult) => {
        setCurrentCouponDesc(item.couponDesc ?? "");
        setShowRulePopup(true);
    };

    /** 是否存在有效期相关文案（决定「规则」链接是否左对齐） */
    const hasValidityText = (item: CouponFilterResult) => {
        if (item.sendType === 1) return !!item.useEndDate;
        if (item.sendType === 0) return true;
        return false;
    };

    // 对应旧 onShow
    useDidShow(() => {
        filterParamsRef.current.page = 1;
        setCouponList([]);
        void __getCouponList();
    });

    // 对应旧 onReachBottom
    useReachBottom(() => {
        if (filterParamsRef.current.page < Math.ceil(totalRef.current / filterParamsRef.current.size)) {
            filterParamsRef.current.page++;
            void __getCouponList();
        }
    });

    const renderCouponMoney = (item: CouponFilterResult) => {
        if (item.couponType === 2) {
            return (
                <>
                    <View className="zhekou"> {item.couponDiscount}</View>
                    <View className="zhe">{t("折")}</View>
                </>
            );
        }
        return (
            <FormatPrice
                showText={false}
                currencyStyle={{
                    justifyContent: "flex-end",
                    fontSize: "24rpx",
                    paddingBottom: "8rpx"
                }}
                isBottom={false}
                fontStyle={{ fontSize: "48rpx" }}
                priceData={item.couponMoney}
            />
        );
    };

    return (
        <View className="coupon-index-page">
            <TigLayout title={navbarTitle}>
                {couponList && couponList.length ? (
                    <View className="tmcscoupon-list">
                        {pageType == 1 && (
                            <View className="coupon-box">
                                {couponList.map((item, index) => (
                                    <View className="coupon-item" key={`${item.couponId}-${index}`}>
                                        <View className="left">
                                            <View className="col-1">
                                                <View className="title line2">{item.couponName}</View>
                                            </View>
                                            {hasValidityText(item) && (
                                                <View className="col-3">
                                                    {item.sendType === 1 && (
                                                        <Text>
                                                            {t("有效期")}：{item.useEndDate}
                                                        </Text>
                                                    )}
                                                    {item.sendType === 0 && item.delayDay > 0 && (
                                                        <Text>
                                                            {isOverseas()
                                                                ? t("领券{0}天后生效，有效期{1}天", {
                                                                      0: item.delayDay,
                                                                      1: item.useDay
                                                                  })
                                                                : `领券${item.delayDay}天后生效，有效期${item.useDay}天`}
                                                        </Text>
                                                    )}
                                                    {item.sendType === 0 && item.delayDay === 0 && (
                                                        <Text>
                                                            {isOverseas()
                                                                ? t("领券当日起{0}天内可用", { 0: item.useDay })
                                                                : `领券当日起${item.useDay}天内可用`}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            {item.couponDesc && (
                                                <View className="col-rule" onClick={() => handleShowRule(item)}>
                                                    <Text>{t("规则")}</Text>
                                                    <Text className="iconfont-h5 icon-youjiantou" />
                                                </View>
                                            )}
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
                                                        currencyStyle={{
                                                            justifyContent: "flex-end",
                                                            fontSize: "24rpx",
                                                            paddingBottom: "8rpx"
                                                        }}
                                                        isBottom={false}
                                                        fontStyle={{ fontSize: "48rpx" }}
                                                        priceData={item.couponMoney}
                                                    />
                                                )}
                                            </View>
                                            <View className="right-2">
                                                <View>
                                                    {/* TODO(MIGRATION)：通用 tig-button（uview up-button）未移植，暂以等价主题实底 View 替代 */}
                                                    <View
                                                        className={`coupon-receive-btn ${
                                                            claimingSet.has(item.couponId) ||
                                                            couponStatus(item.isReceive, item.limitNum, item.receiveNum) === "已领取"
                                                                ? "coupon-receive-btn--disabled"
                                                                : ""
                                                        }`}
                                                        onClick={() => handleReceiveCouponClick(item)}
                                                    >
                                                        {t(couponStatus(item.isReceive, item.limitNum, item.receiveNum))}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                        <View className="dotted-line" />
                                    </View>
                                ))}
                            </View>
                        )}

                        {pageType == 2 && (
                            <View className="coupon-box">
                                {couponList.map((item, index) => (
                                    <View
                                        key={`${item.couponId}-${index}`}
                                        className={`coupon-item ${
                                            item.status != 1 && item.status != 2 && item.status != 3
                                                ? "grayScaleDiv"
                                                : ""
                                        } ${item.status === 5 ? "pastDue" : ""} ${
                                            item.status === 4 ? "haveBeenUsed" : ""
                                        } ${item.status === 3 ? "comingIntoEffect" : ""}`}
                                    >
                                        {item.status != 1 && item.status != 2 && item.status != 3 && (
                                            <View className="tag-box">
                                                {item.status === 5 ? (
                                                    <Tag />
                                                ) : (
                                                    <Tag>{item.status === 3 ? t("即将生效") : t("已使用")}</Tag>
                                                )}
                                            </View>
                                        )}

                                        <View className="left">
                                            <View className="col-1">
                                                <View className="title line2">{t(item.couponName)}</View>
                                            </View>
                                            {item.endDate && (
                                                <View className="col-3">
                                                    {" "}
                                                    {t("有效期")}：{item.endDate}{" "}
                                                </View>
                                            )}
                                            {item.couponDesc && (
                                                <View className="col-rule" onClick={() => handleShowRule(item)}>
                                                    <Text>{t("规则")}</Text>
                                                    <Text className="iconfont-h5 icon-youjiantou" />
                                                </View>
                                            )}
                                        </View>
                                        <View className="right">
                                            <View className="right-1">{renderCouponMoney(item)}</View>
                                            <View className="right-2">
                                                <View>
                                                    {(item.status === 1 || item.status === 2) && (
                                                        <View className="coupon-receive-btn" onClick={() => toPages(item)}>
                                                            {t("立即使用")}
                                                        </View>
                                                    )}
                                                    {item.status === 3 && (
                                                        <View className="coupon-receive-btn coupon-receive-btn--disabled">{t("即将生效")}</View>
                                                    )}
                                                    {item.status === 4 && (
                                                        <View className="coupon-receive-btn coupon-receive-btn--disabled">{t("已使用")}</View>
                                                    )}
                                                    {item.status === 5 && (
                                                        <View className="coupon-receive-btn coupon-receive-btn--disabled">{t("已过期")}</View>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                        <View className="dotted-line" />
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ) : null}
                {!loading && couponList && couponList.length === 0 && (
                    <View className="empty-box">
                        <View className="pictrue">
                            <Image lazyLoad src={staticResource("common/data_empty.png")} />
                        </View>
                        <View className="txt">{t("暂无优惠券！")}</View>
                    </View>
                )}
            </TigLayout>

            <Popup
                visible={showRulePopup}
                position="center"
                round
                closeable={false}
                closeOnOverlayClick={false}
                zIndex={999}
                style={{ backgroundColor: "#fff" }}
                onClose={() => setShowRulePopup(false)}
            >
                <View className="rule-popup">
                    <View className="rule-popup-title">{t("使用规则")}</View>
                    <View className="rule-popup-content">{t(currentCouponDesc)}</View>
                    <View className="rule-popup-btn">
                        {/* TODO(MIGRATION)：通用 tig-button2 未移植，暂以等价主题实底 View 替代 */}
                        <View
                            className="theme-btn"
                            style={{
                                width: "100%",
                                height: "88rpx",
                                borderRadius: "50rpx",
                                fontSize: "30rpx",
                                fontWeight: "bold"
                            }}
                            onClick={() => setShowRulePopup(false)}
                        >
                            {t("我知道了")}
                        </View>
                    </View>
                </View>
            </Popup>
        </View>
    );
}