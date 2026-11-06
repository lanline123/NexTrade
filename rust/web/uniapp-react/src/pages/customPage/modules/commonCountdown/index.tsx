import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    countdownType?: string;
    dailyTime?: any;
    specifyTime?: string | number;
    format?: string;
    color?: string;
    zh?: boolean;
    timeStyle?: Record<string, any>;
    unitStyle?: Record<string, any>;
    valueStyle?: Record<string, any>;
    /** 作用域插槽（旧 components/commonCountdown 的 $slots.default）：传入时仅渲染 children({days,hours,minutes,seconds}) */
    children?: (data: { days: number; hours: number; minutes: number; seconds: number }) => ReactNode;
}

const timeDateMap: { [key: string]: string } = {
    DD: "days",
    HH: "hours",
    mm: "minutes",
    ss: "seconds"
};

// 中文单位后缀（zh=true 时替代 ":" 分隔符）
const textMap: { [key: string]: string } = {
    DD: t("天"),
    HH: t("时"),
    mm: t("分"),
    ss: t("秒")
};

/**
 * 通用倒计时（自旧 commonCountdown/index.vue 移植）。
 * 旧实现基于 uview 的 up-count-down（change 事件回传 timeData），
 * React 版内建毫秒→天/时/分/秒换算并每秒刷新，对外渲染结构一致。
 * 注意：up-count-down 的 hours/minutes/seconds 均按「除大单位取余」口径计算
 * （如 format 无 DD 时，24h 以上会以 0~23 循环显示），此处保持同口径。
 */
export default function CommonCountdown({
    countdownType = "dailyCycle",
    dailyTime = [],
    specifyTime = "",
    format = "HH:mm:ss",
    color = "#000",
    zh = false,
    timeStyle = {},
    unitStyle = {},
    valueStyle: _valueStyle,
    children
}: Props) {
    const [timeData, setTimeData] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });

    const getCurrentTimestamp = () => {
        return new Date().getTime();
    };

    // 取配置时分秒，锚定到今天的固定时刻
    const timeInfo = useMemo(() => {
        let obj = {
            dailyStarTime: 0,
            dailyEndTime: 0
        };
        if (dailyTime) {
            if (typeof dailyTime === "object") {
                const start = new Date(Number(dailyTime[0]));
                obj.dailyStarTime = new Date().setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
                const end = new Date(Number(dailyTime[1]));
                obj.dailyEndTime = new Date().setHours(end.getHours(), end.getMinutes(), end.getSeconds(), 0);
            } else {
                const end = new Date(Number(dailyTime));
                obj.dailyEndTime = new Date().setHours(end.getHours(), end.getMinutes(), end.getSeconds(), 0);
            }
        }
        return obj;
    }, [dailyTime]);

    // 计算剩余毫秒数（等价于旧版 up-count-down 的 :time 入参）
    const getRemainTime = () => {
        const now = getCurrentTimestamp();
        if (countdownType === "dailyCycle") {
            if (Array.isArray(dailyTime) && now < Number(timeInfo.dailyStarTime)) {
                return Math.max(0, Number(timeInfo.dailyStarTime) - now);
            }
            const num = Number(timeInfo.dailyEndTime) - now;
            return num > 0 ? num : 0;
        }
        const num = Number(specifyTime) - now;
        return num > 0 ? num : 0;
    };

    // 毫秒 → { days, hours, minutes, seconds }，与 up-count-down change 事件的 timeData 同构
    const msToTimeData = (ms: number) => {
        return {
            days: Math.floor(ms / (24 * 60 * 60 * 1000)),
            hours: Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
            minutes: Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000)),
            seconds: Math.floor((ms % (60 * 1000)) / 1000)
        };
    };

    // up-count-down 内部定时刷新 → 每秒 setInterval；挂载立即算一次避免首帧 00:00:00
    useEffect(() => {
        setTimeData(msToTimeData(getRemainTime()));
        const timer = setInterval(() => {
            setTimeData(msToTimeData(getRemainTime()));
        }, 1000);
        return () => {
            clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdownType, dailyTime, specifyTime, timeInfo.dailyStarTime, timeInfo.dailyEndTime]);

    // 格式化时间，保证两位数显示
    const formatTime = (time: string | number) => {
        return time?.toString().padStart(2, "0");
    };

    const arr = format.split(":");

    return (
        <View className="countdown-box">
            {/* 旧 components/commonCountdown 的 $slots.default 分支：传入插槽时仅渲染插槽内容（seckill2 的「距结束」样式） */}
            {children ? (
                children(timeData)
            ) : (
                arr.map((item: string, index: number) => (
                    <Text key={item} className="time-item" style={{ color, ...timeStyle } as any}>
                        {formatTime(timeData[timeDateMap[item] as keyof typeof timeData])}
                        {!zh ? (
                            <Text className="time-item-unit" style={unitStyle as any}>
                                {index < arr.length - 1 ? ":" : ""}
                            </Text>
                        ) : (
                            <Text className="time-item-unit" style={unitStyle as any}>
                                {textMap[item]}
                            </Text>
                        )}
                    </Text>
                ))
            )}
        </View>
    );
}
