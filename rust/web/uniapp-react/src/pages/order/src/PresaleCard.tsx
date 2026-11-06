import { useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { ScrollView, Text, View } from "@tarojs/components";

import FormatPrice from "@/components/format-price/FormatPrice";
import { t } from "@/utils/i18n";

import "./PresaleCard.scss";

interface Props {
    /** 预售信息 */
    presaleInfo?: any;
    /** 结算金额汇总 */
    total?: any;
    /** 配送方式 */
    deliveryType?: number;
}

/**
 * 预售商品流程展示组件（结算页）（自旧 pages/order/src/presaleCard.vue 移植）
 * - 全款预售：付款 → 发货
 * - 定金预售：付定金 → 付尾款 → 发货
 * - 旧 tig-popup → NutUI Popup；旧 format-price → FormatPrice（className 由外层 View 承载）
 */
export default function PresaleCard({ presaleInfo, total, deliveryType }: Props) {
    const [show, setShow] = useState(false);

    // 获取订单状态（结算页一般为 0）
    const orderStatus: number = total?.orderStatus ?? 0;

    const formatShippingDate = (dateStr: string) => {
        if (!dateStr) return "";
        const [datePart, timePart] = dateStr.split(" ");
        const [year, month, day] = datePart.split("-");
        return `${year}${t("年")}${month}${t("月")}${day}${t("日")}  ${timePart || ""}`;
    };

    const pendingShipNodeTitle = () => {
        if (deliveryType === 2) return t("自提");
        if (deliveryType === 3) return t("配送");
        return t("发货");
    };

    const completedShipNodeTitle = () => {
        if (deliveryType === 2 || deliveryType === 3) return t("已备货");
        return t("已发货");
    };

    const shippingActionText = () => {
        if (deliveryType === 2) return t("自提");
        if (deliveryType === 3) return t("配送");
        return t("发货");
    };

    // 全款预售步骤二标题
    const fullPresaleStepTwoTitle = () => {
        if (orderStatus >= 2 && orderStatus !== 3) return completedShipNodeTitle();
        return pendingShipNodeTitle();
    };

    // 全款预售步骤二日期
    const fullPresaleStepTwoDate = () => {
        if (orderStatus >= 2 && orderStatus !== 3) {
            if (total?.shippingTime) return formatShippingDate(total.shippingTime);
            return "";
        }
        return deliverTimeText();
    };

    // 定金预售步骤三标题
    const depositPresaleStepThreeTitle = () => {
        const st = total?.orderStatus ?? 0;
        if (st >= 2 && st !== 3 && presaleInfo?.presaleStatus === 2) return completedShipNodeTitle();
        return pendingShipNodeTitle();
    };

    // 定金预售步骤三日期
    const depositPresaleStepThreeDate = () => {
        const st = total?.orderStatus ?? 0;
        if (st >= 2 && st !== 3 && presaleInfo?.presaleStatus === 2) {
            if (total?.shippingTime) return formatShippingDate(total.shippingTime);
            return "";
        }
        return deliverTimeText();
    };

    const paymentTimeText = () => {
        const info = presaleInfo;
        if (!info) return "";

        if (Number(info.finalPaymentType) === 1) {
            return info.finalPaymentRelativeDays ? t("付定金{0}天后开始", { 0: info.finalPaymentRelativeDays }) : t("付定金后开始");
        }
        return info.finalPaymentStartTime ? `${info.finalPaymentStartTime}${t("开始")}` : "";
    };

    const deliverTimeText = () => {
        const info = presaleInfo;
        if (!info) return "";

        if (Number(info.deliveryType) === 1) {
            const days = info.deliveryRelativeDays ? `${info.deliveryRelativeDays}${t("天")}` : "";
            const hours = info.deliveryRelativeHours ? `${info.deliveryRelativeHours}${t("小时")}` : "";
            return `${Number(info.saleMode) === 1 ? t("付全款") : t("付尾款")}${days}${hours}${t("后")}${shippingActionText()}`;
        }
        return info.deliveryDate ? `${info.deliveryDate}${t("开始")}` : "";
    };

    const handleShowPopup = () => {
        setShow(true);
    };

    return (
        <View className="presale-box">
            {/* 全款预售步骤 */}
            {presaleInfo?.saleMode === 1 ? (
                <View className="presale-flow">
                    <View className={`flow-item${orderStatus === 0 ? " active" : ""}`}>
                        <View className={`flow-left${orderStatus > 0 && orderStatus !== 3 ? " active" : ""}`}>
                            <View className="dot" />
                            <View className="line" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <Text className="title">{t("全款预售")}</Text>
                                <View className="price">
                                    <FormatPrice priceData={total?.productAmount} />
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className={`flow-item${orderStatus >= 1 && orderStatus !== 3 ? " active" : ""}`}>
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
            ) : (
                // 定金预售步骤
                <View className="presale-flow">
                    <View className="flow-item active">
                        <View className="flow-left">
                            <View className="dot" />
                            <View className="line" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <View className="title-box">
                                    <Text className="title">{t("定金(预售商品，定金不退)")}</Text>
                                    <View className="rule-box" onClick={handleShowPopup}>
                                        <Text className="split">|</Text>
                                        <Text className="rule">{t("规则")}</Text>
                                    </View>
                                </View>
                                <View className="price">
                                    <FormatPrice priceData={total?.depositAmount} />
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className="flow-item">
                        <View className="flow-left">
                            <View className="dot" />
                            <View className="line" />
                        </View>
                        <View className="flow-right">
                            <View className="flow-header">
                                <Text className="title">
                                    {t("尾款")}({paymentTimeText()})
                                </Text>
                                <View className="price">
                                    <FormatPrice priceData={total?.finalPaymentAmount} />
                                </View>
                            </View>
                            <View className="desc">{t("如有运费、赠品、优惠等将在尾款结算")}</View>
                        </View>
                    </View>
                    <View className="flow-item">
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
            )}

            {/* 旧 tig-popup（默认 bottom、白底）→ NutUI Popup */}
            <Popup visible={show} onClose={() => setShow(false)} style={{ backgroundColor: "#fff" } as any}>
                <ScrollView scrollY className="popup-container">
                    <View className="popup-title">{t("预售规则")}</View>
                    <View className="popup-content">
                        <View className="rule-item">
                            <View className="rule-item-title">{t("下单规则")}</View>
                            <View className="rule-item-content">
                                1、
                                {t("预售商品，有营销（会员价、优惠券等）时自动推荐使用，若为定金预售则在营销（会员价、优惠券等）的基础上计算尾款，付尾款时以定金的价格为基础计算尾款金额;")}
                            </View>
                            <View className="rule-item-content">2、{t("订单优惠信息将在尾款时计算")}</View>
                        </View>
                        <View className="rule-item">
                            <View className="rule-item-title">{t("售后规则")}</View>
                            <View className="rule-item-content">1、{t("全款预售商品，支付预售款后可以正常发起售后流程;")}</View>
                            <View className="rule-item-content">
                                2、{t("定金预售商品，未付尾款的订单到期也可支付尾款；付尾款后，可正常申请售后流程")}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </Popup>
        </View>
    );
}