import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { usePageScroll, useRouter, useUnload } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigCountdown from "@/components/tig/tig-countdown/TigCountdown";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { aftersalesCancel, aftersalesViewRecord } from "@/api/user/afterSale";
import type { afterSaleInfoItem } from "@/types/user/afterSale";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./info.scss";

/** 截止毫秒时间戳；非法返回 0（兼容小程序/iOS 的 - 分隔符解析） */
const parseAutoAgreeEndTime = (raw: string) => {
    if (!raw) return 0;
    const ms = Date.parse(raw.replace(/-/g, "/"));
    return Number.isFinite(ms) ? ms : 0;
};

/**
 * 售后详情页（自旧 pages/user/afterSale/info.vue 移植）
 * - 展示售后状态流程、商品信息、退款进度
 * - status=3 显示拒绝原因
 * - status=4 显示去寄货入口（退货退款场景）
 * - 支持撤销申请、修改申请、查看协商记录
 */
export default function AfterSaleInfo() {
    usePageGuards();
    const router = useRouter();

    const idRef = useRef<number | undefined>(undefined);
    const [infoData, setInfoData] = useState<afterSaleInfoItem>({} as afterSaleInfoItem);
    const [quantityNum, setQuantityNum] = useState(0);
    const quantityNumRef = useRef(0);
    const [pageScrollTop, setPageScrollTop] = useState(0);
    const infoRef = useRef<afterSaleInfoItem>(infoData);
    infoRef.current = infoData;
    const [showTip, setShowTip] = useState(true);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fetchRef = useRef<() => Promise<void>>(async () => {});

    const stopCountdownWatch = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startCountdownWatch = () => {
        stopCountdownWatch();
        const data: any = infoRef.current || {};
        const endMs = parseAutoAgreeEndTime(String(data?.autoAgreeEndTime || ""));
        const processing = [0, 1, 21].includes(Number(data?.status ?? -1));
        if (!(processing && endMs > Date.now())) return;
        timerRef.current = setInterval(() => {
            const currentMs = parseAutoAgreeEndTime(String((infoRef.current as any)?.autoAgreeEndTime || ""));
            if (currentMs && currentMs - Date.now() <= 0) {
                stopCountdownWatch();
                void fetchRef.current();
            }
        }, 1000);
    };

    const navbarBackground = (() => {
        const opacity = Math.min(Math.max(pageScrollTop / 80, 0), 1);
        return `rgba(255, 255, 255, ${opacity})`;
    })();

    // ============ 顶部状态头（标题 + 副行/倒计时） ============
    /** 自动同意退款截止时间字符串（后端字段，未返回时为空，倒计时不渲染） */
    const autoAgreeEndTime = String((infoData as any)?.autoAgreeEndTime || "");
    /** 处理中：tigshop 售后 status ∈ {0,1,21}（待处理/待商家/待供应商审核） */
    const isProcessing = [0, 1, 21].includes(Number((infoData as any)?.status ?? -1));
    /** 是否展示「自动同意退款」倒计时（处理中 + 有合法的未来截止时间） */
    const showAutoAgreeCountdown = isProcessing && parseAutoAgreeEndTime(autoAgreeEndTime) > Date.now();
    /** 顶部副行文案（倒计时分支由模板条件接管，此处返回空） */
    const statusSubText = (() => {
        if (showAutoAgreeCountdown) return "";
        const desc = String((infoData as any)?.statusDesc || "").trim();
        if (desc) return desc;
        const status = Number((infoData as any)?.status ?? -1);
        if ([0, 1, 21].includes(status)) return t("您的售后申请正在处理，请耐心等待");
        if ([2, 4, 5, 22].includes(status)) return t("您的退款申请已提交，请耐心等待财务处理");
        if (status === 6) return t("您的退款申请已处理完成，款项将按原支付路径退回");
        return "";
    })();

    /**
     * 预约上门订单判断（用于将“上门服务费”合并到单品回显价格中）
     */
    const isReserveOrder = (() => {
        const order: any = (infoData as any)?.orders || {};
        const orderType = Number(order?.orderType ?? 0);
        const isReservationHome = Boolean(order?.isReservationHome);
        return isReservationHome || orderType === 9 || orderType === 10;
    })();

    /**
     * 上门服务费金额（项目内其它页面以 shippingFee 作为上门服务费字段）
     */
    const visitFeeAmount = Number((infoData as any)?.orders?.shippingFee ?? 0);

    /**
     * 获取商品显示价格
     * @param item 商品信息
     * @returns 商品显示价格（商品价格 + 附加价 + 上门服务费分摊单价）
     */
    const getDisplayPrice = (item: any) => {
        const orderItems = infoData?.orders?.items || [];
        const matched = orderItems.find((orderItem: any) => {
            return (
                orderItem?.itemId === item?.orderItemId ||
                orderItem?.itemId === item?.itemId ||
                orderItem?.orderItemId === item?.orderItemId ||
                orderItem?.skuId === item?.skuId
            );
        });
        const rawExtraSkuData = matched?.extraSkuData ?? item?.extraSkuData ?? [];
        let extraSkuData = rawExtraSkuData;
        if (typeof rawExtraSkuData === "string") {
            try {
                extraSkuData = JSON.parse(rawExtraSkuData);
            } catch {
                extraSkuData = [];
            }
        }
        if (!Array.isArray(extraSkuData)) {
            extraSkuData = [];
        }
        const extraPrice = extraSkuData.reduce((sum: number, extra: any) => {
            const raw = extra?.totalAttrPrice ?? extra?.attrPrice ?? 0;
            return sum + Number(raw || 0);
        }, 0);

        // 上门服务费为“订单级”费用：按商品数量均摊到单品单价
        let visitFeeSharePerUnit = 0;
        if (isReserveOrder && visitFeeAmount > 0) {
            const list: any[] = (infoData as any)?.aftersalesItems || [];
            const totalQty = list.reduce((sum, it) => {
                const qty = Number(it?.quantity ?? it?.number ?? 0);
                return sum + (Number.isFinite(qty) ? qty : 0);
            }, 0);
            if (totalQty > 0) {
                visitFeeSharePerUnit = visitFeeAmount / totalQty;
            }
        }

        return Number(item?.price || 0) + extraPrice + visitFeeSharePerUnit;
    };

    const getAftersalesViewRecord = async () => {
        if (!idRef.current) return;
        try {
            const result = await aftersalesViewRecord(idRef.current);
            setInfoData(result);
            infoRef.current = result;
            // 旧实现 quantityNum 为累加 ref（未在每次拉取前清零），保持一致
            result.aftersalesItems.forEach((item: any) => {
                quantityNumRef.current += item.number;
            });
            setQuantityNum(quantityNumRef.current);
            startCountdownWatch();
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };
    fetchRef.current = getAftersalesViewRecord;

    const handleRevocation = () => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认要撤销申请吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        await aftersalesCancel({ aftersaleId: infoData.aftersaleId });
                        Taro.showToast({
                            title: t("撤销成功")
                        });
                        void Taro.redirectTo({
                            url: "/pages/user/afterSale/list"
                        });
                    } catch (error) {
                        console.error(error);
                    }
                }
            }
        });
    };

    const handleEdit = async () => {
        try {
            if (infoData.aftersalesItems.length === 1) {
                void Taro.redirectTo({
                    url: `/pages/user/afterSale/edit?aftersaleId=${infoData.aftersaleId}&itemId=${infoData.aftersalesItems[0].orderItemId}`
                });
            } else {
                void Taro.redirectTo({
                    url: `/pages/user/afterSale/edit?aftersaleId=${infoData.aftersaleId}`
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const showReturngoodstip = infoData.returnGoodsTip && showTip;

    const handleProduct = (id: number) => {
        void Taro.navigateTo({
            url: `/pages/product/index?id=${id}`
        });
    };

    const handleNegotiate = () => {
        void Taro.navigateTo({
            url: "/pages/user/afterSale/negotiate?id=" + infoData.aftersaleId
        });
    };
    const handleShipments = () => {
        void Taro.navigateTo({
            url: `/pages/user/afterSale/shipments?id=${infoData.aftersaleId}&returnAddress=${infoData.returnAddress}`
        });
    };

    // 旧 onLoad：取路由 id 并拉取详情
    useEffect(() => {
        const id = Number(router.params?.id);
        if (id) {
            idRef.current = id;
            void fetchRef.current();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow 注册 / onUnload 注销全局刷新事件
    useEffect(() => {
        const handler = (data: number) => {
            idRef.current = data;
            void fetchRef.current();
        };
        Taro.eventCenter.on("refreshInfo", handler);
        return () => {
            Taro.eventCenter.off("refreshInfo", handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    usePageScroll(({ scrollTop }) => {
        setPageScrollTop(scrollTop);
    });

    useUnload(() => {
        stopCountdownWatch();
    });

    useEffect(() => {
        return () => {
            stopCountdownWatch();
        };
    }, []);

    return (
        <View className="after-sale-info">
            <TigLayout title={t("售后详情")} background={navbarBackground} overflow={false}>
                {Object.keys(infoData).length > 0 && (
                    <>
                        {showReturngoodstip && (
                            <View className="returngoodstip-box">
                                <View className="returngoodstip-bg" />
                                <View className="returngoodstip-content">
                                    <View className="iconfont-h5 icon-tongzhi" />
                                    <View className="returngoodstip-text line1">{infoData.returnGoodsTip}</View>
                                    <View className="iconfont-h5 icon-chacha" onClick={() => setShowTip(false)} />
                                </View>
                            </View>
                        )}

                        <View className="after-sal-info-header aftersale-header-enZkeDIyODI">
                            <View className="status-title">{infoData.statusName}</View>
                            {(showAutoAgreeCountdown || statusSubText) && (
                                <View className="status-sub">
                                    {showAutoAgreeCountdown ? (
                                        <>
                                            {t("订单将在")}
                                            <View className="status-countdown">
                                                <TigCountdown endTime={autoAgreeEndTime} fontSize={13} color="#cc0c1c" splitorColor="#cc0c1c" />
                                            </View>
                                            {t("后自动同意您的退款申请")}
                                        </>
                                    ) : (
                                        <>{statusSubText}</>
                                    )}
                                </View>
                            )}
                        </View>
                        {infoData.status === 3 && (
                            <View className="refuse-reply">
                                <View className="refuse-reply-title"> {t("拒绝原因")}: </View>
                                <View className="refuse-reply-content line1">{infoData.reply}</View>
                            </View>
                        )}
                        <View className="negotiate" onClick={handleNegotiate}>
                            <View className="negotiate-text"> {t("查看协商记录")} </View>
                            <View className="negotiate-icon">
                                <Text className="iconfont-h5 icon-gengduo1" style="font-size: 24rpx; color: #999" />
                            </View>
                        </View>
                        {infoData.status === 4 && (
                            <View className="negotiate" onClick={handleShipments}>
                                <View className="negotiate-text"> {t("去寄货")} </View>
                                <View className="negotiate-icon">
                                    <Text className="iconfont-h5 icon-gengduo1" style="font-size: 24rpx; color: #999" />
                                </View>
                            </View>
                        )}

                        <View className="info-content">
                            <View className="info-content-title"> {t("售后信息")} </View>
                            <View className="info-content-product">
                                {infoData.aftersalesItems.map((item: any) => (
                                    <View
                                        key={item.aftersalesItemId}
                                        className="info-content-product-item"
                                        onClick={() => handleProduct(item.productId)}
                                    >
                                        <View className="product-item-left">
                                            <TigImage src={pickPic(item)} />
                                        </View>
                                        <View className="product-item-right">
                                            <View className="product-item-name line2">{item.productName}</View>
                                            <View className="right-price">
                                                <View className="right-price-pricenum">
                                                    <FormatPrice
                                                        showText={false}
                                                        decimalsStyle={{ fontSize: "23rpx", fontWeight: "bold" }}
                                                        currencyStyle={{ fontSize: "21rpx", fontWeight: "bold" }}
                                                        priceData={getDisplayPrice(item)}
                                                    />
                                                </View>
                                                <View className="right-price-quantity">x {item.number}</View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                            <View className="refund-info">
                                {Number(infoData.refundAmount) > 0 && (
                                    <View className="refund-info-item">
                                        <View className="label">{t("退款金额")}：</View>
                                        <View className="value price">
                                            <FormatPrice base showText={false} isBottom={false} priceData={infoData.refundAmount} />
                                        </View>
                                    </View>
                                )}

                                <View className="refund-info-item">
                                    <View className="label">{t("售后类型")}：</View>
                                    <View className="value">{infoData.aftersalesTypeName}</View>
                                </View>
                                <View className="refund-info-item">
                                    <View className="label">{t("售后原因")}：</View>
                                    <View className="value">{infoData.aftersaleReason}</View>
                                </View>
                            </View>
                            <View className="after-sale">
                                <View className="after-sale-item">
                                    <View className="label">{t("售后编号")}：</View>
                                    <View className="value">{infoData.aftersalesSn}</View>
                                </View>
                                <View className="after-sale-item">
                                    <View className="label">{t("申请时间")}：</View>
                                    <View className="value">{infoData.addTime}</View>
                                </View>
                                <View className="after-sale-item">
                                    <View className="label">{t("退货数量")}：</View>
                                    <View className="value">{quantityNum}</View>
                                </View>
                            </View>
                        </View>
                        {infoData.logisticsName && infoData.trackingNo && (
                            <View className="info-content">
                                <View className="info-content-title"> {t("退货信息")} </View>
                                <View className="after-sale">
                                    <View className="after-sale-item">
                                        <View className="label">{t("快递公司")}：</View>
                                        <View className="value">{infoData.logisticsName}</View>
                                    </View>
                                    <View className="after-sale-item">
                                        <View className="label">{t("快递单号")}：</View>
                                        <View className="value">{infoData.trackingNo}</View>
                                    </View>
                                </View>
                            </View>
                        )}
                        {infoData.refund && (
                            <View className="info-content">
                                {/* refundStatus: 0 待处理 1:处理中 2：已处理  3:已取消 */}
                                <View className="info-content-title"> {t("退款进度")} </View>
                                <View className="after-sale">
                                    {infoData.refund.onlineBalance > 0 && (
                                        <View className="after-sale-item">
                                            <View className="label">{t("线上退款")}：</View>
                                            <View className="value">
                                                <FormatPrice base showText={false} isBottom={false} priceData={infoData.refund.onlineBalance} />
                                            </View>
                                            <View className="after-sale-status">{infoData.refund.isOnline === 2 ? t("退款成功") : t("退款中")}</View>
                                        </View>
                                    )}
                                    {infoData.refund.offlineBalance > 0 && (
                                        <View className="after-sale-item">
                                            <View className="label">{t("线下退款")}：</View>
                                            <View className="value">
                                                <FormatPrice base showText={false} isBottom={false} priceData={infoData.refund.offlineBalance} />
                                            </View>
                                            <View className="after-sale-status">{infoData.refund.isOnline === 2 ? t("退款成功") : t("退款中")}</View>
                                        </View>
                                    )}
                                    {infoData.refund.refundBalance > 0 && (
                                        <View className="after-sale-item">
                                            <View className="label">{t("余额退款")}：</View>
                                            <View className="value">
                                                <FormatPrice base showText={false} isBottom={false} priceData={infoData.refund.refundBalance} />
                                            </View>
                                            <View className="after-sale-status">{infoData.refund.isOnline === 2 ? t("退款成功") : t("退款中")}</View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {infoData.canCancel && (
                            <>
                                <View className="after-sale-btn-fixed">
                                    <View className="after-sale-btn">
                                        <View className="after-sale-btn-box">
                                            <View className="btn btn--plain" onClick={handleRevocation}>
                                                {t("撤销申请")}
                                            </View>
                                            <View className="btn btn--plain" onClick={() => void handleEdit()}>
                                                {" "}
                                                {t("修改申请")}{" "}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                                <View className="after-sale-btn-placeholder" />
                            </>
                        )}
                    </>
                )}
            </TigLayout>
        </View>
    );
}