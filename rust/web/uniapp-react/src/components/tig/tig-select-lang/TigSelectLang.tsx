import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { ScrollView, Text, View } from "@tarojs/components";
import { ConfigProvider, Popup, Picker } from "@nutui/nutui-react-taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { useI18nStore } from "@/store/i18n";
import { currFullPath } from "@/utils";
import { t } from "@/utils/i18n";

import "./TigSelectLang.scss";

export interface TigSelectLangRef {
    handleclickLang: () => void;
}

interface Props {
    /** 是否渲染默认地球图标触发器（旧 :show-lang-btn，banner 模块自绘触发器时传 false） */
    showLangBtn?: boolean;
    /** 自定义触发器（旧 slot） */
    children?: React.ReactNode;
}

/**
 * 跨境语言/货币切换弹层（自旧 components/tig/tig-select-lang/tig-select-lang.vue 逐行移植）
 * - 默认触发器：地球图标（showLangBtn=false 时由外部经 ref 调 handleclickLang）
 * - 语言弹层：底部弹窗（z-index 9999、50vh），单选列表立即切换并 reLaunch
 * - 底部货币栏：当前货币 + 去切换 → up-picker 车轮选择器 → setDefaultData + reLaunch
 * - 旧 up-radio-group active-color="var(--general)"：旧项目未定义该变量，此处落到 NutUI 品牌色
 */
const TigSelectLang = forwardRef<TigSelectLangRef, Props>(function TigSelectLang({ showLangBtn = true, children }, ref) {
    const langList = useI18nStore((s) => s.langList);
    const langCode = useI18nStore((s) => s.langCode);
    const getLangData = useI18nStore((s) => s.getLangData);

    const currencyList = useCurrencyStore((s) => s.currencyList);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);
    const setDefaultData = useCurrencyStore((s) => s.setDefaultData);

    const getBaseConfigData = useConfigStore((s) => s.getBaseConfigData);

    const [show, setShow] = useState(false);
    const [showCurrency, setShowCurrency] = useState(false);

    useImperativeHandle(ref, () => ({
        handleclickLang: () => setShow(true)
    }));

    /** 旧 columns：symbol - name + 展开 item（NutUI Picker 需要 value，取货币 id） */
    const pickerOptions = useMemo(() => {
        return currencyList.map((item) => ({
            label: `${item.symbol} - ${item.name}`,
            value: item.id
        }));
    }, [currencyList]);

    const defaultIndex = useMemo(() => {
        return currencyList.findIndex((item) => item.id === currentCurrencyData?.id);
    }, [currencyList, currentCurrencyData]);

    const reload = () => {
        const page = currFullPath();
        // 旧 uni $page.fullPath 带前导斜杠；Taro router.path 不带，这里补齐
        Taro.reLaunch({
            url: page && !page.startsWith("/") ? `/${page}` : page
        });
    };

    /** 旧 handleChange：选中即切换语言包 → 刷新基础配置 → reLaunch（无确认按钮） */
    const handleChange = async (val: string) => {
        setShow(false);
        const shouldReload = await getLangData(val);
        if (!shouldReload) return;
        await getBaseConfigData();
        reload();
    };

    /** 旧 handleclickCurrency：先关语言弹层，nextTick 后开车轮选择器 */
    const handleclickCurrency = () => {
        setShow(false);
        setTimeout(() => {
            setShowCurrency(true);
        }, 100);
    };

    /** 旧 handleConfirm：setDefaultData(val.value[0]) + reLaunch */
    const handleConfirm = (selectedOptions: { value: unknown }[], _selectedValue: unknown[]) => {
        const picked = selectedOptions?.[0]?.value;
        const target = currencyList.find((item) => item.id === picked);
        if (target) {
            setDefaultData(target);
        }
        setShowCurrency(false);
        reload();
    };

    return (
        <View className="tig-select-lang">
            {showLangBtn && (
                <View className="lang-box" onClick={() => setShow(true)}>
                    {children || (
                        <View className="lang-icon-box">
                            <View className="iconfont-h5 icon-diqiu">
                                <Text className="iconfont-h5 icon-sanjiaoright" />
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* 旧 tig-popup v-model:show :z-index="9999"（bottom/round/#fff/closeable）→ NutUI Popup */}
            <Popup
                visible={show}
                position="bottom"
                zIndex={9999}
                round
                closeable
                onClose={() => setShow(false)}
                style={{ backgroundColor: "#fff" } as React.CSSProperties}
            >
                <View className="lang-content">
                    <View className="lang-list">
                        <View className="lang-title">{t("选择语言")}</View>
                        {/* 旧 up-radio-group placement="column" icon-placement="right" → 自绘单选列表（label 左 / 圆点右） */}
                        <ScrollView scrollY className="lang-scroll">
                            <View className="lang-list-content">
                                {langList.map((item) => (
                                    <View className="lang-item" key={item.id}>
                                        <View
                                            className={`lang-radio${item.localeCode === langCode ? " active" : ""}`}
                                            onClick={() => void handleChange(item.localeCode)}
                                        >
                                            <Text className="lang-radio__label">{item.language + " - " + item.localeCode}</Text>
                                            <View className="lang-radio__icon" />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                    {/* 旧 tig-fixed-placeholder height="50px" background-color="#fff" */}
                    <FixedPlaceholder height="50px" backgroundColor="#fff">
                        <View className="currency-box" onClick={handleclickCurrency}>
                            {t("当前货币")}
                            {/* 货币未初始化时 symbol/name 为 undefined，避免渲染出 "undefined-undefined" */}
                            <Text className="currency-box-unit">
                                {currentCurrencyData?.symbol && currentCurrencyData?.name
                                    ? currentCurrencyData.symbol + "-" + currentCurrencyData.name
                                    : ""}
                            </Text>
                            <Text className="currency-box-text">{t("去切换")}</Text>
                        </View>
                    </FixedPlaceholder>
                </View>
            </Popup>

            {/* 旧 up-picker :columns="[columns]" key-name="label" :default-index="[defaultIndex]" close-on-click-overlay
                → NutUI Picker；取消/确认文案随语言走（ConfigProvider locale） */}
            <ConfigProvider locale={(langCode.startsWith("zh") ? "zh-CN" : "en-US") as never}>
                <Picker
                    visible={showCurrency}
                    options={[pickerOptions]}
                    defaultValue={defaultIndex > -1 ? [currencyList[defaultIndex].id] : undefined}
                    closeOnOverlayClick
                    onClose={() => setShowCurrency(false)}
                    onCancel={() => setShowCurrency(false)}
                    onConfirm={handleConfirm as never}
                />
            </ConfigProvider>
        </View>
    );
});

export default TigSelectLang;
