import { View, Text, Image } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./DiscountInfo.scss";

interface Props {
    show: boolean;
    onShowChange?: (show: boolean) => void;
    total?: any;
    discountType?: string;
}

/**
 * 优惠明细弹窗（自旧 components/product/discountInfo.vue 移植）。
 * 曾在购物车页（pages/cart/src）做成局部组件；订单确认页（pages/order/check → totalCard）
 * 移植时按原计划上移到 components/product/ 共享，购物车页改为引用本组件。
 */
export default function DiscountInfo({ show, onShowChange, total = {}, discountType = "" }: Props) {
    // 购物车传「已勾选件数」，订单确认页只有 totalCount，取不到则为 0（模板里不渲染件数）
    const itemCount = Number((total as any)?.checkedCount ?? (total as any)?.totalCount ?? 0) || 0;

    return (
        <Popup visible={show} position="bottom" zIndex={999} closeable={false} onClose={() => onShowChange?.(false)} style={{ backgroundColor: "#fff" }}>
            <View className="discount">
                <View className="discount-title">
                    <View className="title-text">{t("优惠明细")}</View>
                    <View className="close-icon" onClick={() => onShowChange?.(false)}>
                        <Image src={staticResource("order/close.png")} />
                    </View>
                </View>
                <View className="discount-content">
                    <View className="discount-item-box">
                        <View className="item-label fontWeight">
                            {t("商品总额")}
                            {itemCount > 0 && <Text className="item-label-text">{`(${itemCount}${t("件")})`}</Text>}
                        </View>
                        <View className="item-value">
                            <FormatPrice showText={false} isBottom={false} priceData={(total as any).productAmount} />
                        </View>
                    </View>
                    <View className="line" />
                    {(total as any).serviceFee && (total as any).serviceFee > 0 && (
                        <View className="discount-item-box">
                            <View className="item-label">{t("附加费用")}</View>
                            <View className="item-value">
                                <FormatPrice showText={false} isBottom={false} priceData={(total as any).serviceFee} />
                            </View>
                        </View>
                    )}
                    <View className="discount-item-box">
                        <View className="item-label">{t("共优惠")}</View>
                        <View className="item-value discounts-value" style={{ color: "var(--general)" } as any}>
                            -
                            <FormatPrice showText={false} isBottom={false} priceData={(total as any).discounts} />
                        </View>
                    </View>
                    {(total as any).discountCouponAmount > 0 && (
                        <View className="discount-item-box">
                            <View className="item-label">{t("优惠券")}</View>
                            <View className="item-value discounts-value">
                                -
                                <FormatPrice showText={false} isBottom={false} priceData={(total as any).discountCouponAmount} />
                            </View>
                        </View>
                    )}
                    {(total as any).discountDiscountAmount > 0 && (
                        <View className="discount-item-box">
                            <View className="item-label">{t("其他优惠")}</View>
                            <View className="item-value discounts-value">
                                -
                                <FormatPrice showText={false} isBottom={false} priceData={(total as any).discountDiscountAmount} />
                            </View>
                        </View>
                    )}
                    <View className="line" />
                    <View className="discount-item-box discount-total">
                        <View className="item-label fontWeight">{t("合计")}</View>
                        <View className="item-value">
                            <FormatPrice showText={false} isBottom={false} priceData={(total as any).discountAfter || (total as any).totalAmount} fontStyle={{}} />
                        </View>
                    </View>
                    {!discountType && <View className="discount-desc">{t("以上优惠不包含运费，实际优惠金额请以确认订单页为准")}</View>}
                </View>
            </View>
        </Popup>
    );
}
