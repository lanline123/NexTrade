import { useState } from "react";
import { RichText, Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    product?: any;
    overseas?: boolean;
}

/**
 * 商品描述卡片（自旧 pages/product/src/productDescription.vue 移植）
 * - 标题栏点击展开/收起
 * - 富文本渲染商品简介
 */
export default function ProductDescription({ product = {}, overseas = false }: Props) {
    const [showMore, setShowMore] = useState(false);

    return (
        <View className={`aftersale-card-box ${overseas ? "aftersale-card-box--overseas" : ""}`}>
            {product.productBrief ? (
                <View className="aftersale-card">
                    <View
                        className="aftersale-card-title"
                        onClick={() => {
                            setShowMore((v) => !v);
                        }}
                    >
                        <View className="title-item"> {t("商品描述")}</View>
                        <Text className={`iconfont-h5 icon-a-gengduo20 ${showMore ? "actvie" : ""}`} />
                    </View>
                    {/* 旧 v-show → display 控制 */}
                    <View className="tab_body" style={{ display: showMore ? undefined : "none" }}>
                        <RichText nodes={product.productBrief} />
                    </View>
                </View>
            ) : null}
        </View>
    );
}
