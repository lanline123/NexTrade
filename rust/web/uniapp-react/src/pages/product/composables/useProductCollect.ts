import { useCallback, useEffect, useRef, useState } from "react";
import Taro from "@tarojs/taro";
import { getCollectProduct, delCollectProduct, updateCollectProduct } from "@/api/product/product";
import { t } from "@/utils/i18n";

export interface UseProductCollectReturn {
    /** 当前收藏状态 */
    isCollect: boolean;
    /** 切换收藏 / 取消收藏 */
    toggleCollect: () => Promise<void>;
    /** 主动刷新收藏状态 */
    fetchStatus: () => Promise<void>;
}

/**
 * 商品收藏逻辑 Hook（自 uniapp pages/product/composables/useProductCollect.ts 移植）
 *
 * @description 管理商品收藏状态的查询与切换，随 productId 变化自动刷新状态（对应旧 watchEffect）
 * @param productId 商品 ID（字符串透传，避免雪花 id 精度丢失；对应旧 Ref<string>，React 下直接传值）
 */
export function useProductCollect(productId: string): UseProductCollectReturn {
    // isCollect 会被异步回调读写，统一「state + ref 镜像」双写
    const [isCollect, setIsCollect] = useState(false);
    const isCollectRef = useRef(false);
    const setIsCollectBoth = useCallback((value: boolean) => {
        isCollectRef.current = value;
        setIsCollect(value);
    }, []);

    const fetchStatus = useCallback(async (): Promise<void> => {
        if (!productId) return;
        try {
            const result = await getCollectProduct({ id: productId });
            setIsCollectBoth(Boolean(result));
        } catch (error: any) {
            // 未登录时不提示，静默置为未收藏
            if (error?.code === 401) {
                setIsCollectBoth(false);
                return;
            }
            Taro.showToast({ title: error?.message, icon: "none" });
        }
    }, [productId, setIsCollectBoth]);

    const toggleCollect = useCallback(async (): Promise<void> => {
        try {
            if (isCollectRef.current) {
                await delCollectProduct({ id: productId });
            } else {
                await updateCollectProduct({ productId: productId });
            }
            Taro.showToast({
                title: isCollectRef.current ? t("取消收藏成功") : t("收藏成功"),
                icon: "none"
            });
            await fetchStatus();
        } catch (error: any) {
            Taro.showToast({ title: error?.message, icon: "none" });
        }
    }, [productId, fetchStatus, setIsCollectBoth]);

    // 对应旧 watchEffect(() => { if (productId.value) fetchStatus(); })
    useEffect(() => {
        if (productId) void fetchStatus();
    }, [productId, fetchStatus]);

    return { isCollect, toggleCollect, fetchStatus };
}

export default useProductCollect;
