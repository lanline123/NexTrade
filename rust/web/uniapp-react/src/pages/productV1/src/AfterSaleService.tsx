import { useEffect } from "react";
import { RichText, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getAfterSaleService } from "@/api/product/product";

import "./AfterSaleService.scss";

interface Props {
    id?: string | number;
    /** 对应旧 defineModel("formState")：父组件持有状态对象，本组件请求后合并回传 */
    formState?: Record<string, any>;
    /** 对应旧 v-model:form-state 更新 */
    onUpdateFormState?: (val: Record<string, any>) => void;
}

/**
 * 售后服务说明弹窗组件（自旧 pages/productV1/src/afterSaleService.vue 移植）
 * - 加载并展示商品的售后服务条款
 * - 弹窗形式展示服务内容
 * - 旧 defineModel("formState") + Object.assign 原地合并 → formState + onUpdateFormState 回传合并结果
 * 旧源与 pages/product/src/afterSaleService.vue 逐字一致，props 契约一致，直接沿用 B2 迁移实现。
 */
export default function AfterSaleService({ id = "", formState, onUpdateFormState }: Props) {
    const fetchAfterSaleService = async (id: any) => {
        try {
            const result = await getAfterSaleService(id);
            // 旧 Object.assign(formState.value, result)（原地把响应合并进 formState）
            onUpdateFormState?.({ ...(formState ?? {}), ...result });
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
        <View>
            <View className="tab_body">
                <RichText nodes={formState?.templateContent} />
            </View>
        </View>
    );
}