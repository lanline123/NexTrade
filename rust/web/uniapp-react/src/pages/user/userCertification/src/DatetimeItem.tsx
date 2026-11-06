import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./DatetimeItem.scss";

interface Props {
    /** 旧 modelValue（type=1 为字符串，type=2 为 [开始, 结束]） */
    modelValue?: string | string[] | any;
    /** 1=单日期，2=日期区间 */
    type?: number;
    disabled?: boolean;
    onClick?: () => void;
}

/**
 * 日期展示项（自旧 pages/user/src/datetimeItem.vue 逐行移植）
 * - 左侧日历图标 + 右侧日期文本（区间类型显示 "开始 - 结束"）
 * - disabled 时不触发点击
 */
export default function DatetimeItem({ modelValue = "", type = 1, disabled = false, onClick }: Props) {
    const handleTap = () => {
        if (disabled) return;
        onClick?.();
    };

    return (
        <View className={`datetime-item${disabled ? " disabled" : ""}`} onClick={handleTap}>
            <Text className="iconfont-h5 icon-riqi" />
            {type === 1 ? (
                <View className="datetime-item-text" style="text-align: left">
                    {modelValue ? modelValue : t("选择日期")}
                </View>
            ) : (
                <>
                    <View className="datetime-item-text">{modelValue && modelValue[0] ? modelValue[0] : t("开始日期")}</View>
                    -
                    <View className="datetime-item-text">{modelValue && modelValue[1] ? modelValue[1] : t("结束日期")}</View>
                </>
            )}
        </View>
    );
}