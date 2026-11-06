import type { CSSProperties } from "react";
import { Image, View } from "@tarojs/components";

import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./Guide.scss";

interface Props {
    /** 旧 v-model */
    modelValue?: boolean;
    onUpdateModelValue?: (value: boolean) => void;
}

/** 小程序端（旧 #ifdef MP-WEIXIN）判定 */
const isWeapp = process.env.TARO_ENV === "weapp";

/**
 * 分享引导遮罩（自旧 pages/giftCard/src/guide.vue 移植）
 * - 旧 uni-transition（fade + slide-top）→ CSS keyframes 等价动画
 * - 小程序端文案与箭头按胶囊按钮位置避让
 */
export default function Guide({ modelValue = false, onUpdateModelValue }: Props) {
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);

    if (!modelValue) return null;

    // 旧 :styles 绑定值
    const transitionStyle = {
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        width: "100vw",
        height: "auto"
    } as CSSProperties;

    // 旧 v-bind("iconInfo.bottom + 5 + 'px'") 等 → CSS 变量（仅小程序端）
    const guideStyle = (
        isWeapp
            ? {
                  "--guide-content-top": `${menuButtonInfo.bottom + 5}px`,
                  "--guide-img-padding-right": `${menuButtonInfo.width - 15}px`
              }
            : {}
    ) as CSSProperties;

    return (
        <View className="guide-box" onClick={() => onUpdateModelValue?.(false)}>
            <View className="transition" style={transitionStyle}>
                <View className={`guide-content${isWeapp ? " is-weapp" : ""}`} style={guideStyle}>
                    <View className="guide-img-box">
                        <Image className="guide-img" src={staticResource("common/share_arrow.png")} />
                    </View>
                    <View className="guide-text"> {t("立即分享给好友吧")} </View>
                    <View> {t("点击屏幕右上角将本页面分享给好友")} </View>
                </View>
            </View>
        </View>
    );
}