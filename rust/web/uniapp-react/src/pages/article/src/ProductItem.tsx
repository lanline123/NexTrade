import { useEffect, useState } from "react";
import { Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getProductDetail } from "@/api/product/product";
import type { ProductItem as ProductItemType } from "@/types/product/product";
import { useProductStyle } from "@/hooks/useProductStyle";
import { pickPic } from "@/utils/format";

import "./ProductItem.scss";

interface ProductWithQuantity extends ProductItemType {
    quantity?: number;
}

interface Props {
    /** 旧 defineProps.productIds：兼容 [id, id] 与 [{ id, quantity }] 两种结构 */
    productIds?: any[];
}

/**
 * 文章关联商品组件（自旧 pages/article/src/productItem.vue 移植）
 * - 展示文章中关联的商品卡片
 * - 显示商品图片、名称、价格
 */
export default function ArticleProductItem({ productIds = [] }: Props) {
    const [productList, setProductList] = useState<ProductWithQuantity[]>([]);
    const { styleMap } = useProductStyle(productList);
    const [loading, setLoading] = useState(false);

    // 获取商品详情
    const fetchProductDetails = async () => {
        if (!productIds || productIds.length === 0) {
            setProductList([]);
            return;
        }

        setLoading(true);
        try {
            const promises = productIds.map(async (item: any) => {
                // 如果 productIds 是对象数组，包含 id 和 quantity
                if (typeof item === "object" && item.id) {
                    try {
                        const result = await getProductDetail(item.id);
                        return {
                            ...result.item,
                            quantity: item.quantity || 1
                        };
                    } catch (error) {
                        console.error(`获取商品 ${item.id} 详情失败:`, error);
                        return null;
                    }
                }
                // 如果 productIds 只是 ID 数组
                else if (typeof item === "number" || typeof item === "string") {
                    try {
                        const result = await getProductDetail(Number(item));
                        return {
                            ...result.item,
                            quantity: 1
                        };
                    } catch (error) {
                        console.error(`获取商品 ${item} 详情失败:`, error);
                        return null;
                    }
                }
                return null;
            });

            const results = await Promise.all(promises);
            setProductList(results.filter((item) => item !== null) as ProductWithQuantity[]);
        } catch (error) {
            console.error("获取商品列表失败:", error);
        } finally {
            setLoading(false);
        }
    };

    // 跳转到商品详情页
    const handleLink = (productId: number) => {
        if (!productId) return;
        Taro.navigateTo({
            url: `/pages/product/index?id=${productId}`
        });
    };

    // 对应旧 watch(productIds, { deep: true, immediate: true }) + onMounted：
    // 旧实现两处都会触发一次请求（首帧 productIds 为空时首轮直接 return），此处按等价语义只保留一次
    useEffect(() => {
        void fetchProductDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productIds]);

    return (
        <View className="productList">
            {productList.map((product, index) => (
                <View className="product-item" key={index}>
                    <View className="content-item" onClick={() => handleLink(product.productId)}>
                        <View className="product-item-left">
                            <TigImage className="product-item-img" src={pickPic(product)} />
                            {styleMap[product.productId]?.borderImage && (
                                <Image
                                    className="product-style-border"
                                    src={styleMap[product.productId].borderImage}
                                    mode="scaleToFill"
                                />
                            )}
                        </View>
                        <View className="product-item-right">
                            <View className="product-item-title line2">{product.productName}</View>
                            <View className="product-item-price-box">
                                <View className="product-item-price">
                                    <FormatPrice
                                        fontStyle={{ fontWeight: "bold", fontSize: "28rpx" }}
                                        decimalsStyle={{
                                            fontSize: "20rpx",
                                            fontWeight: "bold"
                                        }}
                                        currencyStyle={{
                                            fontSize: "20rpx",
                                            fontWeight: "bold"
                                        }}
                                        priceData={product.productPrice}
                                    />
                                    {product.marketPrice && product.marketPrice !== product.productPrice && (
                                        <FormatPrice
                                            fontStyle={{
                                                fontWeight: "400",
                                                textDecoration: "line-through",
                                                fontSize: "22rpx",
                                                color: "#969799",
                                                position: "relative",
                                                left: "10rpx"
                                            }}
                                            isBottom={false}
                                            priceData={product.marketPrice}
                                        />
                                    )}
                                </View>
                                <View className="product-item-num">x{product.quantity || 1}</View>
                            </View>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}
