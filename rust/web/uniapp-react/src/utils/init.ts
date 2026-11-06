import { useConfigStore } from "@/store/config";
import { useTabbarStore } from "@/store/tabbar";
import { useThemeStore } from "@/store/theme";
import { useUserStore } from "@/store/user";
import { isOverseas } from "@/utils";
import { useI18nStore } from "@/store/i18n";
import { useCurrencyStore } from "@/store/currency";
import { setIsInit } from "@/utils/request";

export default async function init() {
    const i18nStore = useI18nStore.getState();
    if (isOverseas()) {
        try {
            if (!i18nStore.isCache()) {
                await i18nStore.init();
            } else {
                // 有缓存时不阻塞启动，后台拉取最新词条
                i18nStore.refreshLangData();
            }
        } catch (error) {
            console.error("初始化多语言失败:", error);
        }
    } else {
        // 非跨境版本默认使用中文
        i18nStore.setLangCode("zh");
    }
    const arr: Promise<unknown>[] = [
        useConfigStore.getState().getBaseConfigData(),
        useTabbarStore.getState().getTabbarList(),
        useThemeStore.getState().getThemeSettings(),
        useUserStore.getState().getServiceConfigData()
    ];
    arr.push(useI18nStore.getState().getLangListData(), useCurrencyStore.getState().fetchCurrencyList());

    try {
        await Promise.all(arr);
    } catch (error) {
        console.error("Initialization failed:", error);
    } finally {
        setIsInit(false);
    }
}
