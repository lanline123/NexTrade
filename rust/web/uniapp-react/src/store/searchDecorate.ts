import { create } from "zustand";

import { getH5SearchDecorate } from "@/api/home/home";
import { useI18nStore } from "@/store/i18n";
import type { SearchResultModuleData } from "@/components/modules/search-result/types";
import { searchResultDefaults, mergeConfig } from "@/components/modules/search-result/config";

type SearchDecorateModule = {
    type?: string;
    module?: unknown;
};

type SearchDecorateResponse = {
    data?: {
        moduleList?: SearchDecorateModule[];
    };
    moduleList?: SearchDecorateModule[];
};

interface SearchDecorateState {
    config: SearchResultModuleData;
    isLoaded: boolean;
    /**
     * 后台是否真的配置过搜索页装修。
     * 未配置时主题色/背景色等「会改变现有观感」的字段一律不下发，页面与接入装修前完全一致；
     * 只有配置过才整体按装修渲染。
     */
    hasDecorate: boolean;
    /** 预览模式每次都重新拉取（草稿会变），正式模式全局只拉一次 */
    fetchConfig: (previewId?: string | number) => Promise<void>;
    reset: () => void;
}

/**
 * 搜索页装修配置（Decorate 页 H5 + pageType=6）（自旧 store/searchDecorate.ts Pinia 移植为 zustand）
 * - 搜索入口页与结果页共用同一份配置
 * - 接口缺失 / 未配置时全程走默认值，页面样式与接入前一致
 */
export const useSearchDecorateStore = create<SearchDecorateState>((set, get) => {
    let pending: Promise<void> | null = null;
    let requestVersion = 0;

    const hasPreviewId = (id?: string | number) => {
        return id !== undefined && id !== null && id !== "" && id !== 0 && id !== "0";
    };

    const fetchConfig = async (previewId?: string | number) => {
        const isPreviewMode = hasPreviewId(previewId);
        if (!isPreviewMode) {
            if (get().isLoaded) return;
            if (pending) return pending;
        }

        const requestTask = (async () => {
            const currentVersion = requestVersion;
            try {
                const result = (await getH5SearchDecorate(isPreviewMode ? previewId : undefined)) as SearchDecorateResponse;
                const moduleList = result?.data?.moduleList || result?.moduleList || [];
                const target = moduleList.find((m) => m?.type === "mobileSearchResult") || moduleList[0];

                let data = target?.module;
                if (typeof data === "string") {
                    try {
                        data = JSON.parse(data as string);
                    } catch {
                        /* 后端偶发返回 JSON 字符串，解析失败时走默认值 */
                    }
                }
                // 语言切换后，旧语言请求即使晚返回也不能覆盖新语言配置。
                if (currentVersion !== requestVersion) return;
                if (data && typeof data === "object") {
                    set({ config: mergeConfig(data as Partial<SearchResultModuleData>), hasDecorate: true });
                }
            } catch (error) {
                console.error("获取搜索页装修配置失败:", error);
            } finally {
                if (currentVersion === requestVersion) {
                    set({ isLoaded: true });
                    if (!isPreviewMode) {
                        pending = null;
                    }
                }
            }
        })();

        if (isPreviewMode) {
            return requestTask;
        }

        pending = requestTask;
        return pending;
    };

    const reset = () => {
        requestVersion += 1;
        pending = null;
        set({ config: { ...searchResultDefaults }, isLoaded: false, hasDecorate: false });
    };

    // 跨境语言切换后，搜索页装修接口可能返回另一套模板。
    // 清掉内存缓存，等下次进入搜索页时再按当前语言重新拉取。
    // （对应旧 Pinia setup store 内的 watch；zustand 在模块层订阅）
    useI18nStore.subscribe((state, prevState) => {
        if (!state.langCode || !prevState.langCode || state.langCode === prevState.langCode) return;
        reset();
    });

    return {
        config: { ...searchResultDefaults },
        isLoaded: false,
        hasDecorate: false,
        fetchConfig,
        reset
    };
});
