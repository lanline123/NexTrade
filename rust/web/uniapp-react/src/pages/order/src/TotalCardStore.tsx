import { useState } from "react";
import { View, Text } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import DiscountInfo from "@/components/product/DiscountInfo/DiscountInfo";
import FormatPrice from "@/components/format-price/FormatPrice";
import type { Total as OrderTotal } from "@/types/order/check";
import { useConfigStore } from "@/store/config";
import type { PresaleInfo } from "@/types/presale/presale";
import { t } from "@/utils/i18n";

import "./TotalCardStore.scss";

type Total = OrderTotal & {
    /**
     * 附加费用（部分接口返回该字段）
     */
    serviceFee?: number;
    cycleCardInfo?: {
        unitPrice?: number | string;
    };
    /** 跨境税率（%）：仅海外站后端返回 */
    taxRate?: number | string;
    /** 跨境税费金额：仅海外站后端返回 */
    taxRateAmount?: number | string;
};

interface Props {
    total?: Total | any;
    // 预售（结算页透传，当前组件可按需扩展展示）
    presaleInfo?: PresaleInfo | null;
    cartList?: any[];
    flowType?: number;
    /**
     * 配送方式：1-快递配送 2-到店自提 3-同城配送
     * 预约上门：以 flowType=10 为准
     */
    deliveryType?: number;
    cardConfig?: any;
    isSubCard?: boolean;
    /**
     * 是否存在可查看的配送规则
     */
    hasShippingRule?: boolean;
    /** 旧 @showShippingFee（运费规则入口） */
    onShowShippingFee?: () => void;
}

/**
 * 订单金额汇总卡片组件（门店版，o2o 构建使用；自旧 pages/order/src/totalCardStore.vue 移植）
 * - 显示商品小计、运费（含运费规则入口）、次卡抵扣、账期、优惠金额
 * - 展开查看优惠明细
 * - 显示订单总价
 */
export default function TotalCardStore({
    total = {},
    presaleInfo,
    cartList = [],
    flowType = 0,
    deliveryType = 0,
    cardConfig = {},
    isSubCard = false,
    hasShippingRule = false,
    onShowShippingFee
}: Props) {
    const configIntegralName = useConfigStore((s) => s.integralName);

    const [showDiscountInfo, setShowDiscountInfo] = useState(false);
    const [showTaxRateTips, setShowTaxRateTips] = useState(false);
    const handleShowDiscountInfo = () => {
        setShowDiscountInfo(!showDiscountInfo);
    };

    const shippingFeeAmount = Number((total as Total)?.shippingFee ?? 0);

    // 是否“无需配送”（整单均无需配送时才隐藏运费行）
    const isAllNoShipping = (() => {
        const list: any[] = (cartList as any[]) || [];
        if (!Array.isArray(list) || list.length === 0) return false;
        return list.every((item) => Number(item?.noShipping ?? 0) === 1);
    })();

    // 运费行展示规则：
    // - 到店自提：不展示
    // - 同城配送/预约上门：仍展示（即使为 0）
    // - 其它：若“无需配送”则不展示，否则展示（即使为 0）
    const showShippingFeeRow = (() => {
        if (deliveryType === 2) return false;
        if (flowType === 10) return true;
        if (deliveryType === 3) return true;
        return !isAllNoShipping;
    })();

    const shippingFeeTitleKey = (() => {
        // 预约上门
        if (flowType === 10) return "上门服务费";
        // 同城配送
        if (deliveryType === 3) return "配送费";
        // 默认快递配送
        return "运费";
    })();

    // 旧 computed shippingFeeFreeTextKey（模板未引用，保留原逻辑）
    const shippingFeeFreeTextKey = (() => {
        if (flowType === 10) return t("免费上门");
        if (deliveryType === 3) return t("免配送费");
        return t("包邮");
    })();
    void shippingFeeFreeTextKey;

    return (
        <View className="total-card">
            <View>
                <View className="total-card-item">
                    <View className="total-card-item-left">{t("商品总价")}</View>
                    <View className="total-card-item-right">
                        <FormatPrice isBottom={false} priceData={(total as Total).productAmount} />
                    </View>
                </View>
                {(total as Total).serviceFee && (total as Total).serviceFee > 0 && (
                    <View className="total-card-item">
                        <View className="total-card-item-left">{t("附加费用")}</View>
                        <View className="total-card-item-right">
                            <FormatPrice isBottom={false} priceData={(total as Total).serviceFee} />
                        </View>
                    </View>
                )}

                {/* 运费：除到店自提外，其它类型订单均需展示；运费=0 显示对应文案 */}
                {showShippingFeeRow && (
                    <View className="total-card-item" onClick={() => onShowShippingFee?.()}>
                        <View className="total-card-item-left">
                            {t(shippingFeeTitleKey)}
                            {hasShippingRule && <Text className="iconfont-h5 icon-wenhao-xianxingyuankuang" />}
                        </View>
                        <View className="total-card-item-right special-text">
                            <FormatPrice isBottom={false} priceData={shippingFeeAmount} />
                        </View>
                    </View>
                )}

                {!isSubCard && cardConfig?.unitPrice && (
                    <View className="total-card-item">
                        <View className="total-card-item-left">{t("次卡抵扣")}</View>
                        <View className="total-card-item-right">
                            - <FormatPrice isBottom={false} priceData={cardConfig?.unitPrice} />
                        </View>
                    </View>
                )}
                {(total as Total).balance > 0 && (
                    <View className="total-card-item">
                        <View className="total-card-item-left">{t("使用余额")}</View>
                        <View className="total-card-item-right">
                            - <FormatPrice isBottom={false} priceData={(total as Total).balance} />
                        </View>
                    </View>
                )}
                {(total as Total).creditAmount && (total as Total).creditAmount > 0 && (
                    <View className="total-card-item">
                        <View className="total-card-item-left">{t("使用账期")}</View>
                        <View className="total-card-item-right">
                            - <FormatPrice isBottom={false} priceData={(total as Total).creditAmount} />
                        </View>
                    </View>
                )}
                {(total as Total).pointsAmount > 0 && flowType != 3 && (
                    <View className="total-card-item">
                        <View className="total-card-item-left">{`${configIntegralName}${t("减免")}`}</View>
                        <View className="total-card-item-right">
                            - <FormatPrice isBottom={false} priceData={(total as Total).pointsAmount} />
                        </View>
                    </View>
                )}
                {(total as Total).discounts > 0 && (
                    <View className="total-card-item">
                        <View className="total-card-item-left" onClick={handleShowDiscountInfo}>
                            {t("共优惠")}
                            {/* 旧 up-icon info-circle（size=16 #969799）→ 样式等价的 ⓘ 字符，TODO(MIGRATION) 可随图标库统一替换 */}
                            <Text className="discount-info-icon">ⓘ</Text>
                        </View>
                        <View className="total-card-item-right">
                            <View>
                                {" "}
                                - <FormatPrice isBottom={false} priceData={(total as Total).discounts} />{" "}
                            </View>
                        </View>
                    </View>
                )}
                {/* 跨境税费行：数据驱动（后端返回 taxRate/taxRateAmount 才展示），国内构建整段裁切、零售零变化 */}
                {(Number((total as Total).taxRateAmount) > 0 || Number((total as Total).taxRate) > 0) && (
                    <View className="total-card-item">
                        <View className="total-card-item-left tax-label">
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
                        <View className="total-card-item-right">
                            <FormatPrice isBottom={false} priceData={(total as Total).taxRateAmount} />
                        </View>
                    </View>
                )}
                {(total as Total).orderSendPoint && (total as Total).orderSendPoint > 0 && (
                    <View className="total-card-tig">
                        * {t("该订单完成后，您将预计获得")} <Text className="special-text">{(total as Total).orderSendPoint}</Text> {t(configIntegralName)}
                    </View>
                )}
            </View>

            <DiscountInfo show={showDiscountInfo} onShowChange={setShowDiscountInfo} total={total} discountType="order" />
            {/* 旧 tig-popup（position bottom、round 20、custom-style overflow hidden）→ NutUI Popup */}
            <Popup visible={showTaxRateTips} position="bottom" round onClose={() => setShowTaxRateTips(false)} style={{ overflow: "hidden" } as any}>
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
