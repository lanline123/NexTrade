import { Text, View } from "@tarojs/components";

import "./Rate.scss";

interface Props {
    /** 当前评分（旧 uni-rate :value） */
    value?: number;
    /** 只读（旧 uni-rate :readonly） */
    readonly?: boolean;
    /** 星星尺寸（旧 uni-rate size，单位 px，默认 18） */
    size?: number | string;
    /** 未选中色（旧 uni-rate color） */
    color?: string;
    /** 选中色（旧 uni-rate active-color） */
    activeColor?: string;
    /** 旧 @change 的 e.value */
    onChange?: (value: number) => void;
}

/**
 * 评分（自旧 uni-rate 移植）：
 * - 旧组件 5 颗整星、allowHalf 默认关闭，点击第 n 颗即得 n 分
 * - 只读模式不响应点击
 */
export default function Rate({ value = 0, readonly = false, size = 18, color = "#bfbfbf", activeColor = "#ffa800", onChange }: Props) {
    return (
        <View className="rate-box">
            {[1, 2, 3, 4, 5].map((n) => (
                <Text
                    key={n}
                    className={`rate-item${n <= Number(value) ? " active" : ""}`}
                    style={{ fontSize: `${size}px`, color: n <= Number(value) ? activeColor : color }}
                    onClick={() => {
                        if (readonly) return;
                        onChange?.(n);
                    }}
                >
                    ★
                </Text>
            ))}
        </View>
    );
}