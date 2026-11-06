import { Popup } from "@nutui/nutui-react-taro";
import { Image, Text, View } from "@tarojs/components";

import { PAYMENT_TEXT_MAP } from "@/hooks/usePayment";
import { staticResource } from "@/utils";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./AbandonPayDialog.scss";

interface Props {
    /** 旧 v-model:show */
    show: boolean;
    /** 旧 @update:show */
    onShowChange: (v: boolean) => void;
    /** 应付金额（已格式化字符串） */
    amount: string | number;
    /** 当前选中的支付渠道 code */
    paymentType: string;
    /** 本单赠送积分（大于 0 才展示权益行） */
    rewardPoints?: number | string;
    /** 优惠立减金额 */
    discountAmount?: number | string;
    /** 旧 @abandon：放弃支付 / 弹窗关闭 */
    onAbandon: () => void;
    /** 旧 @confirm：立即支付 */
    onConfirm: () => void;
    /** 旧 @change：更换方式 */
    onChange: () => void;
}

/**
 * 放弃支付挽留弹窗（自旧 pages/order/src/abandonPayDialog.vue 移植）
 * - 底部弹层展示本单权益、当前支付方式，引导用户继续支付
 * - 放弃支付 / 立即支付 / 更换方式 由父级处理
 * - 旧 <tig-popup> → NutUI Popup（bottom，z-index 1002，白底，round 24）
 */
export default function AbandonPayDialog({
    show,
    onShowChange,
    amount,
    paymentType,
    rewardPoints = 0,
    discountAmount = 0,
    onAbandon,
    onConfirm,
    onChange
}: Props) {
    const configStoreIntegralName = useConfigStore((s) => s.integralName);

    // 弹窗右上角关闭/遮罩关闭：与放弃支付同走 abandon（旧 @close="onPopupClose"）
    const onPopupClose = () => {
        onShowChange(false);
        onAbandon();
    };

    return (
        <Popup
            visible={show}
            position="bottom"
            zIndex={1002}
            closeable
            onClose={onPopupClose}
            onClick={() => {}}
            style={{ backgroundColor: "#fff", borderRadius: "24rpx 24rpx 0 0" }}
        >
            <View className="abandon">
                <View className="abandon-icon">
                    <Image className="icon-img" src={staticResource("payment/rightsAndinterests.png")} mode="aspectFit" />
                </View>
                <View className="abandon-title">{t("本单可享受以下权益")}</View>
                <View className="benefit-list">
                    {Number(rewardPoints) > 0 && (
                        <View className="benefit">
                            <Text className="benefit-label">{t("下单成功")}</Text>
                            <Text className="benefit-value">
                                {t("本单赠送")}
                                {rewardPoints}
                                {t(configStoreIntegralName)}
                            </Text>
                        </View>
                    )}
                    {Number(discountAmount) > 0 && (
                        <View className="benefit">
                            <Text className="benefit-label">{t("会员下单成功")}</Text>
                            <View className="benefit-value">
                                <Text>{t("优惠立减")}</Text>
                                <FormatPrice isBottom={false} priceData={discountAmount} fontStyle={{ color: "var(--general)", fontSize: "28rpx" }} />
                            </View>
                        </View>
                    )}
                </View>

                <View className="current-pay">
                    <View className="current-pay-left">
                        {paymentType && <Image className="pay-icon" src={staticResource("payment/pay_" + paymentType + ".png")} lazyLoad />}
                        <Text className="current-pay-text">
                            {t("正在使用")}
                            {t(PAYMENT_TEXT_MAP[paymentType] || paymentType)}
                        </Text>
                    </View>
                    {/* 旧 <i class="iconfont-h5 icon-a-gengduo20" /> → Text 图标占位 */}
                    <View className="current-pay-change" onClick={onChange}>
                        {t("更换方式")} <Text className="iconfont-h5 icon-a-gengduo20" />
                    </View>
                </View>

                <View className="abandon-btns">
                    <View className="abandon-btn cancel" onClick={onAbandon}>
                        {t("放弃支付")}
                    </View>
                    <View className="abandon-btn confirm" onClick={onConfirm}>
                        <View className="abandon-btn-inner">
                            {t("立即支付")}
                            <FormatPrice priceData={amount} />
                        </View>
                    </View>
                </View>
            </View>
        </Popup>
    );
}
