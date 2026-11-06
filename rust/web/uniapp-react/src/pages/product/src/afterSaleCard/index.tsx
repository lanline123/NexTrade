import { useEffect, useState } from "react";
import { RichText, Text, View } from "@tarojs/components";

import { getAfterSaleService } from "@/api/product/product";
import Taro from "@tarojs/taro";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    id?: string | number;
    overseas?: boolean;
}

/**
 * 售后服务卡片（自旧 pages/product/src/afterSaleCard.vue 移植）
 * - 标题栏点击展开/收起
 * - 富文本渲染售后服务模板
 */
export default function AfterSaleCard({ id = "", overseas = false }: Props) {
    const [showMore, setShowMore] = useState(false);

    const [formState, setFormState] = useState<any>({});

    const fetchAfterSaleService = async (id: any) => {
        try {
            const result = await getAfterSaleService(id);
            // 旧 Object.assign(formState.value, result)（原地把响应合并进 formState）
            setFormState((prev: any) => ({ ...prev, ...result }));
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    // 旧 watchEffect(() => { if (props.id) fetchAfterSaleService(props.id) })
    useEffect(() => {
        if (id) {
            void fetchAfterSaleService(id);
        }
    }, [id]);

    return (
        <View className={`aftersale-card-box ${overseas ? "aftersale-card-box--overseas" : ""}`}>
            {formState.showTemplateContent ? (
                <>
                    <View className="aftersale-card">
                        <View className="aftersale-card-title" onClick={() => setShowMore(!showMore)}>
                            <View className="title-item"> {t("售后服务")}</View>
                            <Text className={`iconfont-h5 icon-a-gengduo20 ${showMore ? "actvie" : ""}`} />
                        </View>
                        {/* 原 v-show="showMore" → 常驻渲染 + display 控制 */}
                        <View className="tab_body" style={{ display: showMore ? "" : "none" }}>
                            <RichText nodes={formState.templateContent} />
                        </View>
                    </View>
                </>
            ) : null}
        </View>
    );
}
