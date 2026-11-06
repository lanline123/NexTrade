import { useMemo } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { ScrollView, View, Text } from "@tarojs/components";

import type { CartList } from "@/types/order/check";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./ShippingFeePop.scss";

interface Props {
    show?: boolean;
    onShowChange?: (val: boolean) => void;
    storeShippingRule?: any;
    cartList?: CartList[];
    /**
     * 费用类型
     * - localDelivery: 同城配送（默认）
     * - homeService: 预约上门服务
     */
    feeType?: "localDelivery" | "homeService";
}

/**
 * 运费详情弹窗组件（自旧 pages/order/src/shippingFeePop.vue 移植）
 * - 展示各店铺的运费明细
 * - 显示同城配送费用详情（feeType=homeService 时切换为上门服务规则文案与米→公里换算）
 * - 旧 tig-popup（默认 bottom、白底）→ NutUI Popup
 */
export default function ShippingFeePop({ show = false, onShowChange, storeShippingRule, cartList = [], feeType = "localDelivery" }: Props) {
    const dollarSignCn = useConfigStore((s) => s.dollarSignCn);

    const isHomeService = feeType === "homeService";

    const shippingRuleTitle = isHomeService ? t("上门服务规则") : t("配送规则");
    const ruleTitleSuffix = isHomeService ? t("上门服务规则") : t("配送规则");
    const ruleDesc = isHomeService ? t("根据商家设置上门服务距离进行收费") : t("根据商家设置配送距离进行收费");
    const baseFeeLabel = isHomeService ? t("基础上门服务费") : t("基础配送费");
    const feeIncreaseLabel = isHomeService ? t("上门服务费增加") : t("配送费增加");

    const getBaseRadius = (value: any) => {
        // 上门服务半径后端返回米，需换算；同城配送半径后端已换算为公里
        const rawRadius = isHomeService ? value?.serviceRadius : value?.deliveryRadius;
        const radiusKm = isHomeService ? Number(rawRadius) / 1000 : Number(rawRadius);
        if (Number.isNaN(radiusKm)) return rawRadius;
        return Number.isInteger(radiusKm) ? radiusKm : radiusKm.toFixed(2).replace(/\.?0+$/, "");
    };

    const getBaseFee = (value: any) => {
        return isHomeService ? value?.homeFee : value?.baseDeliveryFee;
    };

    // 旧 computed（保持原 mutation 语义：把 cartList 的店铺名写回规则对象）
    const formatstoreShippingRule = useMemo(() => {
        let obj = storeShippingRule || {};

        if (Object.keys(obj).length > 0) {
            cartList.forEach((item) => {
                if (obj[item.shopId]) {
                    obj[item.shopId].shopTitle = item.shopTitle;
                }
            });
        }

        return obj;
    }, [storeShippingRule, cartList]);

    return (
        <Popup visible={show} onClose={() => onShowChange?.(false)} style={{ backgroundColor: "#fff" } as any}>
            <ScrollView scrollY className="popup-container">
                <View className="popup-title">{t(shippingRuleTitle)}</View>
                <View className="popup-content">
                    {Object.entries(formatstoreShippingRule).map(([key, value]: any) => (
                        <View className="shippingfee-item" key={key}>
                            <View className="store-title"> {`${value?.shopTitle}${ruleTitleSuffix}`}</View>
                            <View className="desc">{ruleDesc}</View>
                            <View className="base-freight">
                                {t("-订单基础")}
                                {getBaseRadius(value)}
                                {t("km内")}
                                {baseFeeLabel}
                                <Text>{getBaseFee(value)}</Text>
                                {dollarSignCn}
                            </View>
                            {value.distancePricing && value.distancePricing.length > 0 && (
                                <View className="delivery-rules">
                                    {value.distancePricing.map((item: any, index: number) => (
                                        <View className="rule-item" key={index}>
                                            <Text>-</Text>
                                            <Text>
                                                {t("超过")}
                                                {item.distanceThreshold}
                                                {t("km，每增加")}
                                                {item.distanceUnit}
                                                {t("km，")}
                                                {feeIncreaseLabel}
                                                {item.additionalFee}
                                                {dollarSignCn}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </Popup>
    );
}
