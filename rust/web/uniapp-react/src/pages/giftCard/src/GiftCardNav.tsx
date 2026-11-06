import type { CSSProperties } from "react";
import { useMemo } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./GiftCardNav.scss";

interface Props {
    /** 旧 v-model：页面滚动距离 */
    modelValue?: number;
    activeModule?: string;
    event?: (val: string) => void;
    title?: string;
}

/** 小程序端（旧 #ifdef MP-WEIXIN）判定 */
const isWeapp = process.env.TARO_ENV === "weapp";

/**
 * 礼品卡订单详情顶部导航（自旧 pages/giftCard/src/giftCardNav.vue 移植）
 * - 滚动超过阈值后显示白色背景，透明度随滚动距离线性过渡
 * - 小程序端按胶囊按钮位置计算图标与标题栏高度
 */
export default function GiftCardNav({ modelValue = 0, activeModule = "", event, title = "" }: Props) {
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);

    const moduleList = useMemo(
        () => [
            {
                label: title,
                value: ".product-detail-area"
            }
        ],
        [title]
    );

    const contentThresholdValue = 50;

    const contentOpacity = useMemo(() => {
        let opacity = 0;
        if (modelValue > contentThresholdValue) {
            opacity = 1;
        } else if (modelValue < contentThresholdValue && modelValue > 0) {
            opacity = modelValue / contentThresholdValue;
        }
        return opacity;
    }, [modelValue]);

    const handleClick = (val: string) => {
        event?.(val);
    };

    const handleBack = () => {
        // 旧 #ifdef H5：H5 走浏览器返回
        if (process.env.TARO_ENV === "h5") {
            history.back();
            return;
        }
        // 旧 #ifndef H5
        Taro.navigateBack();
    };

    // 旧 v-bind("iconInfo.top + 'px'") 等 → CSS 变量（仅小程序端生效）
    const navStyle = (
        isWeapp
            ? {
                  "--capsule-top": `${menuButtonInfo.top}px`,
                  "--capsule-height": `${menuButtonInfo.height}px`,
                  "--capsule-padding-right": `${menuButtonInfo.width + 40}px`,
                  "--capsule-right": `${menuButtonInfo.width + 20}px`
              }
            : {}
    ) as CSSProperties;

    return (
        <>
            <View className="product-nav" style={navStyle}>
                <View className="product-nav-container">
                    <View className={`product-nav-left product-nav-icon${isWeapp ? " is-weapp" : ""}`} onClick={handleBack}>
                        <Text className="iconfont icon-houtui" />
                    </View>
                    <View className="product-nav-bg" style={{ opacity: contentOpacity }} />
                    <View className={`product-nav-middle${isWeapp ? " is-weapp" : ""}`}>
                        {moduleList.map((item) => (
                            <View
                                key={item.label}
                                className={`middle-text${item.value === activeModule ? " active" : ""}`}
                                onClick={() => handleClick(item.value)}
                            >
                                {t(item.label)}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
            <View className="placeholder" />
        </>
    );
}