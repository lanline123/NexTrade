import { useEffect, useMemo, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { formatDate } from "@/utils/format";
import { t } from "@/utils/i18n";

import PickerDatePop from "./pickerDatePop";

import "./selectDate.scss";

interface Props {
    /** 对应旧 v-model:modelValue */
    modelValue?: boolean;
    /** 旧 minYears，默认 2013 */
    minYears?: number | string;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
    /** 对应旧 @confirm：返回 ["YYYY-MM-DD", "YYYY-MM-DD"] */
    onConfirm?: (dates: string[]) => void;
}

const getDayNum = (year: number, month: number): number => {
    if (month === 2) {
        return isLeapYear(year) ? 29 : 28;
    } else if ([4, 6, 9, 11].includes(month)) {
        return 30;
    }
    return 31;
};

const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const compareDates = (dateStr1: string, dateStr2: string): number => {
    const date1 = new Date(dateStr1.split("-").join("/"));
    const date2 = new Date(dateStr2.split("-").join("/"));

    if (date1.getTime() > date2.getTime()) {
        return 1;
    } else if (date1.getTime() < date2.getTime()) {
        return -1;
    } else {
        return 0;
    }
};

/**
 * 日期选择组件（自旧 pages/salesman/src/selectDate.vue 逐行移植）
 * - 快捷选择今天、近 7 天、近 30 天
 * - 自定义日期范围选择
 */
export default function SelectDate({ modelValue = false, minYears = 2013, onChange, onConfirm }: Props) {
    const [currentIndexs, setCurrentIndexs] = useState<number[]>([0, 0, 0]);
    const [times, setTimes] = useState<Record<number, string | undefined>>({});
    const [sendvalue, setSendvalue] = useState<Record<number, string | undefined>>({});
    const [currentTimeIndex, setCurrentTimeIndex] = useState(0);

    const years = useMemo(() => {
        const list: number[] = [];
        for (let i = Number(minYears); i <= new Date().getFullYear(); i++) {
            list.push(i);
        }
        return list;
    }, [minYears]);

    const months = useMemo(() => {
        const list: number[] = [];
        for (let i = 1; i <= 12; i++) {
            list.push(i);
        }
        return list;
    }, []);

    const days = useMemo(() => {
        const list: number[] = [];
        const dayNum = getDayNum(years[currentIndexs[0]], months[currentIndexs[1]]);
        for (let i = 1; i <= dayNum; i++) {
            list.push(i);
        }
        return list;
    }, [years, months, currentIndexs]);

    const columns = useMemo(() => [years, months, days], [years, months, days]);

    const changeHandler = (e: { values: (string | number)[]; indexs: number[] }) => {
        const { values, indexs } = e;
        setCurrentIndexs(indexs);
        setTimes((prev) => ({ ...prev, [currentTimeIndex]: values.join(".") }));
        setSendvalue((prev) => ({ ...prev, [currentTimeIndex]: values.join("-") }));
    };

    const confirm = () => {
        if (!times[0] || !times[1]) {
            return Taro.showToast({
                title: t("请选择开始时间和结束时间"),
                icon: "none"
            });
        }
        const val = compareDates(times[1] as string, times[0] as string);
        if (val === -1) {
            return Taro.showToast({
                title: t("结束时间必须大于等于开始时间"),
                icon: "none"
            });
        }
        onConfirm?.([sendvalue[0] as string, sendvalue[1] as string]);
        onChange?.(false);
    };

    const setDefaultIndex = (date: Date) => {
        const dateText = formatDate(date);
        const [year, month, day] = dateText.split("-");
        setCurrentIndexs([years.indexOf(Number(year)), months.indexOf(Number(month)), days.indexOf(Number(day))]);
    };

    const handleTime = (index: number) => {
        setCurrentTimeIndex(index);
        if (times[index]) {
            setDefaultIndex(new Date((times[index] as string).split(".").join("-")));
        }
    };

    // 旧 onBeforeMount(() => setDefaultIndex(new Date()))
    useEffect(() => {
        setDefaultIndex(new Date());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <PickerDatePop
            modelValue={modelValue}
            defaultIndex={currentIndexs}
            columns={columns}
            onChange={onChange}
            onConfirm={confirm}
            onValueChange={changeHandler}
        >
            <View className="picker-box-header">
                <View className={`header-item${currentTimeIndex === 0 ? " active" : ""}`} onClick={() => handleTime(0)}>
                    <View className="header-item-text">{t("开始时间")}</View>
                    <View className="header-item-value">{times[0] ?? t("请选择")}</View>
                </View>
                <View className={`header-item${currentTimeIndex === 1 ? " active" : ""}`} onClick={() => handleTime(1)}>
                    <View className="header-item-text">{t("结束时间")}</View>
                    <View className="header-item-value">{times[1] ?? t("请选择")}</View>
                </View>
            </View>
        </PickerDatePop>
    );
}