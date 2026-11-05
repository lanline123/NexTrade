/**
 * 模块通用倒计时（移植自 view/admin src/modules/src/commonCountdown/View.vue）
 *
 * 行为对齐 el-countdown：每秒触发 change(total 毫秒)，结束时触发 finish；
 * dailyCycle 模式支持每日开抢/每日结束两种时间语义（与 Vue 版 getDailyTimeInfo 一致）。
 */
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
    countdownType: "dailyCycle" | "specifyTime";
    valueStyle?: Record<string, string>;
    dailyTime?: number[] | number;
    specifyTime?: number;
    format?: string;
    onChange?: (time: number) => void;
    onFinish?: () => void;
    /** 自定义渲染：与 Vue 版作用域插槽一致 */
    children?: (time: { days: string; hours: string; minutes: string; seconds: string }) => React.ReactNode;
}

function getDailyTimeInfo(dailyTime: number[] | number | undefined) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let dailyStartTime = 0;
    let dailyEndTime = 0;

    if (typeof dailyTime === "number" && dailyTime > 0) {
        const endDate = new Date(dailyTime);
        dailyEndTime = new Date(today.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds(), 0)).getTime();
        if (dailyEndTime <= Date.now()) {
            dailyEndTime = new Date(tomorrow.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds(), 0)).getTime();
        }
    } else if (Array.isArray(dailyTime) && dailyTime.length >= 2) {
        const startDate = new Date(dailyTime[0]);
        const endDate = new Date(dailyTime[1]);
        dailyStartTime = new Date(today.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), 0)).getTime();
        dailyEndTime = new Date(today.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds(), 0)).getTime();
        if (dailyStartTime <= Date.now()) {
            dailyStartTime = new Date(tomorrow.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), 0)).getTime();
        }
        if (dailyEndTime <= Date.now()) {
            dailyEndTime = new Date(tomorrow.setHours(endDate.getHours(), endDate.getMinutes(), endDate.getSeconds(), 0)).getTime();
        }
    }
    return { dailyStartTime, dailyEndTime };
}

export default function H5Countdown({ countdownType = "dailyCycle", valueStyle, dailyTime = [], specifyTime = 0, format = "HH:mm:ss", onChange, onFinish, children }: Props) {
    const targetValue = useMemo(() => {
        if (countdownType === "specifyTime") return specifyTime;
        if (countdownType === "dailyCycle") {
            const info = getDailyTimeInfo(dailyTime);
            const now = Date.now();
            if (Array.isArray(dailyTime) && now < info.dailyStartTime) return info.dailyStartTime;
            return info.dailyEndTime;
        }
        return 0;
    }, [countdownType, dailyTime, specifyTime]);

    const [remain, setRemain] = useState(() => Math.max(0, targetValue - Date.now()));
    const finishedRef = useRef(false);

    useEffect(() => {
        finishedRef.current = false;
        setRemain(Math.max(0, targetValue - Date.now()));
        const timer = window.setInterval(() => {
            const next = Math.max(0, targetValue - Date.now());
            setRemain(next);
            onChange?.(next);
            if (next <= 0 && !finishedRef.current) {
                finishedRef.current = true;
                onFinish?.();
            }
        }, 1000);
        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetValue]);

    const formatTime = useMemo(() => {
        const totalSeconds = Math.floor(remain / 1000);
        const days = Math.floor(totalSeconds / (24 * 60 * 60));
        const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
        const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
        const seconds = totalSeconds % 60;
        return {
            days: days.toString().padStart(2, "0"),
            hours: hours.toString().padStart(2, "0"),
            minutes: minutes.toString().padStart(2, "0"),
            seconds: seconds.toString().padStart(2, "0")
        };
    }, [remain]);

    const parts = useMemo(() => {
        // format 顺序对齐 el-countdown：DD 天 HH:mm:ss
        const list: Array<{ label: string; value: string }> = [];
        if (format.includes("DD")) list.push({ label: "days", value: formatTime.days });
        if (format.includes("HH")) list.push({ label: "hours", value: formatTime.hours });
        if (format.includes("mm")) list.push({ label: "minutes", value: formatTime.minutes });
        if (format.includes("ss")) list.push({ label: "seconds", value: formatTime.seconds });
        return list;
    }, [format, formatTime]);

    return (
        <div className="countdown-box">
            {children ? (
                children(formatTime)
            ) : (
                <div style={valueStyle} className="h5-countdown">
                    {parts.map((p, i) => (
                        <span key={p.label}>
                            {i > 0 && p.label !== "days" && parts[i - 1]?.label !== "days" ? <span className="h5-countdown-colon">:</span> : null}
                            {p.label === "days" ? <span className="h5-countdown-day">{p.value}天</span> : <span className="h5-countdown-num">{p.value}</span>}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
