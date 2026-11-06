import { Text, View } from "@tarojs/components";

import FormatPrice from "@/components/format-price/FormatPrice";
import { t } from "@/utils/i18n";

import "./PresaleCard.scss";

interface Props {
    /** 预售信息（订单详情 presaleInfo） */
    presaleInfo: any;
    /** 订单详情（orderInfo） */
    total: any;
}

/**
 * 预售订单流程卡片组件（订单详情页）
 * - 定金预售：定金 → 尾款 → 发货
 * - 全款预售：全款 → 发货
 *
 * 自旧 pages/user/order/src/presaleCard.vue 逐行移植；与结算页 src/pages/order/src/PresaleCard.tsx
 * 为两套不同实现（结算页版本字段/交互不同），此处保持订单详情页独立实现。
 */
export default function PresaleCard({ presaleInfo, total }: Props) {
    const orderStatus: number = total?.orderStatus ?? 0;

    const pendingShipNodeTitle = () => {
        if (total?.isPickup) return t("自提");
        if (Number(total?.shippingTypeId) === 3) return t("配送");
        return t("发货");
    };

    const completedShipNodeTitle = () => {
        if (total?.isPickup || Number(total?.shippingTypeId) === 3) return t("已备货");
        return t("已发货");
    };

    const shippingActionText = () => {
        if (total?.isPickup) return t("自提");
        if (Number(total?.shippingTypeId) === 3) return t("配送");
        return t("发货");
    };

    const fullPresaleStepTwoTitle = () => {
        if (orderStatus >= 2 && orderStatus !== 3) return completedShipNodeTitle();
        return pendingShipNodeTitle();
    };

    const fullPresaleStepTwoDate = () => {
        if (orderStatus >= 2 && orderStatus !== 3) {
            if (total?.shippingTime) return formatShippingDate(total.shippingTime);
            return "";
        }
        return deliverTimeText();
    };

    const paymentTimeText = () => {
        const info = presaleInfo;
        if (!info) return "";

        // 优先用后端文案（对齐跨境）
        const productPresale = info.productPresale || {};
        if (productPresale.finalPaymentStartTimeText) return productPresale.finalPaymentStartTimeText;

        if (Number(productPresale.finalPaymentType) === 1) {
            let str = productPresale.finalPaymentRelativeDays
                ? t("付定金{0}天后开始", { 0: productPresale.finalPaymentRelativeDays })
                : t("付定金后开始");
            const days = productPresale.finalPaymentDurationDays ? `${productPresale.finalPaymentDurationDays}${t("天")}` : "";
            const hours = productPresale.finalPaymentDurationHours ? `${productPresale.finalPaymentDurationHours}${t("小时")}` : "";
            if (days && hours) str += `, ${days}${hours}${t("结束")}`;
            return str;
        }
        return productPresale.finalPaymentStartTime ? `${productPresale.finalPaymentStartTime}${t("开始")}` : "";
    };

    const deliverTimeText = () => {
        const info = presaleInfo;
        if (!info) return "";

        const productPresale = info.productPresale || {};
        if (productPresale.deliveryTimeText) return productPresale.deliveryTimeText;

        if (Number(productPresale.deliveryType) === 1) {
            const days = productPresale.deliveryRelativeDays ? `${productPresale.deliveryRelativeDays}${t("天")}` : "";
            const hours = productPresale.deliveryRelativeHours ? `${productPresale.deliveryRelativeHours}${t("小时")}` : "";
            return `${Number(info.saleMode) === 1 ? t("付全款") : t("付尾款")}${days}${hours}${t("后")}${shippingActionText()}`;
        }
        return productPresale.deliveryDate ? `${productPresale.deliveryDate}${t("开始")}` : "";
    };

    const formatShippingDate = (dateStr: string) => {
        if (!dateStr) return "";
        const [datePart, timePart] = dateStr.split(" ");
        const [year, month, day] = datePart.split("-");
        return `${year}${t("年")}${month}${t("月")}${day}${t("日")}  ${timePart || ""}`;
    };

    const depositPresaleStepThreeTitle = () => {
        const st = total?.orderStatus ?? 0;
        if (st >= 2 && st !== 3 && presaleInfo?.presaleStatus === 2) return completedShipNodeTitle();
        return pendingShipNodeTitle();
    };

    const depositPresaleStepThreeDate = () => {
        const st = total?.orderStatus ?? 0;
        if (st >= 2 && st !== 3 && presaleInfo?.presaleStatus === 2) {
            if (total?.shippingTime) return formatShippingDate(total.shippingTime);
            return "";
        }
        return deliverTimeText();
    };

    return (
        <View className="presale-box">
            {/* 定金预售步骤 */}
            {presaleInfo?.saleMode === 2 ? (
                <View className="presale-flow">
                    <View className={`flow-item${presaleInfo?.presaleStatus === 0 ? " active" : ""}`}>
                        <View className={`flow-left${presaleInfo?.presaleStatus && presaleInfo?.presaleStatus > 0 ? " active" : ""}`}>
                            <View className="dot" />
                            <View className="line" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <View className="title-box">
                                    <Text className="title">{t("定金")}</Text>
                                    <View className="price">
                                        <FormatPrice priceData={presaleInfo?.depositAmount} />
                                    </View>
                                </View>
                                <Text className="title">{t("预售商品，定金不退")}</Text>
                            </View>
                        </View>
                    </View>
                    <View className={`flow-item${presaleInfo?.presaleStatus === 1 ? " active" : ""}`}>
                        <View className={`flow-left${presaleInfo?.presaleStatus && presaleInfo?.presaleStatus >= 2 ? " active" : ""}`}>
                            <View className="dot" />
                            <View className="line" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <View className="title-box">
                                    <Text className="title">{t("尾款")}</Text>
                                    <View className="price">
                                        <FormatPrice priceData={presaleInfo?.finalPaymentAmount} />
                                    </View>
                                </View>
                                <Text>{paymentTimeText()}</Text>
                            </View>
                        </View>
                    </View>
                    <View className={`flow-item${presaleInfo?.presaleStatus === 2 ? " active" : ""}`}>
                        <View className="flow-left">
                            <View className="dot" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <Text className="title">{depositPresaleStepThreeTitle()}</Text>
                                {depositPresaleStepThreeDate() ? (
                                    <Text className="text-desc">{depositPresaleStepThreeDate()}</Text>
                                ) : null}
                            </View>
                        </View>
                    </View>
                </View>
            ) : presaleInfo?.saleMode === 1 ? (
                /* 全款预售步骤 */
                <View className="presale-flow">
                    <View className={`flow-item${orderStatus === 0 ? " active" : ""}`}>
                        <View className={`flow-left${orderStatus !== undefined && orderStatus > 0 && orderStatus !== 3 ? " active" : ""}`}>
                            <View className="dot" />
                            <View className="line" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <Text className="title">{t("全款预售")}</Text>
                                <View className="price">
                                    <FormatPrice priceData={total.productAmount} />
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className={`flow-item${orderStatus !== undefined && orderStatus >= 1 && orderStatus !== 3 ? " active" : ""}`}>
                        <View className="flow-left">
                            <View className="dot" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <Text className="title">{fullPresaleStepTwoTitle()}</Text>
                                {fullPresaleStepTwoDate() ? <Text className="text-desc">{fullPresaleStepTwoDate()}</Text> : null}
                            </View>
                        </View>
                    </View>
                </View>
            ) : null}
        </View>
    );
}