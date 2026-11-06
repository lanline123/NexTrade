import { useState } from "react";
import { View, Text } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import DiscountInfo from "@/components/product/DiscountInfo/DiscountInfo";
import type { CartList, Total as OrderTotal } from "@/types/order/check";
import type { PresaleInfo } from "@/types/presale/presale";
import { useConfigStore } from "@/store/config";
import { isO2o } from "@/utils";
import { t } from "@/utils/i18n";

import "./TotalCard.scss";

type Total = OrderTotal & {
    /**
     * 附加费用（部分接口返回该字段）
     */
    serviceFee?: number;
    /** 跨境税率（%）：仅海外站后端返回 */
    taxRate?: number | string;
    /** 跨境税费金额：仅海外站后端返回 */
    taxRateAmount?: number | string;
};

interface Props {
    total?: Total | any;
    cartList?: CartList[];
    flowType?: number;
    /**
     * 配送方式：1-快递配送 2-到店自提 3-同城配送
     * 预约上门：以 flowType=10 为准
     */
    deliveryType?: number;
    /**
     * 是否存在可查看的配送规则
     */
    hasShippingRule?: boolean;
    /** 旧页还传了 presaleInfo/cardConfig/isSubCard，通用版 totalCard 未声明（Vue 直接忽略），此处保留形状 */
    presaleInfo?: PresaleInfo | null;
    cardConfig?: any;
    isSubCard?: boolean;
    onShowShippingFee?: () => void;
}

/**
 * 订单合计卡片（自旧 pages/order/src/totalCard.vue 移植，通用版，标准/跨境构建使用）
 * - 显示商品小计、附加费用、配送费、抵扣与优惠
 * - 展开查看优惠明细
 * - 显示订单合计与共减
 */
export default function TotalCard({
    total = {},
    cartList = [],
    flowType = 0,
    deliveryType = 0,
    onShowShippingFee
}: Props) {
    const configIntegralName = useConfigStore((s) => s.integralName);

    const shippingFeeAmount = Number((total as Total)?.shippingFee ?? 0);

    // 是否“无需配送”（整单均无需配送时才隐藏运费行）
    const isAllNoShipping = (() => {
        const list: any[] = (cartList as any[]) || [];
        if (!Array.isArray(list) || list.length === 0) return false;
        return list.every((item) => Number(item?.noShipping ?? 0) === 1);
    })();

    // 是否存在需要配送的商品
    const hasShippingProduct = (() => {
        const list: any[] = (cartList as any[]) || [];
        return Array.isArray(list) && list.some((item) => Number(item?.noShipping ?? 0) === 0);
    })();

    // 运费行展示规则：
    // - 到店自提：不展示
    // - 同城配送/预约上门：仍展示（即使为 0）
    // - 其它：若“无需配送”则不展示，否则展示（即使为 0）
    const showShippingFeeRow = (() => {
        if (!isO2o()) return hasShippingProduct;
        if (deliveryType === 2) return false;
        if (flowType === 10) return true;
        if (deliveryType === 3) return true;
        return !isAllNoShipping;
    })();

    const shippingFeeTitleKey = (() => {
        if (!isO2o()) return "快递";
        // 预约上门
        if (flowType === 10) return "上门服务费";
        // 同城配送
        if (deliveryType === 3) return "配送费";
        // 默认快递配送
        return "运费";
    })();

    // 运费为 0 时以“包邮”替代金额
    const showShippingFeeAmount = isO2o() || shippingFeeAmount > 0;

    const [showDiscountInfo, setShowDiscountInfo] = useState(false);
    const [showTaxRateTips, setShowTaxRateTips] = useState(false);

    const handleShowDiscountInfo = () => {
        setShowDiscountInfo(!showDiscountInfo);
    };

    return (
        <View className="total-card-box">
            <View className="total-card">
                <View className="total-card-item">
                    <View className="card-item-label">
                        <Text className="overstriking card-item-label-text">{t("小计")}</Text>
                        <Text>{`(${Number((total as Total)?.totalCount) || 0}${t("件")})`}</Text>
                    </View>
                    <View className="card-item-value">
                        <FormatPrice isBottom={false} priceData={(total as Total).productAmount} />
                    </View>
                </View>
                {(total as Total).serviceFee && (total as Total).serviceFee > 0 && (
                    <View className="total-card-item">
                        <View className="card-item-label">{t("附加费用")}</View>
                        <View className="card-item-value">
                            <FormatPrice isBottom={false} priceData={(total as Total).serviceFee} />
                        </View>
                    </View>
                )}
                {showShippingFeeRow && (
                    <View className="total-card-item" onClick={() => onShowShippingFee?.()}>
                        <View className="card-item-label shipping-label">{t(shippingFeeTitleKey)}</View>
                        <View className="card-item-value">
                            {showShippingFeeAmount ? (
                                <FormatPrice isBottom={false} priceData={shippingFeeAmount} />
                            ) : (
                                <Text>{t("包邮")}</Text>
                            )}
                        </View>
                    </View>
                )}
                {(total as Total).balance > 0 && (
                    <View className="total-card-item">
                        <View className="card-item-label">{t("使用余额")}</View>
                        <View className="card-item-value">
                            - <FormatPrice isBottom={false} priceData={(total as Total).balance} />
                        </View>
                    </View>
                )}
                {(total as Total).pointsAmount > 0 && flowType != 3 && (
                    <View className="total-card-item">
                        <View className="card-item-label">{`${configIntegralName}${t("减免")}`}</View>
                        <View className="card-item-value">
                            - <FormatPrice isBottom={false} priceData={(total as Total).pointsAmount} />
                        </View>
                    </View>
                )}
                {(total as Total).discounts > 0 && (
                    <View className="total-card-item">
                        <View className="card-item-label discount-label" onClick={handleShowDiscountInfo}>
                            {t("共优惠")}
                            {/* 旧 up-icon info-circle（size=16 #969799）→ 样式等价的 ⓘ 字符，TODO(MIGRATION) 可随图标库统一替换 */}
                            <Text className="discount-info-icon">ⓘ</Text>
                        </View>
                        <View className="card-item-value">
                            - <FormatPrice isBottom={false} priceData={(total as Total).discounts} />
                        </View>
                    </View>
                )}
                {/* 跨境税费行：数据驱动（后端返回 taxRate/taxRateAmount 才展示），国内构建整段裁切、零售零变化 */}
                {(Number((total as Total).taxRateAmount) > 0 || Number((total as Total).taxRate) > 0) && (
                    <View className="total-card-item">
                        <View className="card-item-label tax-label">
                            {t("税费")}
                            <View
                                className="tax-tip-trigger"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowTaxRateTips(true);
                                }}
                            >
                                ?
                            </View>
                        </View>
                        <View className="card-item-value">
                            <FormatPrice isBottom={false} priceData={(total as Total).taxRateAmount} />
                        </View>
                    </View>
                )}
                <View className="total-card-item unpaid-amount-box">
                    <View className="card-item-label">
                        <Text className="overstriking card-item-label-text">{t("订单合计")}</Text>
                    </View>
                    <View className="card-item-value unpaid-amount">
                        {/* flowType12 是电子实体卡兑换商品，不显示共减 */}
                        {flowType != 12 && (
                            <View className="price-info-discount">
                                <Text className="discount-text">{t("共减")}</Text>
                                <FormatPrice isBottom={false} fontStyle={{ fontSize: "25rpx" }} priceData={(total as Total)?.discounts} />
                            </View>
                        )}
                        <View className="price-info-total">
                            <FormatPrice isBottom={false} priceData={(total as Total)?.unpaidAmount} />
                        </View>
                    </View>
                </View>
                {(total as Total).orderSendPoint && (total as Total).orderSendPoint > 0 && (
                    <View className="total-card-tig">
                        * {t("该订单完成后，您将预计获得")} <Text className="special-text">{(total as Total).orderSendPoint}</Text>{" "}
                        {t(configIntegralName)}
                    </View>
                )}
            </View>

            <DiscountInfo show={showDiscountInfo} onShowChange={setShowDiscountInfo} total={total} discountType="order" />
            <Popup
                visible={showTaxRateTips}
                position="bottom"
                round
                onClose={() => setShowTaxRateTips(false)}
                style={{ overflow: "hidden" } as any}
            >
                <View className="tax-popup">
                    <View className="tax-popup-title">{t("税费说明")}</View>
                    <View className="tax-popup-content">{t("税费按所选地址所在国家/地区政策计算。")}</View>
                    <View className="tax-popup-content">{t("选择地址后，系统自动算税费，结算页显示税费金额。")}</View>
                    <View className="tax-popup-content">{t("税费会随订单一起支付，由商城统一代缴。")}</View>
                </View>
            </Popup>
        </View>
    );
}
