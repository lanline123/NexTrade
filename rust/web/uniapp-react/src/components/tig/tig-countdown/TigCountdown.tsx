import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import "./TigCountdown.scss";

interface Props {
    color?: string;
    backgroundColor?: string;
    splitorColor?: string;
    startTime?: string;
    endTime?: string;
    fontSize?: number;
}

/**
 * 倒计时（自旧 tig/tig-countdown/tig-countdown.vue 移植）：
 * - 旧组件内部是 uni-countdown（uni-ui），props 一一对应；
 * - 旧实现 countdownInit 仅在初始化时计算一次、无定时器刷新，此处保持同行为（不做每秒刷新）；
 * - uni-countdown 源码不在本仓库内，数字块/分隔符视觉按其默认样式（44rpx 行高、
 *   数字补零两位、块状背景色）复刻，TODO(MIGRATION)：如与线上视觉有出入再校准。
 */
export default function TigCountdown({
    color = "#fff",
    backgroundColor = "",
    splitorColor = "#fff",
    startTime: _startTime,
    endTime = "",
    fontSize = 12
}: Props) {
    const pad2 = (num: number) => String(num).padStart(2, "0");

    /* 转时间戳（与旧 dateStringToTimestamp 同逻辑：仅支持 "YYYY-MM-DD HH:mm:ss"） */
    const dateStringToTimestamp = (dateString: string) => {
        const dateParts = dateString.split(" ");
        const [year, month, day] = dateParts[0].split("-");
        const [hour, minute, second] = dateParts[1].split(":");
        const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
        return date.getTime();
    };

    /* 计算时间： endTime → days/hours/minutes/seconds（仅初始化计算一次，与旧实现一致） */
    const countdown = useMemo(() => {
        const result = { days: 0, hours: 0, minutes: 0, seconds: 0 };
        if (!endTime || !endTime.includes(" ")) {
            return result;
        }
        const endTimestamp = dateStringToTimestamp(endTime);
        const nowTimestamp = new Date().getTime();
        let diffMilliseconds = endTimestamp - nowTimestamp;
        if (diffMilliseconds > 0) {
            // 转换为天、时、分、秒
            result.days = Math.floor(diffMilliseconds / (1000 * 60 * 60 * 24));
            diffMilliseconds -= result.days * (1000 * 60 * 60 * 24);
            result.hours = Math.floor(diffMilliseconds / (1000 * 60 * 60));
            diffMilliseconds -= result.hours * (1000 * 60 * 60);
            result.minutes = Math.floor(diffMilliseconds / (1000 * 60));
            diffMilliseconds -= result.minutes * (1000 * 60);
            result.seconds = Math.floor(diffMilliseconds / 1000);
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endTime]);

    const timeStyle = useMemo(
        () => ({
            backgroundColor,
            color,
            fontSize: `${fontSize}px`
        }),
        [backgroundColor, color, fontSize]
    );

    const splitorStyle = useMemo(
        () => ({
            color: splitorColor,
            fontSize: `${fontSize}px`
        }),
        [splitorColor, fontSize]
    );

    const showDay = countdown.days > 0;

    return (
        <View className="tig-countdown">
            {/* 旧模板：uni-countdown（show-day=days>0，数字块 + ":" 分隔符，数字补零两位） */}
            {showDay ? (
                <View className="tig-countdown__number" style={timeStyle}>
                    {pad2(countdown.days)}
                </View>
            ) : null}
            {showDay ? (
                <Text className="tig-countdown__splitor" style={splitorStyle}>
                    :
                </Text>
            ) : null}
            <View className="tig-countdown__number" style={timeStyle}>
                {pad2(countdown.hours)}
            </View>
            <Text className="tig-countdown__splitor" style={splitorStyle}>
                :
            </Text>
            <View className="tig-countdown__number" style={timeStyle}>
                {pad2(countdown.minutes)}
            </View>
            <Text className="tig-countdown__splitor" style={splitorStyle}>
                :
            </Text>
            <View className="tig-countdown__number" style={timeStyle}>
                {pad2(countdown.seconds)}
            </View>
        </View>
    );
}
