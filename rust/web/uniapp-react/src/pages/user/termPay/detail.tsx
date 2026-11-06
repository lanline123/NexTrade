import { useEffect, useRef, useState } from "react";
import { Canvas, Image, Text, View } from "@tarojs/components";
import Taro, { usePageScroll } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage/index";
import Offline from "@/pages/order/src/Offline";
import { getUserCreditDetail } from "@/api/user/user";
import { orderPayInfoTerm } from "@/api/order/pay";
import { useThemeStore } from "@/store/theme";
import { useUserStore } from "@/store/user";
import type { OfflinePaymentList } from "@/types/order/pay";
import type { UserCreditDetailVO, UserCreditOrderItem } from "@/types/user/termPay";
import { staticResource } from "@/utils";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./detail.scss";

/**
 * 账期详情页（自旧 pages/user/termPay/detail.vue 移植）
 * - 信用额度环形图、账期/剩余天数
 * - 未结算/已结算订单列表
 * - 底部「查看结算账号」弹层（线下汇款信息）
 */
export default function TermPayDetail() {
    usePageGuards();

    const userInfo = useUserStore((s) => s.userInfo);
    const themeStyle = useThemeStore((s) => s.themeStyle);

    const [isLoading, setIsLoading] = useState(false);
    const [creditDetail, setCreditDetail] = useState<UserCreditDetailVO | null>(null);

    const [showRemittancePopup, setShowRemittancePopup] = useState(false);
    const showPopupRef = useRef(showRemittancePopup);
    showPopupRef.current = showRemittancePopup;
    const [offlinePaymentList, setOfflinePaymentList] = useState<OfflinePaymentList>({} as OfflinePaymentList);

    // 页面滚动锁定：弹窗打开时禁止外层列表滚动（仅本页生效）
    const currentScrollTop = useRef(0);
    const lockedScrollTop = useRef(0);
    const pageLockStyle: Record<string, string> | undefined = showRemittancePopup
        ? {
              position: "fixed",
              left: "0",
              right: "0",
              width: "100%",
              top: `-${lockedScrollTop.current}px`,
              height: "100vh",
              overflow: "hidden"
          }
        : undefined;

    /** tabs：未结算/已结算（展示用 value 字段，和 order/list.vue 保持一致） */
    const [currentIndex, setCurrentIndex] = useState(0);
    const [menuTypeList] = useState([
        { value: t("未结算"), status: 0 },
        { value: t("已结算"), status: 1 }
    ]);

    const showTermPay = (() => {
        if (creditDetail) return true;
        return !!userInfo?.creditPaymentInfo && Object.keys(userInfo?.creditPaymentInfo)?.length > 0;
    })();

    const currentOrders: UserCreditOrderItem[] = (() => {
        if (!creditDetail) return [];
        const status = menuTypeList[currentIndex]?.status ?? 0;
        return status === 0 ? creditDetail.pendingOrders || [] : creditDetail.settledOrders || [];
    })();

    const creditLimitText = creditDetail?.creditLimit ?? userInfo?.creditPaymentInfo?.creditLimit ?? "-";
    const availableAmountText = creditDetail?.availableAmount ?? userInfo?.creditPaymentInfo?.availableAmount ?? "-";
    const settlementDaysText = (() => {
        const days = creditDetail?.settlementDays;
        return typeof days === "number" ? `${days}${t("天")}` : days ? `${days}${t("天")}` : "-";
    })();
    const remainingDaysText = (() => {
        const days = creditDetail?.remainingDays;
        return typeof days === "number" ? `${days}${t("天")}` : days ? `${days}${t("天")}` : "-";
    })();

    const getSettlementStatusStyle = (order: UserCreditOrderItem) => {
        // 0-未结算 1-已结算 2-已取消 3-退款中；riskStatus=1(逾期) 标红
        if (order.riskStatus === 1) return { color: "#ee0a24" };
        return undefined;
    };

    const formatSkuValue = (val?: string) => {
        if (!val) return "";
        return val.split("|").join(" ");
    };

    const normalizeOfflinePaymentList = (cfg: any): OfflinePaymentList => {
        const source = cfg?.offlinePaymentList ?? cfg ?? {};
        return {
            thirdPartyPaymentTransfer: source?.thirdPartyPaymentTransfer ?? "",
            offlinePayBank: source?.offlinePayBank ?? "",
            offlinePayCompany: source?.offlinePayCompany ?? "",
            otherPaymentRemittance: source?.otherPaymentRemittance ?? ""
        };
    };

    const loadOfflinePaymentList = async () => {
        // 已经有内容就不重复拉取
        const hasAny =
            !!offlinePaymentList?.thirdPartyPaymentTransfer ||
            !!offlinePaymentList?.offlinePayBank ||
            !!offlinePaymentList?.offlinePayCompany ||
            !!offlinePaymentList?.otherPaymentRemittance;
        if (hasAny) return;

        try {
            const termResult = await orderPayInfoTerm();
            setOfflinePaymentList(normalizeOfflinePaymentList(termResult.offlinePaymentList));
        } catch {
            // 静默失败：仍然打开弹窗（内容可能为空）
            setOfflinePaymentList(normalizeOfflinePaymentList({}));
        }
    };

    const handleOpenRemittance = async () => {
        lockedScrollTop.current = currentScrollTop.current;
        setShowRemittancePopup(true);
        await loadOfflinePaymentList();
    };

    // H5：弹窗打开时锁定 body 滚动，避免外层列表滚动（仅本页生效）
    const popupWatchMounted = useRef(false);
    useEffect(() => {
        if (!popupWatchMounted.current) {
            popupWatchMounted.current = true;
            return;
        }
        const val = showRemittancePopup;
        if (process.env.TARO_ENV === "h5" && typeof document !== "undefined") {
            document.body.style.overflow = val ? "hidden" : "";
        }
        // 弹窗关闭后恢复页面滚动位置
        if (!val) {
            setTimeout(() => {
                void Taro.pageScrollTo({ scrollTop: lockedScrollTop.current, duration: 0 });
            }, 0);
        }
    }, [showRemittancePopup]);

    usePageScroll((e) => {
        // 仅在未锁定时记录 scrollTop（锁定后不更新，避免跳动）
        if (!showPopupRef.current) {
            currentScrollTop.current = e.scrollTop || 0;
        }
    });

    // 获取设备信息，用于计算实际像素
    const [systemInfo] = useState(() => Taro.getSystemInfoSync());
    const windowWidth = systemInfo.windowWidth || 375;

    // rpx 转 px 的转换比例（750rpx = 屏幕宽度）
    const rpxToPx = windowWidth / 750;

    // Canvas 尺寸（rpx）
    const canvasSizeRpx = 200;
    // Canvas 实际像素尺寸
    const canvasSizePx = Math.round(canvasSizeRpx * rpxToPx);

    // 获取主题色（从 themeStyle 中获取）
    const getGeneralColor = (name: string): string => {
        const generalColor = themeStyle[name];
        if (generalColor) {
            return generalColor;
        }
        return "#007aff";
    };

    // 绘制圆环图表
    const drawCircle = () => {
        const creditInfo = creditDetail || userInfo?.creditPaymentInfo;
        if (!creditInfo) return;

        // 延迟执行，确保 canvas 已渲染
        setTimeout(() => {
            // TODO(MIGRATION)：旧 uni.createCanvasContext 已改 Taro.createCanvasContext；Taro React 自定义组件内可能需要传实例，移动端需真机复核
            const ctx: any = Taro.createCanvasContext("creditChart");
            // 使用实际像素尺寸的一半作为中心点
            const centerX = canvasSizePx / 2; // 画布中心 X 坐标
            const centerY = canvasSizePx / 2; // 画布中心 Y 坐标
            const radius = 80 * rpxToPx; // 圆环半径（转换为实际像素）
            const lineWidth = 25 * rpxToPx; // 圆环宽度（转换为实际像素）

            // 获取主题色
            const generalColor = getGeneralColor("--general");
            // 获取背景色
            const mainBgColor = getGeneralColor("--primary-light-9");

            // 计算比例（百分比转小数）
            const creditLimit = Number((creditInfo as any).creditLimit) || 0;
            const usedAmount = Number((creditInfo as any).usedAmount) || 0;
            const availableAmount = Number((creditInfo as any).availableAmount) || 0;

            // 已使用比例（0-1之间）
            const usedPercent = creditLimit > 0 ? usedAmount / creditLimit : 0;
            // 剩余比例（0-1之间）
            const availablePercent = creditLimit > 0 ? availableAmount / creditLimit : 0;
            // 确保总和不超过 1
            const totalPercent = Math.min(usedPercent + availablePercent, 1);

            console.log("数据:", { creditLimit, usedAmount, availableAmount, usedPercent, availablePercent, totalPercent });

            // 起始角度（从顶部开始，12点钟方向）
            const startAngle = -Math.PI / 2;
            // 已使用角度（从顶部开始，顺时针）
            const usedAngle = startAngle + usedPercent * Math.PI * 2;

            // 绘制背景圆环（灰色，完整圆形）
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, false);
            ctx.setStrokeStyle(mainBgColor);
            ctx.setLineWidth(lineWidth);
            ctx.stroke();

            // 绘制已使用部分（使用主题色），从顶部开始
            if (usedPercent > 0) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, startAngle, usedAngle, false);
                ctx.setStrokeStyle(generalColor);
                ctx.setLineWidth(lineWidth);
                // ctx.setLineCap("round");
                ctx.stroke();
            }

            // 绘制到 canvas，false 表示清除之前的绘制
            ctx.draw(false, () => {
                // 绘制完成后再次确认绘制，确保显示
                setTimeout(() => {
                    ctx.draw(true);
                }, 50);
            });
        }, 300);
    };

    // 监听 creditPaymentInfo 变化，重新绘制（对应旧 watch，同时覆盖 onMounted 首次绘制）
    useEffect(() => {
        if (showTermPay) {
            const timer = setTimeout(() => drawCircle(), 0);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userInfo, creditDetail]);

    const fetchCreditDetail = async () => {
        setIsLoading(true);
        try {
            const detail = await getUserCreditDetail();
            setCreditDetail(detail);
            setTimeout(() => drawCircle(), 0);
        } catch (error: any) {
            Taro.showToast({
                title: error?.message || t("加载失败"),
                icon: "none"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const goOrderDetail = (orderId: string | number) => {
        if (orderId === undefined || orderId === null || orderId === "") return;
        void Taro.navigateTo({
            url: `/pages/user/order/info?id=${orderId}`
        });
    };

    // 旧 onLoad
    useEffect(() => {
        void fetchCreditDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View className="termDetail" style={pageLockStyle}>
            {/* TODO(MIGRATION)：旧 tig-layout 的 class="term-detail-layout" 无法透传（TigLayout 无 className prop），样式保留未挂载 */}
            {showTermPay && (
                <TigLayout title={t("账期详情")}>
                    <View className="header">
                        <View className="chart">
                            <Canvas
                                id="creditChart"
                                canvasId="creditChart"
                                className="chart-canvas"
                                width={String(canvasSizePx)}
                                height={String(canvasSizePx)}
                                style={{ width: `${canvasSizeRpx}rpx`, height: `${canvasSizeRpx}rpx` }}
                            />
                            <View className="chart-info">
                                <View className="chart-text creditLimit">
                                    {t("信用额度")}: {creditLimitText}
                                </View>
                                <View className="chart-text">
                                    {t("剩余额度")}: {availableAmountText}
                                </View>
                            </View>
                        </View>
                        <View className="termPayDays">
                            <View className="totalDays days">
                                <View className="text accountingPeriod">{t("账期")}</View>
                                <View className="num">{settlementDaysText}</View>
                            </View>
                            <View className="hasDays days">
                                <View className="text">{t("账期剩余")}</View>
                                <View className="num">{remainingDaysText}</View>
                            </View>
                        </View>
                    </View>

                    {/* 结算状态切换（未结算/已结算）：旧 up-tabs → 基础组件自绘 */}
                    <View className="term-menu badgecolor">
                        <View className="term-tabs">
                            {menuTypeList.map((item, index) => (
                                <View
                                    key={item.status}
                                    className={`term-tab${currentIndex === index ? " active" : ""}`}
                                    onClick={() => setCurrentIndex(index)}
                                >
                                    <Text className="term-tab-text">{item.value}</Text>
                                    {currentIndex === index && <View className="term-tab-line" />}
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* 订单列表（参考 user/order/list.vue） */}
                    <View className="term-order-list">
                        {currentOrders.map((order) => (
                            <View key={order.orderId}>
                                {order.items?.length ? (
                                    <View className="term-order-card" hoverClass="term-order-card--hover" hoverStayTime={150} onClick={() => goOrderDetail(order.orderId)}>
                                        <View className="term-order-card-header">
                                            <Text className="time">
                                                {t("下单时间")}：{order.orderTime}
                                            </Text>
                                            <Text className="status" style={getSettlementStatusStyle(order)}>
                                                {t(order.riskStatusText)}
                                            </Text>
                                        </View>
                                        <View className="term-order-card-goods">
                                            {order.items.map((good) => (
                                                <View key={good.productId} className="good-item">
                                                    <View className="good-img">
                                                        <TigImage src={pickPic(good)} />
                                                    </View>
                                                    <View className="good-info">
                                                        <View className="good-name">
                                                            <View className="line2">{t(good.productName)}</View>
                                                            <View className="goodPrice">
                                                                <FormatPrice
                                                                    fontStyle={{ color: "#1A1A1A", fontSize: "28rpx" }}
                                                                    decimalsStyle={{ fontSize: "20rpx" }}
                                                                    currencyStyle={{ fontSize: "20rpx" }}
                                                                    showText={false}
                                                                    isBottom={false}
                                                                    priceData={good.price}
                                                                />
                                                            </View>
                                                        </View>
                                                        <View className="good-qty">
                                                            {good.skuValue && <View className="sku-value">{formatSkuValue(good.skuValue)}</View>}
                                                            <View className="qty">x{good.quantity}</View>
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>

                                        <View className="term-order-card-footer">
                                            <View className="summary">
                                                {t("共")}
                                                {order.totalQuantity}
                                                {t("件商品")}
                                            </View>
                                            <View className="amount">
                                                {t("账期付款")}：
                                                <FormatPrice showText={false} isBottom={false} priceData={order.creditAmount} />
                                            </View>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        ))}

                        {!isLoading && currentOrders.length === 0 && (
                            <View className="term-order-empty">
                                <View className="empty-imgBox">
                                    <Image src={staticResource("termPay/emptyOrder.png")} style="width: 380rpx; height: 300rpx" />
                                    <View className="empty-text">{t("暂无订单")}</View>
                                </View>
                                {/* 旧注释保留：<emptyBox mode="list" background="#f5f5f5" :text="$t('暂无订单')" /> */}
                            </View>
                        )}
                    </View>

                    <View className="term-footer-placeholder">
                        <View className="term-footer">
                            <View className="term-footer-btn" onClick={() => void handleOpenRemittance()}>
                                {t("查看结算账号")}
                            </View>
                        </View>
                    </View>
                    <View className="term-footer-spacer" />
                </TigLayout>
            )}
            <TigLoadingPage modelValue={isLoading} />

            {/* 汇款方式弹窗（旧 tig-popup → NutUI Popup） */}
            <Popup
                visible={showRemittancePopup}
                position="bottom"
                round
                style={{ overflow: "hidden", borderTopLeftRadius: "20rpx", borderTopRightRadius: "20rpx" }}
                onClose={() => setShowRemittancePopup(false)}
            >
                <View className="remit-popup" onTouchMove={(e) => e.stopPropagation()}>
                    <View className="remit-popup__header">
                        <View className="remit-popup__title">{t("汇款方式")}</View>
                    </View>
                    <View className="remit-popup__content">
                        <Offline offlinePaymentList={offlinePaymentList} />
                    </View>
                </View>
            </Popup>
        </View>
    );
}