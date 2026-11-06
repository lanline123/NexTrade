import { Text, View } from "@tarojs/components";

import "./Steps.scss";

interface Props {
    /** 旧 :current-step（0 基索引） */
    currentStep?: number;
    /** 旧 :step-list */
    stepList?: string[];
}

/**
 * 步骤条（自旧 pages/user/merchantEnter/src/steps.vue 的 up-steps 默认(number)视觉复刻）
 * - 旧 up-steps active-color="var(--general)"，item-style fontSize 20rpx
 */
export default function Steps({ currentStep = 0, stepList = [] }: Props) {
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
                        <Text className="steps-title">{item}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}