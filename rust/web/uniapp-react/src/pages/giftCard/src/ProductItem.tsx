import { Image, View } from "@tarojs/components";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import type { GiftCardProduct } from "@/types/giftCard/giftCard";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";
import { redirect } from "@/utils";
import { pickPic } from "@/utils/format";

import "./ProductItem.scss";

interface Props {
    product: GiftCardProduct;
    productStyle?: ProductActiveStyleVO | null;
}

/**
 * 礼品卡可兑换商品行（自旧 pages/giftCard/src/productItem.vue 移植）
 * - 展示商品图（含活动边框）、名称、规格、价格与数量
 */
export default function ProductItem({ product, productStyle = null }: Props) {
    const skuDesc = (() => {
        if (!product.skuData || !(product.skuData as unknown as any[]).length) {
            return "";
        }
        try {
            const skuInfo = JSON.parse(product.skuData);
            return skuInfo
                .map((item: any) => {
                    return item.name + ": " + item.value;
                })
                .join(" ");
        } catch {
            return "";
        }
    })();

    const toProductPage = (id: number) => {
        redirect({
            url: `/pages/product/index?id=${id}`
        });
    };

    return (
        <View className="product-item" onClick={() => toProductPage(product.productId)}>
            <View className="product-img">
                <TigImage className="img" src={pickPic(product)} mode="aspectFill" />
                {productStyle?.borderImage ? (
                    <Image className="product-style-border" src={productStyle.borderImage} mode="scaleToFill" />
                ) : null}
            </View>
            <View className="product-info">
                <View className="product-name line1">{product.productName}</View>
                {skuDesc ? (
                    <View className="product-sku-box">
                        <View className="product-sku line1">{skuDesc}</View>
                    </View>
                ) : null}
                <View className="product-price">
                    {/* 旧 :style 作用在 format-price 根节点 → 外层容器承载同款内联样式 */}
                    <View style={{ fontSize: "36rpx", color: "#A9781B" }}>
                        <FormatPrice
                            currencyStyle={{
                                fontSize: "24rpx"
                            }}
                            decimalsStyle={{
                                fontSize: "24rpx"
                            }}
                            priceData={product.skuId ? product.skuPrice : product.productPrice}
                        />
                    </View>
                    <View className="product-num">x1</View>
                </View>
            </View>
        </View>
    );
}