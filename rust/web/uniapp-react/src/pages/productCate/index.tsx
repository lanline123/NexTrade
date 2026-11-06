import { useEffect, useMemo, useState } from "react";
import { View } from "@tarojs/components";
import { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { setPageMeta } from "@/utils/seo";
import { useConfigStore } from "@/store/config";
import { useTabbarDerived } from "@/store/tabbar";

import { getH5CategoryDecorate } from "@/api/home/home";
import { handleDecorateLoadError } from "@/utils/handleDecorateLoadError";

import type { CateCenterV1Data } from "@/components/modules/cate-center/cate-center-v1/types";
import type { CateCenterV2Data } from "@/components/modules/cate-center/cate-center-v2/types";
import { cateCenterV1Defaults } from "@/components/modules/cate-center/cate-center-v1/config";
import { cateCenterV2Defaults } from "@/components/modules/cate-center/cate-center-v2/config";

import StyleOneCate from "./styleOneCate";
import StyleTwoCate from "./styleTwoCate";
import StyleThreeCate from "./styleThreeCate";

import "./index.scss";

/**
 * 商品分类页（自旧 pages/productCate/index.vue 移植）
 * - 优先读后台分类页装修（pageType=4）：cateCenterV1 / cateCenterV2
 * - 未配置时降级到全局 configStore.categoryDecorateType
 */
export default function ProductCate() {
    const router = useRouter();

    const configStoreCategoryDecorateType = useConfigStore((s) => s.categoryDecorateType);
    const configStoreShopTitle = useConfigStore((s) => s.baseInfo.shopTitle);
    const configStoreScreenHeight = useConfigStore((s) => s.windowInfo.screenHeight);
    // currentActiveValue 为 tabbar 派生值（旧 pinia computed → useTabbarDerived hook）
    const { currentActiveValue: tabbarCurrentActiveValue } = useTabbarDerived();

    const [catId, setCatId] = useState(0);
    const [previewId, setPreviewId] = useState<string | number>("");

    const [moduleConfigV1, setModuleConfigV1] = useState<CateCenterV1Data>({ ...cateCenterV1Defaults });
    const [moduleConfigV2, setModuleConfigV2] = useState<CateCenterV2Data>({ ...cateCenterV2Defaults });

    const [decorateStyleType, setDecorateStyleType] = useState<number | null>(null);
    const [decorateLoaded, setDecorateLoaded] = useState(false);

    const effectiveStyleType = decorateStyleType ?? configStoreCategoryDecorateType;

    /**
     * 把后台 JSON 反序列化产生的"true"/"false"/"1"/"0" 等字符串值统一转回真实类型。
     * 后端 module 字段以 JSON 字符串存储，反序列化后所有原生 boolean/number 都会变成字符串，
     * 在前端使用前必须规范化，避免类似 `showRecommend !== false` 这种判断失效。
     */
    const normalizeModuleValues = (raw: Record<string, any> | undefined | null): Record<string, any> => {
        if (!raw || typeof raw !== "object") return {};
        const result: Record<string, any> = {};
        Object.keys(raw).forEach((key) => {
            const val = raw[key];
            if (typeof val === "string") {
                if (val === "true") {
                    result[key] = true;
                } else if (val === "false") {
                    result[key] = false;
                } else if (val !== "" && !isNaN(Number(val)) && /^-?\d+(\.\d+)?$/.test(val)) {
                    result[key] = Number(val);
                } else {
                    result[key] = val;
                }
            } else {
                result[key] = val;
            }
        });
        return result;
    };

    /**
     * 拉取分类页装修配置
     * 接口：home/home/h5Category，预览模式通过 previewId 参数区分
     */
    const fetchCategoryDecorate = async () => {
        try {
            const result: any = await getH5CategoryDecorate(previewId);
            const moduleList: any[] = result?.moduleList || result?.data?.moduleList || [];

            for (const m of moduleList) {
                let data: any = m?.module;
                if (typeof data === "string") {
                    try {
                        data = JSON.parse(data);
                    } catch {
                        // ignore
                    }
                }
                const normalized = normalizeModuleValues(data);
                if ((m?.type === "cate-center-v1" || m?.type === "cateCenterV1") && Object.keys(normalized).length > 0) {
                    setModuleConfigV1({ ...cateCenterV1Defaults, ...normalized });
                    setDecorateStyleType(1);
                }
                if ((m?.type === "cate-center-v2" || m?.type === "cateCenterV2") && Object.keys(normalized).length > 0) {
                    setModuleConfigV2({ ...cateCenterV2Defaults, ...normalized });
                    setDecorateStyleType(normalized.styleType ?? 2);
                }
            }
        } catch (error) {
            if (await handleDecorateLoadError(error)) return;
            console.error("获取分类页装修配置失败:", error);
        } finally {
            setDecorateLoaded(true);
        }
    };

    // 对应旧 onLoad（useRouter.params + useEffect）
    useEffect(() => {
        const options: any = router.params;
        setPreviewId(options?.previewId ?? "");
        if (options && options.categoryId) {
            setCatId(options.categoryId);
        }
        void fetchCategoryDecorate();
        if (process.env.TARO_ENV === "h5") {
            setPageMeta({
                title: `商品分类 - ${configStoreShopTitle}`,
                description: `浏览${configStoreShopTitle}的全部商品分类`,
                type: "website"
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onShow 里的 uni.hideTabBar：React 版 tabbar 由 TigLayout 自定义渲染（TigTabbar），
    // 不存在原生 tabBar，无需隐藏。

    /** 分类样式二/三的滚动区高度：视口高 - tabbar(或安全区) - 导航 */
    const height = useMemo(() => {
        return `calc(${configStoreScreenHeight}px - var(${tabbarCurrentActiveValue > -1 ? "--tabbar-height" : "--safe-bottom"}) - var(--nav-height))`;
    }, [configStoreScreenHeight, tabbarCurrentActiveValue]);

    return (
        <TigLayout>
            {decorateLoaded && (
                <>
                    {effectiveStyleType === 1 && <StyleOneCate catId={catId} onCatIdChange={setCatId} module={moduleConfigV1} />}
                    {effectiveStyleType === 2 && <StyleTwoCate height={height} module={moduleConfigV2} />}
                    {effectiveStyleType === 3 && <StyleThreeCate height={height} module={moduleConfigV2} />}
                </>
            )}
        </TigLayout>
    );
}
