import { useEffect, useMemo, useState } from "react";
import { Popup } from "@nutui/nutui-react-taro";
import { ScrollView, View } from "@tarojs/components";

import Checkbox from "@/pages/cart/src/Checkbox";
import { filterDayList } from "@/utils/store";
import { t } from "@/utils/i18n";

import "./PickupTime.scss";

interface Props {
    /** 旧接线透传（StoreCardStore :shipping-type），组件内部未使用，保留形状 */
    shippingType?: any;
    /** 门店自提时间段模板 */
    timeList?: any[];
    /** 当前门店配送数据（含 pickupDateType/pickupTime） */
    currentShippingData?: any;
    /** 预约时间限制配置 */
    appointmentTime?: any;
    /** 旧 v-model → show + onShowChange */
    show?: boolean;
    onShowChange?: (v: boolean) => void;
    /** 旧 @change：选中时间段 { pickupDateType, pickupTime } */
    onChange?: (data: { pickupDateType: number; pickupTime: string }) => void;
}

/**
 * 自提时间选择组件（自旧 pages/order/src/pickupTime.vue 移植）
 * - 选择自提日期（今天/明天/后天）
 * - 选择具体自提时间段
 * - 根据门店配置显示可选时间
 */
export default function PickupTime({ shippingType: _shippingType, timeList = [], currentShippingData = {}, appointmentTime = {}, show = false, onShowChange, onChange }: Props) {
    void _shippingType;
    const [pickupDateType, setPickupDateType] = useState<number | undefined>(currentShippingData?.pickupDateType);

    // 旧 watchEffect(show)：弹窗打开时按当前门店数据复位选中日期
    useEffect(() => {
        if (!show) return;
        setPickupDateType(currentShippingData?.pickupDateType || 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const list = useMemo(() => {
        const result: any[] = [];
        const maxDays = 3;

        const disabledDays = appointmentTime?.timeUnit === "d" ? appointmentTime.timeNum : 0;

        for (let i = 0; i < maxDays; i++) {
            if (i < disabledDays) {
                result.push([]);
                continue;
            }

            const dayList = i === 0 ? filterDayList(timeList || [], appointmentTime) : timeList || [];
            result.push(dayList);
        }

        return result;
    }, [timeList, appointmentTime]);

    const [scrollIntoView, setScrollIntoView] = useState("");

    const handleChangePickupTime = (index: number, time: any) => {
        onChange?.({
            pickupDateType: index,
            pickupTime: `${time.startTime}-${time.endTime}`
        });
        setPickupDateType(index);
        onShowChange?.(false);
    };

    const changePickupDateType = (type: number) => {
        setPickupDateType(type);
        setScrollIntoView(`list${type}`);
    };

    const getTimeItemChecked = (index: number, time: any) => {
        if (index !== currentShippingData.pickupDateType) return false;

        return currentShippingData?.pickupTime === `${time.startTime} - ${time.endTime}`;
    };

    const weekDays = [t("周日"), t("周一"), t("周二"), t("周三"), t("周四"), t("周五"), t("周六")];

    // 计算日期标签的函数
    const getDateLabel = (daysOffset: number) => {
        const date = new Date();
        date.setDate(date.getDate() + daysOffset);

        const weekDay = weekDays[date.getDay()];

        switch (daysOffset) {
            case 0:
                return t("今天({0})", { 0: weekDay });
            case 1:
                return t("明天({0})", { 0: weekDay });
            case 2:
                return t("后天({0})", { 0: weekDay });
            default:
                return `${weekDay}`;
        }
    };

    const todayLabel = getDateLabel(0);
    const tomorrowLabel = getDateLabel(1);
    const dayAfterTomorrowLabel = getDateLabel(2);

    return (
        <Popup visible={show} onClose={() => onShowChange?.(false)} style={{ backgroundColor: "#fff" } as any}>
            <View className="pickuptime-popup">
                <View className="popup-title">{t("请选择自提时间")}</View>
                <View className="pickuptime-content">
                    <View className="pickuptime-menu">
                        {list[0] && list[0].length > 0 && (
                            <View className={`menu-item ${pickupDateType === 0 ? "active" : ""}`} onClick={() => changePickupDateType(0)}>
                                {todayLabel}
                            </View>
                        )}

                        {list[1] && list[1].length > 0 && (
                            <View className={`menu-item ${pickupDateType === 1 ? "active" : ""}`} onClick={() => changePickupDateType(1)}>
                                {tomorrowLabel}
                            </View>
                        )}

                        <View className={`menu-item ${pickupDateType === 2 ? "active" : ""}`} onClick={() => changePickupDateType(2)}>
                            {dayAfterTomorrowLabel}
                        </View>
                    </View>
                    <View className="pickuptime">
                        <ScrollView className="pickuptime-scroll" scrollY scrollWithAnimation scrollIntoView={scrollIntoView}>
                            {list.map((item, index) =>
                                item.length > 0 ? (
                                    <View key={index} id={`list${index}`} className="pickuptime-list">
                                        {item.map((time: any, timeIndex: number) => (
                                            <View
                                                key={timeIndex}
                                                className={`time-item ${getTimeItemChecked(index, time) ? "active" : ""}`}
                                                onClick={() => handleChangePickupTime(index, time)}
                                            >
                                                <View className="item-value">
                                                    {index ? getDateLabel(index) : ""} {time.startTime} - {time.endTime}
                                                </View>
                                                {getTimeItemChecked(index, time) && (
                                                    <View className="item-checkbox">
                                                        {/* 旧 tig-checkbox（checked size=16）→ 购物车已移植 Checkbox */}
                                                        <Checkbox checked size={16} />
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                ) : null
                            )}
                        </ScrollView>
                    </View>
                </View>
            </View>
        </Popup>
    );
}
