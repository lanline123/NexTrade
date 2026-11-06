import { useReducer } from "react";
import { ScrollView, Text, View } from "@tarojs/components";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigLazyImage from "@/components/tig/tig-lazy-image/TigLazyImage";
import SoldOut from "../buyerShowCompnents/SoldOut";
import { redirect } from "@/utils";
import { pickPic } from "@/utils/format";

import "./ProductList.scss";

interface Props {
    /** 旧 v-model:products */
    products: any[];
    /** 旧 v-model:total */
    total?: number;
    productListHeight?: number | string;
    /** 旧 @scrolltolower */
    onScrollToLower?: () => void;
}

/**
 * 商品选择列表组件（自旧 src/ProductList.vue 移植）
 * - 展示用户已购商品列表
 * - 多选关联到买家秀
 * - 旧 up-list → Taro ScrollView；旧 tig-checkbox（工程内未迁移）→ 基础组件自绘
 */
export default function ProductList({ products = [], total = 0, productListHeight = 0, onScrollToLower }: Props) {
    const [, forceRender] = useReducer((x: number) => x + 1, 0);

    // 计算已选中数量
    const selectedCount = products ? products.filter((item: any) => item.isChecked).length : 0;

    const toProductDetail = (item: any) => {
        redirect({
            url: "/pages/product/index",
            param: {
                id: item.productId
            }
        });
    };

    const toggleCheck = (item: any) => {
        if (item.isDisabled) return;
        item.isChecked = !item.isChecked;
        forceRender();
    };

    const heightStyle = typeof productListHeight === "number" ? `${productListHeight}rpx` : productListHeight || "0rpx";

    if (!total) return null;

    return (
        <View className="productList">
            <View className="total">
                {selectedCount}/{total}
            </View>
            <ScrollView scrollY style={{ height: heightStyle }} onScrollToLower={onScrollToLower}>
                {products.map((item: any, index: number) => (
                    <View key={index} className={`productInfo${item.isChecked ? " active" : ""}`}>
                        <SoldOut showOutsale={item.storeProductStock === 0} item={item} stockField="storeProductStock" onClick={() => toProductDetail(item)}>
                            <TigLazyImage src={pickPic(item)} mode="aspectFit" />
                        </SoldOut>
                        <View className="content">
                            <View className="title">{item.productName}</View>
                            {/* 旧 format-price 根节点带 class="price"，这里包一层保留 .content .price 样式 */}
                            <View className="price">
                                <FormatPrice priceData={item.productPrice} fontStyle={{ fontSize: "28rpx" }} />
                            </View>
                        </View>
                        <View
                            className={`check-item${item.isChecked ? " checked" : ""}${item.isDisabled ? " disabled" : ""}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                toggleCheck(item);
                            }}
                        >
                            {item.isChecked && <Text className="check-icon">✓</Text>}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}