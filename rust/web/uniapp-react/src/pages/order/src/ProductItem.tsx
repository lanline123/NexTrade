import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import ActivityCard from "@/components/masonry/ActivityCard";
import { getSkuText, hasSkuText, isOverseas } from "@/utils";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import type { Cart } from "@/types/order/check";

import "./ProductItem.scss";

interface Props {
    product: Cart;
}

/**
 * 结算页商品条目组件（自旧 pages/order/src/productItem.vue 移植）
 * - 展示商品图片、名称、规格、活动标、价格与数量
 * - 点击跳转商品详情页
 * 注意：与 components/masonry/ProductItem.tsx（瀑布流商品卡）同名不同物，本组件为 order/src 局部版本
 */
export default function ProductItem({ product }: Props) {
    /** 只展示活动类型 1（促销）与 6（优惠），与店铺卡原逻辑一致 */
    const activityTags = (() => {
        const list = (product.activityInfo as any[]) || [];
        if (!Array.isArray(list)) return [];
        return list.filter((item) => item.type === 1 || item.type === 6);
    })();

    /** 划线价折扣百分比，跨境展示用 */
    const getDiscount = (data: Cart) => {
        const origin = Number(data.originPrice);
        const price = Number(data.price);
        if (!origin || origin <= 0) return 0;
        return Math.floor(((origin - price) / origin) * 100);
    };

    const handleToProduct = () => {
        Taro.navigateTo({
            url: `/pages/product/index?id=${product.productId}`
        });
    };

    return (
        <View className="content-item" onClick={handleToProduct}>
            <View className="store-card-item-content-left">
                {/* 旧 <tig-image class="store-card-item-img">：TigImage 根节点 .base-image-box 默认撑满父容器，尺寸由外层控制 */}
                <TigImage src={pickPic(product)} />
            </View>
            <View className="store-card-item-content-right">
                <View className="store-card-item-content-right-title line1">{product.productName}</View>

                {(isOverseas() || hasSkuText(product.skuData)) && (
                    <View className="sku-card-box">{hasSkuText(product.skuData) && <Text>{getSkuText(product.skuData)}</Text>}</View>
                )}

                {!isOverseas() && activityTags.length > 0 && (
                    <View className="activity-box">
                        {activityTags.map((activityItem, activityIndex) => (
                            <ActivityCard key={activityIndex} fontSize="22rpx" activityInfo={activityItem} cardType="sub" />
                        ))}
                    </View>
                )}

                <View className="right-price-box">
                    <View className="store-card-item-content-right-price">
                        <FormatPrice priceData={product.price} integerStyle={{ fontSize: "18px", lineHeight: "24px" }} />
                    </View>
                    <View className="store-card-item-content-right-num"> x{product.quantity}</View>
                </View>

                {product.originPrice && product.originPrice !== product.price && (
                    <View className="discount-box">
                        <FormatPrice
                            fontStyle={{
                                fontWeight: "400",
                                textDecoration: "line-through",
                                fontSize: "12px"
                            }}
                            isBottom={false}
                            priceData={product.originPrice}
                        />
                        {isOverseas() && <View className="discount-text">{getDiscount(product)}% off</View>}
                    </View>
                )}
            </View>
        </View>
    );
}
