import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import type { PaymentTypeItem } from "@/types/order/check";
import { t } from "@/utils/i18n";

import "./PaymentMode.scss";

interface Props {
    /** v-model:payTypeId → payTypeId + onPayTypeIdChange */
    payTypeId?: number;
    onPayTypeIdChange?: (val: number) => void;
    availablePaymentType?: PaymentTypeItem[];
    // 旧 check.vue 历史传入的 props（当前模板未使用，保留以与结算页接线签名一致）
    deliveryType?: number;
    canChangeDelivery?: boolean;
    pickupProducts?: any[];
    cartList?: any[];
    shippingType?: any;
    onChange?: () => void;
}

/**
 * 支付方式选择组件（自旧 pages/order/src/paymentMode.vue 移植）
 * - 平铺单选展示可用支付方式，选中即回传（与跨境版一致）
 * - 已选支付方式被接口置为不可用时，清空选择并提示原因
 */
export default function PaymentMode({
    payTypeId = 0,
    onPayTypeIdChange,
    availablePaymentType = [],
    onChange
}: Props) {
    // 旧 currentIndex ref：用户点选后按 index 高亮（接口回填时按 typeId 匹配）
    const [currentIndex, setCurrentIndex] = useState<number | null>(null);

    // 旧 watch(availablePaymentType, deep)：已选支付方式被接口置为不可用时，清空选择并提示原因
    useEffect(() => {
        const disabledItem = availablePaymentType.find((item) => item.disabled && item.typeId === payTypeId);
        if (!disabledItem) return;
        onPayTypeIdChange?.(0);
        setCurrentIndex(null);
        Taro.showToast({
            title: disabledItem.disabledDesc,
            duration: 1500,
            icon: "none"
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availablePaymentType]);

    const getActive = (index: number, id: number) => {
        if (currentIndex !== null && currentIndex !== undefined && currentIndex >= 0) {
            return currentIndex === index;
        } else {
            return id === payTypeId;
        }
    };

    const handlePaymentType = (index: number, disabled: boolean) => {
        if (disabled) return;
        setCurrentIndex(index);
        onPayTypeIdChange?.(availablePaymentType[index].typeId);
        onChange?.();
    };

    return (
        <View className="payment-box">
            <View className="payment-title">{t("支付方式")}</View>
            <View className="payment-content">
                {availablePaymentType.map((item, index) =>
                    item.isShow ? (
                        <View
                            key={item.typeId}
                            className={`payment-item ${item.disabled ? "disabled" : ""}`}
                            onClick={() => handlePaymentType(index, item.disabled)}
                        >
                            <View className={`payment-radio ${getActive(index, item.typeId) ? "active" : ""}`} />
                            <View className="payment-name">{item?.typeName}</View>
                        </View>
                    ) : null
                )}
            </View>
        </View>
    );
}
