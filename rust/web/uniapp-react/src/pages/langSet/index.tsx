import { useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { useI18nStore } from "@/store/i18n";
import { currFullPath, isOverseas } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 海外版语言和货币设置页（自旧 pages/langSet/index.vue 移植）
 * - 提供语言切换功能，支持多国语言
 * - 提供货币切换功能，支持多种货币
 * - 切换后重新加载页面以应用新设置
 * - 清除首页装修数据缓存以获取对应语言的新数据
 */
export default function LangSet() {
    usePageGuards();

    const langCode = useI18nStore((s) => s.langCode);
    const langList = useI18nStore((s) => s.langList);
    const getLangData = useI18nStore((s) => s.getLangData);

    const currencyList = useCurrencyStore((s) => s.currencyList);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);
    const setDefaultData = useCurrencyStore((s) => s.setDefaultData);

    const setHomeDecorateData = useConfigStore((s) => s.setHomeDecorateData);
    const getBaseConfigData = useConfigStore((s) => s.getBaseConfigData);

    const [showLang, setShowLang] = useState(false);
    const [showCurrency, setShowCurrency] = useState(false);
    const [selectedLang, setSelectedLang] = useState(langCode);
    const [selectedCurrency, setSelectedCurrency] = useState<number | undefined>(currentCurrencyData.id);

    /** 非海外构建下不允许进入语言/货币页（调试直链兜底） */
    useEffect(() => {
        if (isOverseas()) return;
        Taro.navigateBack({
            fail: () => {
                Taro.switchTab({ url: "/pages/member/index" });
            }
        });
    }, []);

    const columns = useMemo(() => {
        return currencyList.map((item) => {
            return {
                label: item.symbol + " - " + item.name,
                ...item
            };
        });
    }, [currencyList]);

    const currentLang = useMemo(() => {
        const index = langList?.findIndex((item: any) => item.localeCode == langCode) ?? -1;
        if (index != -1) {
            return langList[index].language + " - " + langList[index].localeCode;
        }

        return "";
    }, [langList, langCode]);

    /** 货币未初始化时 name/symbol 为空，t(undefined) 会抛 Invalid arguments 导致整节点渲染失败 */
    const currentCurrency = useMemo(() => {
        const { symbol, name } = currentCurrencyData || ({} as any);
        if (!symbol || !name) return "";
        return `${symbol}-${t(name)}`;
    }, [currentCurrencyData]);

    /**
     * @description 重新加载当前页面
     * 用于语言或货币切换后刷新页面
     */
    const reload = () => {
        const page = currFullPath();
        // 旧 uni $page.fullPath 带前导斜杠；Taro getCurrentPages 的 router.path 不带，这里补齐
        Taro.reLaunch({
            url: page && !page.startsWith("/") ? `/${page}` : page
        });
    };

    /**
     * @description 处理语言选择变更
     * @param val 选中的语言代码
     */
    const handleChange = async (val: string) => {
        setSelectedLang(val);
    };

    /**
     * @description 确认语言切换
     * 获取新语言数据包，清除首页装修缓存，重新加载页面
     */
    const handleConfirm = async () => {
        const prevLang = langCode;
        if (prevLang === selectedLang) return;
        const shouldReload = await getLangData(selectedLang, { clearLocaleGuard: true });
        setHomeDecorateData(null as any);
        if (shouldReload) {
            await getBaseConfigData();
            reload();
        }
    };

    /**
     * @description 处理货币选择变更
     * @param val 选中的货币ID
     */
    const handleChangeCurrency = (val: string) => {
        setSelectedCurrency(Number(val));
    };

    /**
     * @description 确认货币切换
     * 设置新的默认货币并重新加载页面
     */
    const handleCurrencyConfirm = () => {
        const index = currencyList?.findIndex((item: any) => item.id == selectedCurrency) ?? -1;
        setDefaultData(currencyList[index]);
        reload();
        setShowCurrency(false);
    };

    return (
        <TigLayout title={t("国家/地区和语言")}>
            <View className="lang-menu" data-panel-rev="Z2tsbjIyODI">
                <View className="cell-wrap" onClick={() => setShowLang(true)}>
                    <View className="cell-name">{t("语言")}</View>
                    <View className="desc">{currentLang}</View>
                    <View className="right-icon">
                        <Text className="iconfont icon-xiangyou" />
                    </View>
                </View>
                <View className="cell-wrap" onClick={() => setShowCurrency(true)}>
                    <View className="cell-name">{t("货币")}</View>
                    <View className="desc">{currentCurrency}</View>
                    <View className="right-icon">
                        <Text className="iconfont icon-xiangyou" />
                    </View>
                </View>
            </View>

            {/* 旧 tig-popup v-model:show :z-index="9999"（up-popup 默认带右上角关闭）→ NutUI Popup */}
            <Popup visible={showLang} position="bottom" zIndex={9999} closeable={false} onClose={() => setShowLang(false)} style={{ backgroundColor: "#fff" } as any}>
                <View className="lang-content">
                    <View className="u-popup__content__close" onClick={() => setShowLang(false)}>
                        <View className="u-icon__icon">
                            <Text>×</Text>
                        </View>
                    </View>
                    <View className="lang-list">
                        <View className="lang-title">{t("语言")}</View>
                        {/* 旧 up-radio-group placement="column" icon-placement="left" → 自绘单选列表（u-radio 视觉） */}
                        <View className="u-radio-group">
                            <ScrollView scrollY className="lang-scroll">
                                <View className="lang-list-content">
                                    {langList.map((item) => (
                                        <View className="lang-item" key={item.id}>
                                            <View
                                                className={`u-radio${item.localeCode == selectedLang ? " active" : ""}`}
                                                onClick={() => void handleChange(item.localeCode)}
                                            >
                                                <View className="u-radio__icon-wrap">
                                                    <View className="u-icon__icon" />
                                                </View>
                                                <View className="u-radio__label-wrap">
                                                    <Text className="u-radio__text">{item.language + " - " + item.localeCode}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                        <View className="btttom">
                            {/* 旧 tig-button2 theme style="height: 65rpx" :disabled → 主题色实底按钮（TODO(MIGRATION)：tig-button2 尚无 React 版） */}
                            <View
                                className={`btn${langCode == selectedLang ? " is-disabled" : ""}`}
                                style="height: 65rpx"
                                onClick={() => {
                                    if (langCode == selectedLang) return;
                                    void handleConfirm();
                                }}
                            >
                                {t("保存")}
                            </View>
                        </View>
                    </View>
                </View>
            </Popup>

            <Popup
                visible={showCurrency}
                position="bottom"
                zIndex={9999}
                closeable={false}
                onClose={() => setShowCurrency(false)}
                style={{ backgroundColor: "#fff" } as any}
            >
                <View className="lang-content">
                    <View className="u-popup__content__close" onClick={() => setShowCurrency(false)}>
                        <View className="u-icon__icon">
                            <Text>×</Text>
                        </View>
                    </View>
                    <View className="lang-list">
                        <View className="lang-title">{t("货币")}</View>
                        {/* 旧 up-radio-group :model-value="selectedCurrency" → 自绘单选列表 */}
                        <View className="u-radio-group">
                            <ScrollView scrollY className="lang-scroll">
                                <View className="lang-list-content">
                                    {columns.map((item) => (
                                        <View className="lang-item" key={item.id}>
                                            <View
                                                className={`u-radio${item.id == selectedCurrency ? " active" : ""}`}
                                                onClick={() => handleChangeCurrency(String(item.id))}
                                            >
                                                <View className="u-radio__icon-wrap">
                                                    <View className="u-icon__icon" />
                                                </View>
                                                <View className="u-radio__label-wrap">
                                                    <Text className="u-radio__text">{t(item.label)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                        <View className="btttom">
                            <View
                                className={`btn${selectedCurrency == currentCurrencyData.id ? " is-disabled" : ""}`}
                                style="height: 65rpx"
                                onClick={() => {
                                    if (selectedCurrency == currentCurrencyData.id) return;
                                    handleCurrencyConfirm();
                                }}
                            >
                                {t("保存")}
                            </View>
                        </View>
                    </View>
                </View>
            </Popup>
        </TigLayout>
    );
}