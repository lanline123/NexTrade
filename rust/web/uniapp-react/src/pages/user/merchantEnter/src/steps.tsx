import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./steps.scss";

interface Props {
    /** 旧 :current-step（0 基索引） */
    currentStep?: number;
    /** 旧 :step-list */
    stepList?: string[];
}

/**
 * 步骤条（自旧 pages/user/merchantEnter/src/steps.vue 移植）
 * - 旧 up-steps active-color="var(--general)"、item-style fontSize 20rpx → 基础组件自绘等价视觉
 */
export default function Steps({ currentStep = 1, stepList = [] }: Props) {
    return (
        <View className="steps">
            <View className="steps-inner">
                {stepList.map((item, index) => (
                    <View className={`steps-item${index <= currentStep ? " active" : ""}`} key={index}>
                        <View className="steps-item-head">
                            {index > 0 && <View className={`steps-line steps-line-left${index <= currentStep ? " active" : ""}`} />}
                            <View className={`steps-dot${index <= currentStep ? " active" : ""}`}>{index + 1}</View>
                            <View className={`steps-line steps-line-right${index < currentStep ? " active" : ""}`} />
                        </View>
                        <Text className="steps-title">{t(item)}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}