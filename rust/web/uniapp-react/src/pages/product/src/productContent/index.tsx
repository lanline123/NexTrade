import { Fragment, useState } from "react";
import { Image, RichText, View } from "@tarojs/components";

import { formatRichText, isPro, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import AfterSaleService from "../afterSaleService";

import "./index.scss";

interface Props {
    descArr?: Array<any>;
    productId?: number | null;
    productType?: number;
    isBuy?: number;
    paidContent?: Array<any>;
}

/**
 * 商品详情内容组件（自旧 pages/product/src/productContent.vue 移植）
 * - 展示商品规格参数表格
 * - 富文本渲染商品详情描述
 * - 售后服务说明弹窗
 */
export default function ProductContent({ descArr = [], productId = null, productType = 1, isBuy = 0, paidContent = [] }: Props) {
    const [tabIndex, setTabIndex] = useState(0);
    // 对应旧 formState（v-model:form-state 传给 afterSaleService 的双向值）
    const [formState, setFormState] = useState<any>({});

    return (
        <View className="product-card-row product-detail-area">
            <View className="tab-box flex align-center justify-around">
                <View
                    className={`tab ${tabIndex == 0 ? "active" : ""}`}
                    onClick={() => {
                        setTabIndex(0);
                    }}
                >
                    {t("商品介绍")}
                </View>
                {/* 旧 formState.showTemplateContent：formState 由售后子组件回写后才显示该页签 */}
                {formState.showTemplateContent ? (
                <View
                    className={`tab ${tabIndex == 1 ? "active" : ""}`}
                    onClick={() => {
                        setTabIndex(1);
                    }}
                >
                    {t("售后服务")}
                </View>
                ) : null}
            </View>
            {tabIndex == 0 ? (
                <View className="default">
                    {isPro() && productType === 4 ? (
                        // 旧条件 isBuy === 1 && paidContent（数组真值判断，与旧实现保持一致）
                        isBuy === 1 && paidContent ? (
                            <>
                                {paidContent.map((item, index) => (
                                    <Fragment key={index}>
                                        {item.type == "pic" ? (
                                            <View className="desc-pic-item">
                                                <Image lazyLoad src={imageFormat(item?.pic || "")} className="slide-image" mode="widthFix" />
                                            </View>
                                        ) : null}
                                        {item.type == "text" ? <RichText className="desc-text-item" nodes={formatRichText(item.html)} /> : null}
                                    </Fragment>
                                ))}
                            </>
                        ) : (
                            <Image className="img" src={staticResource("product/paid_content_bg.png")} mode="widthFix" />
                        )
                    ) : null}

                    {descArr.map((item, index) => (
                        <Fragment key={index}>
                            {item.type == "pic" ? (
                                <View className="desc-pic-item">
                                    <Image lazyLoad src={imageFormat(item?.pic || "")} className="slide-image" mode="widthFix" />
                                </View>
                            ) : null}
                            {item.type == "text" ? <RichText className="desc-text-item" nodes={formatRichText(item.html)} /> : null}
                        </Fragment>
                    ))}
                </View>
            ) : null}
            {/* 旧 v-show → display 控制 */}
            <View className="default" style={{ display: tabIndex == 1 ? undefined : "none" }}>
                {/* 旧 v-model:form-state → formState + onUpdateFormState 回传合并 */}
                <AfterSaleService id={productId ?? undefined} formState={formState} onUpdateFormState={(val) => setFormState(val)} />
            </View>
        </View>
    );
}
