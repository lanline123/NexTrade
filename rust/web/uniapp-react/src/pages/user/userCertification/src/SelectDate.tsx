import { useEffect, useMemo, useState } from "react";
import { PickerView, PickerViewColumn, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { formatDate } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./SelectDate.scss";

interface Props {
    /** 旧 v-model */
    show?: boolean;
    onShowChange?: (show: boolean) => void;
    /** 旧 @confirm（[开始, 结束]，格式 yyyy-mm-dd） */
    onConfirm?: (value: string[]) => void;
    minYears?: number | string;
    maxYears?: number | string;
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
 * 日期区间选择（自旧 pages/user/src/selectDate.vue + pickerDatePop.vue 逐行移植）
 * - 顶部切换「开始时间 / 结束时间」，三列（年/月/日）滚轮
 * - 确认时校验起止必填且结束 >= 开始
 * - 旧 tig-popup → NutUI Popup，picker-view → Taro PickerView
 */
export default function SelectDate({
    show = false,
    onShowChange,
    onConfirm,
    minYears = 1970,
    maxYears = new Date().getFullYear()
}: Props) {
    const [times, setTimes] = useState<any[]>([]);
    const [sendvalue, setSendvalue] = useState<any[]>([]);
    const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
    const [currentIndexs, setCurrentIndexs] = useState<number[]>([0, 0, 0]);

    const years = useMemo(() => {
        let yearsArr: number[] = [];
        for (let i = Number(minYears); i <= Number(maxYears); i++) {
            yearsArr.push(i);
        }
        return yearsArr;
    }, [minYears, maxYears]);

    const months = useMemo(() => {
        let monthsArr: number[] = [];
        for (let i = 1; i <= 12; i++) {
            monthsArr.push(i);
        }
        return monthsArr;
    }, []);

    const days = useMemo(() => {
        let daysArr: number[] = [];
        let dayNum = getDayNum(years[currentIndexs[0]], months[currentIndexs[1]]);
        for (let i = 1; i <= dayNum; i++) {
            daysArr.push(i);
        }
        return daysArr;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndexs, years, months]);

    const columns = [years, months, days];

    const setDefaultIndex = (date: Date) => {
        const dateText = formatDate(date);
        const [year, month, day] = dateText.split("-");
        setCurrentIndexs([years.indexOf(Number(year)), months.indexOf(Number(month)), days.indexOf(Number(day))]);
    };

    useEffect(() => {
        setDefaultIndex(new Date());
        // 对应旧 onBeforeMount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changeHandler = (e: any) => {
        const { value } = e.detail;
        const indexs = value;
        setCurrentIndexs(indexs);
        const nextTimes = [...times];
        nextTimes[currentTimeIndex] = columns.map((item: any, index) => item[indexs[index]]).join(".");
        setTimes(nextTimes);
        const nextSendvalue = [...sendvalue];
        nextSendvalue[currentTimeIndex] = columns.map((item: any, index) => item[indexs[index]]).join("-");
        setSendvalue(nextSendvalue);
    };

    const confirm = () => {
        if (!times[0] || !times[1]) {
            Taro.showToast({
                title: t("请选择开始时间和结束时间"),
                icon: "none"
            });
            return;
        }
        const val = compareDates(times[1], times[0]);
        if (val === -1) {
            Taro.showToast({
                title: t("结束时间必须大于等于开始时间"),
                icon: "none"
            });
            return;
        }
        onConfirm?.(sendvalue);
        onShowChange?.(false);
    };

    const handleTime = (index: number) => {
        setCurrentTimeIndex(index);
        if (times[index]) {
            setDefaultIndex(new Date(String(times[index]).split(".").join("-")));
        }
    };

    return (
        <Popup visible={show} position="bottom" onClose={() => onShowChange?.(false)}>
            <View className="picker-box">
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
                <PickerView indicatorStyle="height: 50px;" value={currentIndexs} className="picker-view" onChange={changeHandler}>
                    {columns.map((col, colIndex) => (
                        <PickerViewColumn key={colIndex}>
                            {col.map((item) => (
                                <View className="item" key={item}>
                                    {item}
                                </View>
                            ))}
                        </PickerViewColumn>
                    ))}
                </PickerView>
                <View className="btn-box">
                    <View className="picker-btn" onClick={confirm}>
                        {t("确定")}
                    </View>
                </View>
            </View>
        </Popup>
    );
}