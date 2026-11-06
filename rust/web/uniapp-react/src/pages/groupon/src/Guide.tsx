import { Image, Text, View } from "@tarojs/components";

import { staticResource } from "@/utils";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./Guide.scss";

/**
 * 拼团分享引导组件（自旧 pages/groupon/src/guide.vue 移植）
 * - 引导用户分享拼团到微信
 * - 旧 <uni-transition mode-class="['fade','slide-top']"> 以等价 CSS 动画复刻
 */
interface Props {
    /** 对应旧 v-model */
    modelValue: boolean;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

export default function GrouponGuide({ modelValue, onChange }: Props) {
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);

    // 旧 scss 中 #ifdef MP-WEIXIN 的 v-bind 表达式改为内联 style
    const isWeapp = process.env.TARO_ENV === "weapp";
    const contentStyle = isWeapp ? { top: `${menuButtonInfo.bottom + 5}px` } : undefined;
    const imgBoxStyle = isWeapp ? { paddingRight: `${menuButtonInfo.width - 15}px` } : undefined;

    if (!modelValue) return null;

    return (
        <View className="guide-box" onClick={() => onChange?.(false)}>
            <View className="transition guide-transition">
                <View className="guide-content" style={contentStyle}>
                    <View className="guide-img-box" style={imgBoxStyle}>
                        <Image className="guide-img" src={staticResource("common/share_arrow.png")} />
                    </View>
                    <View className="guide-text"> {t("立即分享给好友吧")} </View>
                    <View> {t("点击屏幕右上角将本页面分享给好友")} </View>
                </View>
            </View>
        </View>
    );
}