import { useState } from "react";
import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    normal?: any[];
    overseas?: boolean;
}

/**
 * 规格参数卡片（自旧 pages/product/src/attrCard.vue 移植）
 * - 标题栏点击展开/收起
 * - 逐行展示参数名与参数值
 */
export default function AttrCard({ normal = [], overseas = false }: Props) {
    const [showMore, setShowMore] = useState(false);

    const getAllAttrValue = (arr: any[]) => {
        return arr.map((item) => item.attrValue).join("、");
    };

    return (
        <View className={`attr-card-box ${overseas ? "attr-card-box--overseas" : ""}`}>
            <View className="attr-card">
                <View className="attr-card-title" onClick={() => setShowMore(!showMore)}>
                    <View className="title-item"> {t("规格参数")}</View>
                    <Text className={`iconfont-h5 icon-a-gengduo20 ${showMore ? "actvie" : ""}`} />
                </View>

                {showMore ? (
                    <View className="attr-card-content">
                        {normal.map((item, index) => (
                            <View className="attr-card-item" key={index}>
                                <View className="item-name line1">{item.attrName}</View>
                                <View className="item-value line1">{getAllAttrValue(item.attrList)}</View>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}
