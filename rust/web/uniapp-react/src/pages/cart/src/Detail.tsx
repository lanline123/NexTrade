import { View, Text } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import { productImage } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./Detail.scss";

interface Props {
    show: boolean;
    onShowChange?: (show: boolean) => void;
    detail?: any;
}

/**
 * 购物车附加商品明细弹窗（自旧 pages/cart/src/detail.vue 移植）
 * - 展示商品主图/价格/数量及附加规格（extraSkuData）明细
 * - 原 <tig-popup> → NutUI Popup（bottom，z-index 999，#f6f6f6 底）
 */
export default function Detail({ show, onShowChange, detail = {} }: Props) {
    return (
        <Popup visible={show} position="bottom" zIndex={999} closeable={false} onClose={() => onShowChange?.(false)} style={{ backgroundColor: "#f6f6f6" }}>
            <View className="detail">
                <View className="title">{t("商品明细")}</View>
                <View className="content">
                    <View className="product">
                        <View className="product-img">
                            {/* 原 :style backgroundImage 内联样式等价平移 */}
                            <View className="img" style={{ backgroundImage: `url(${productImage(detail)})` } as any} />
                        </View>
                        <View className="product-info">
                            <View className="price price-box">
                                <FormatPrice showText={false} currencyStyle={{ fontSize: "24rpx", fontWeight: "500" }} priceData={detail?.price} />
                            </View>
                            {detail?.originPrice && detail?.originPrice > detail?.price && (
                                <View className="origin_price price-box">
                                    <FormatPrice showText={false} priceData={detail?.originPrice} />
                                </View>
                            )}
                            <View className="product-num">{`已选${detail.quantity}件`}</View>
                        </View>
                    </View>
                    <View className="attr">
                        <View className="attr-list">
                            {(detail.extraSkuData || []).map((attr: any, index: number) => (
                                <View className="attr-item" key={index}>
                                    <View className="sub-title">{attr.attrName}</View>
                                    <View className="item-content">
                                        <Text className="line1 content-text">{attr.attrValue}</Text>
                                        <View className="right">
                                            <View className="price price-box">
                                                <FormatPrice showText={false} priceData={attr.attrPrice} />
                                            </View>
                                            <View className="num">x{detail.quantity}</View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        </Popup>
    );
}
