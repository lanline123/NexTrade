import { useEffect, useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigButton from "@/components/tig/tig-button/TigButton";
import { t } from "@/utils/i18n";

import "./DatePop.scss";

type CalendarCell = {
    isEmpty: boolean;
    text?: string;
    value?: string; // YYYY-MM-DD
    isToday?: boolean;
};

interface Props {
    /** 是否多选 */
    multiple?: boolean;
    /** 多选时最多可选几个 */
    maxSelect?: number;
    /** 默认选中（单选传 string，多选传 string[]，格式 YYYY-MM-DD） */
    defaultSelected?: string | string[];
    /** 弹窗标题（缺省「选择日期」） */
    title?: string;
    /** 旧 v-model:show-popup → show + onShowChange */
    show?: boolean;
    onShowChange?: (v: boolean) => void;
    /** 旧 @confirm：确认选择（单选 string，多选 string[]） */
    onConfirm?: (selected: string | string[]) => void;
    /** 旧 @cancel（原组件声明了但从未触发，保留形状） */
    onCancel?: () => void;
}

/**
 * 日期选择弹窗组件（自旧 pages/order/src/datePop.vue 移植）
 * - 日历形式展示可选日期
 * - 支持设置可选日期范围（minDate/maxDate）
 * - 用于预约服务日期选择
 */
export default function DatePop({ multiple = false, maxSelect = 1, defaultSelected, title = "", show = false, onShowChange, onConfirm }: Props) {
    const displayTitle = title || t("选择日期");

    const [selectedDates, setSelectedDates] = useState<string[]>([]);

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth()); // 0-11

    const weekLabels = [t("周一"), t("周二"), t("周三"), t("周四"), t("周五"), t("周六"), t("周日")];

    const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const formatYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const todayYmd = formatYmd(new Date());

    const maxSelectable = (() => {
        if (!multiple) return 1;
        const m = Number(maxSelect);
        return Number.isFinite(m) && m > 0 ? m : 9999;
    })();

    const monthLabel = `${year}${t("年")}${month + 1}${t("月")}`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0(日)-6(六)
    // 以周一为第一天：把周日(0)挪到最后
    const leadingEmpty = (firstWeekday + 6) % 7;

    const calendarCells = ((): CalendarCell[] => {
        const res: CalendarCell[] = [];

        for (let i = 0; i < leadingEmpty; i++) {
            res.push({ isEmpty: true });
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const value = formatYmd(date);
            res.push({
                isEmpty: false,
                text: String(d),
                value,
                isToday: value === todayYmd
            });
        }

        const total = Math.ceil(res.length / 7) * 7;
        while (res.length < total) {
            res.push({ isEmpty: true });
        }

        return res;
    })();

    const normalizeDefaultSelected = () => {
        const v: any = defaultSelected;
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof v === "string" && v) return [v];
        return [];
    };

    // 旧 watch(showPopup)：弹窗打开时按默认选中初始化
    useEffect(() => {
        if (!show) return;
        const init = normalizeDefaultSelected();
        setSelectedDates(multiple ? init.slice(0, maxSelectable) : init.slice(0, 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const isSelected = (v?: string) => !!v && selectedDates.includes(v);

    const handleCellClick = (cell: CalendarCell) => {
        if (cell.isEmpty || !cell.value) return;

        const value = cell.value;

        if (!multiple) {
            setSelectedDates(selectedDates[0] === value ? [] : [value]);
            return;
        }

        const idx = selectedDates.indexOf(value);
        if (idx >= 0) {
            const next = [...selectedDates];
            next.splice(idx, 1);
            setSelectedDates(next);
            return;
        }

        if (selectedDates.length >= maxSelectable) {
            Taro.showToast({
                title: t("最多选择{0}个日期", { 0: maxSelectable }),
                icon: "none"
            });
            return;
        }

        setSelectedDates([...selectedDates, value].sort());
    };

    const handlePopupClose = () => {
        onShowChange?.(false);
    };

    const handleConfirm = () => {
        const result = multiple ? selectedDates.slice().sort() : selectedDates[0] || "";
        console.log(result);
        onConfirm?.(result);
        onShowChange?.(false);
    };

    return (
        /* 旧 tig-popup（:z-index 999、background #fff）→ NutUI Popup */
        <Popup visible={show} zIndex={999} onClose={handlePopupClose} style={{ backgroundColor: "#fff" } as any}>
            <View className="datepop">
                <View className="header">
                    <View className="title">{displayTitle}</View>
                    <View className="sub">
                        <Text className="month">{monthLabel}</Text>
                        {multiple && (
                            <Text className="count">
                                {t("（已选")}
                                {selectedDates.length}/{maxSelectable}）
                            </Text>
                        )}
                    </View>
                </View>

                <View className="week">
                    {weekLabels.map((w) => (
                        <View key={w} className="week-item">
                            {w}
                        </View>
                    ))}
                </View>

                <View className="grid">
                    {calendarCells.map((cell, idx) => (
                        <View key={idx} className={`cell ${cell.isEmpty ? "empty" : ""}`} onClick={() => handleCellClick(cell)}>
                            {!cell.isEmpty && <View className={`day ${isSelected(cell.value) ? "selected" : ""} ${cell.isToday ? "today" : ""}`}>{cell.text}</View>}
                        </View>
                    ))}
                </View>

                {/* 旧 tig-fixed-placeholder（background #fff）→ 固定底栏，安全区由 .fixed-placeholder 让出 */}
                <View className="fixed-placeholder">
                    <View className="btns">
                        {/* 旧 tig-button（已收敛到公共组件） */}
                        <TigButton className="btn" onClick={handleConfirm}>
                            {t("确认")}
                        </TigButton>
                    </View>
                </View>
            </View>
        </Popup>
    );
}
