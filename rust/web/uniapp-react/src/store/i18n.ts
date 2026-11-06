/**
 * @description 多语言状态管理（Taro + i18next 版）
 * - langList: 可用语言列表
 * - langCode: 当前语言代码
 * - 支持从本地缓存恢复语言设置
 * - 支持动态获取和切换语言数据包
 *
 * 迁移说明（相对旧 uniapp 版本的简化）：
 * - 旧版需要把语言代码映射到 uni 框架 locale（uni.setLocale）并处理 Android 端
 *   框架重启循环（LOCALE_SYNCED_KEY 守卫）。Taro 下 i18next 就是唯一 locale 来源，
 *   changeLanguage 纯内存切换不会重启应用，整套同步/守卫机制移除；
 *   syncFrameworkLocale / willFrameworkLocaleChange 保留空实现兼容旧调用点。
 */
import Taro from "@tarojs/taro";
import { create } from "zustand";

import { getLang, getLangList, getDefaultLang } from "@/api/common";
import i18nextInstance from "@/i18n";
import { localMessages } from "@/locale/index";
import type { LangListItem } from "@/types/common";

/** Taro 无框架 locale 同步，空实现兼容旧调用点 */
export const syncFrameworkLocale = (_localeCode: string) => false;
/** Taro 无框架 locale 同步，永远返回 false（切换语言不会重启应用） */
export function willFrameworkLocaleChange(_localeCode: string): boolean {
    return false;
}
export function clearLocaleSyncGuard() {}

/** 系统语言提示（替代旧方案的 uni.getLocale()） */
function systemLanguageHint(): string {
    try {
        return Taro.getSystemInfoSync().language || "zh";
    } catch {
        return "zh";
    }
}

export interface I18nState {
    langList: LangListItem[];
    langCode: string;
    isCache: () => boolean;
    init: () => Promise<void>;
    getLangListData: () => Promise<void>;
    getLangData: (localeCode: string, options?: { clearLocaleGuard?: boolean }) => Promise<boolean>;
    refreshLangData: () => Promise<void>;
    getDefaultLangConfig: () => Promise<void>;
    setLangCode: (localeCode: string, options?: { skipFrameworkSync?: boolean }) => void;
    setLangData: (localeCode: string, langData: Record<string, string>) => void;
    clearCache: () => void;
}

interface CachedLang {
    localeCode: string;
    langData: Record<string, string>;
}

export const useI18nStore = create<I18nState>((set, get) => ({
    langList: [],
    langCode: Taro.getStorageSync("langCode") || "",

    /**
     * @description 检查本地是否有语言缓存
     * 如果有缓存则直接使用，避免重复请求
     */
    isCache() {
        const cached = Taro.getStorageSync("localeLang") as CachedLang | "";
        if (cached && cached.localeCode && cached.langData) {
            const storedLangCode = get().langCode || Taro.getStorageSync("langCode") || "";
            // langCode 已更新但 localeLang 未落盘（旧端中断切换）时，丢弃旧缓存
            if (storedLangCode && storedLangCode !== cached.localeCode) {
                return false;
            }
            get().setLangData(cached.localeCode, cached.langData);
            get().setLangCode(cached.localeCode);
            return true;
        }
        return false;
    },

    /**
     * @description 初始化语言设置
     * 如果本地有语言代码则获取对应语言包，否则获取默认语言配置
     */
    async init() {
        if (!get().langCode) {
            await get().getDefaultLangConfig();
        } else {
            await get().getLangData(get().langCode, { clearLocaleGuard: true });
        }
    },

    /**
     * @description 获取可用语言列表
     */
    async getLangListData() {
        try {
            const result = await getLangList();
            set({ langList: result });
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * @description 获取指定语言的数据包
     * @param localeCode 语言代码（如 zh-CN, en-US）
     * @returns 切换完成后是否需要刷新页面（Taro 下 i18next 响应式更新，恒为 true）
     */
    async getLangData(localeCode: string, _options?: { clearLocaleGuard?: boolean }): Promise<boolean> {
        try {
            const result = await getLang(localeCode);
            get().setLangData(localeCode, result);
            get().setLangCode(localeCode);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    },

    /**
     * @description 后台静默刷新当前语言包
     * 命中缓存时先用缓存渲染，再拉取后台最新词条覆盖，避免后台新增翻译永远不生效
     */
    async refreshLangData() {
        const localeCode = get().langCode;
        if (!localeCode) return;
        try {
            const result = await getLang(localeCode);
            // 请求期间用户已切换语言则丢弃结果
            if (result && get().langCode === localeCode) {
                get().setLangData(localeCode, result);
            }
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * @description 获取默认语言配置（根据系统语言）
     */
    async getDefaultLangConfig() {
        try {
            const result = await getDefaultLang(systemLanguageHint());
            if (!result || !result.localeCode) {
                console.warn("Default language config is empty, skipping i18n init");
                return;
            }
            await get().getLangData(result.localeCode);
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * @description 设置当前语言代码（同步到 storage 和 i18next）
     */
    setLangCode(localeCode: string) {
        set({ langCode: localeCode });
        Taro.setStorageSync("langCode", localeCode);
        void i18nextInstance.changeLanguage(localeCode);
    },

    /**
     * @description 设置语言数据包（更新 i18next 与本地缓存）
     * 以后台词条覆盖内置兜底词条，deep merge 进 i18next 的 translation 命名空间
     */
    setLangData(localeCode: string, langData: Record<string, string>) {
        const baseLocale = localeCode.startsWith("zh") ? "zh" : localeCode.startsWith("en") ? "en" : "zh";
        const merged = { ...(localMessages[baseLocale] || {}), ...langData };
        i18nextInstance.addResourceBundle(localeCode, "translation", merged, true, true);
        if (i18nextInstance.language !== localeCode) {
            void i18nextInstance.changeLanguage(localeCode);
        }
        const payload: CachedLang = { langData, localeCode };
        set({ langCode: localeCode });
        Taro.setStorageSync("localeLang", payload);
        Taro.setStorageSync("langCode", localeCode);
    },

    /**
     * @description 清除语言缓存
     */
    clearCache() {
        set({ langCode: "", langList: [] });
        Taro.removeStorageSync("langCode");
        Taro.removeStorageSync("localeLang");
        clearLocaleSyncGuard();
    }
}));
