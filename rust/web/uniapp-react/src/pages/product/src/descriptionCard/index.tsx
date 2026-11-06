import { useState } from "react";
import { Image, RichText, Text, View } from "@tarojs/components";

import { formatRichText, isPro, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    descArr?: Array<any>;
    productId?: number;
    productType?: number;
    isBuy?: number;
    paidContent?: Array<any> | string;
    overseas?: boolean;
    /** 对应旧 v-model:show-more */
    modelValue?: boolean;
    /** 对应旧 emit("update:showMore") */
    onUpdateModelValue?: (val: boolean) => void;
}

/**
 * 商品详情卡片（自旧 pages/product/src/descriptionCard.vue 移植）
 * - 标题栏点击展开/收起
 * - 富文本 / 图片渲染详情内容
 */
export default function DescriptionCard({
    descArr = [],
    productType = 1,
    isBuy = 0,
    paidContent = [],
    overseas = false,
    modelValue = false,
    onUpdateModelValue
}: Props) {
    // 旧 defineModel("showMore")：父组件可双向控制，这里以 props 为准、内部回写走回调
    const [innerShowMore, setInnerShowMore] = useState(false);
    const showMore = modelValue ?? innerShowMore;
    const toggleShowMore = () => {
        const next = !showMore;
        if (modelValue === undefined) setInnerShowMore(next);
        onUpdateModelValue?.(next);
    };

    return (
        <View className={`description-card-box ${overseas ? "description-card-box--overseas" : ""}`}>
            <View className="description-card">
                <View className="description-card-title" onClick={toggleShowMore}>
                    <View className="title-item">{t("商品详情")}</View>
                    <Text className={`iconfont-h5 icon-a-gengduo20 ${showMore ? "actvie" : ""}`} />
                </View>
                {/* 旧 v-show → display 控制 */}
                <View className="description-content" style={{ display: showMore ? undefined : "none" }}>
                    {isPro() && productType === 4 ? (
                        isBuy === 1 && paidContent ? (
                            <>
                                {(paidContent as Array<any>).map((item, index) => (
                                    <View key={index}>
                                        {item.type == "pic" && (
                                            <View className="desc-pic-item">
                                                <Image lazyLoad src={imageFormat(item?.pic || "")} className="slide-image" mode="widthFix" />
                                            </View>
                                        )}
                                        {item.type == "text" && <RichText className="desc-text-item" nodes={formatRichText(item.html)} />}
                                    </View>
                                ))}
                            </>
                        ) : (
                            <Image className="img" src={staticResource("product/paid_content_bg.png")} mode="widthFix" />
                        )
                    ) : null}

                    {descArr.map((item, index) => (
                        <View key={index}>
                            {item.type == "pic" && (
                                <View className="desc-pic-item">
                                    <Image lazyLoad src={imageFormat(item?.pic || "")} className="slide-image" mode="widthFix" />
                                </View>
                            )}
                            {item.type == "text" && <RichText className="desc-text-item" nodes={formatRichText(item.html)} />}
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
