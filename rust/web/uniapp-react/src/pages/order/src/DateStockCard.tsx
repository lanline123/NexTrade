import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { t } from "@/utils/i18n";
import type { DateStockList } from "@/types/order/check";

import "./DateStockCard.scss";

// 旧 types/order/check 的 TimeSlotStockList 为未导出的局部接口，此处按原字段形状内联
type TimeSlotStockList = {
    productReservationTimeId: number;
    startTime: string;
    endTime: string;
    totalStock: number;
    usedStock: number;
    availableStock: number;
    enable: number;
};

interface Props {
    dateStockList?: DateStockList[];
    /** 旧 v-model → reservationDate + onReservationDateChange */
    reservationDate?: string;
    onReservationDateChange?: (v: string) => void;
    /** 旧 v-model:product-reservation-time-id → productReservationTimeId + onProductReservationTimeIdChange */
    productReservationTimeId?: number;
    onProductReservationTimeIdChange?: (v: number) => void;
}

/**
 * 预约日期库存选择卡片组件（自旧 pages/order/src/dateStockCard.vue 移植）
 * - 横向滚动选择预约日期
 * - 根据日期显示可用时间段及库存
 * - 用于预约服务时间选择
 */
export default function DateStockCard({
    dateStockList = [],
    reservationDate = "",
    onReservationDateChange,
    productReservationTimeId = 0,
    onProductReservationTimeIdChange
}: Props) {
    /**
     * 当前月份切换后，父组件会清空 reservationDate，但子组件不能继续沿用
     * 上一个月份的下标（例如上月选中第 2 天，而本月只有第 1 天）。
     * 始终按当前月份的数据重新解析选中日期，找不到时回退到首个日期。
     */
    const currentIndex = (() => {
        if (dateStockList.length === 0) return null;

        const selectedIndex = dateStockList.findIndex((item) => item.stockDate === reservationDate);
        return selectedIndex >= 0 ? selectedIndex : 0;
    })();

    const timeQuantumList = (() => {
        let arr: TimeSlotStockList[] = [];

        if (currentIndex !== null) {
            arr = dateStockList[currentIndex]?.timeSlotStockList || [];
        }

        return arr;
    })();

    const handleChange = (index: number) => {
        onReservationDateChange?.(dateStockList[index].stockDate);
        onProductReservationTimeIdChange?.(0);
    };

    const handleSelect = (data: TimeSlotStockList) => {
        if (data.availableStock === 0) return;

        if (productReservationTimeId === data.productReservationTimeId) return;

        if (!reservationDate) {
            return Taro.showToast({
                title: t("请选择日期"),
                icon: "none"
            });
        }

        onProductReservationTimeIdChange?.(data.productReservationTimeId);
    };

    return (
        <View className="date-stock-box">
            <ScrollView scrollX className="date-stock-scroll">
                <View className="date-list">
                    {dateStockList.map((item, index) => (
                        <View key={index} className={`date-item ${reservationDate === item.stockDate ? "active" : ""}`} onClick={() => handleChange(index)}>
                            <View className="day">{item.day}</View>
                            <View className="weekday">{item.weekDay}</View>
                        </View>
                    ))}
                </View>
            </ScrollView>
            <View className="time-quantum-box">
                {timeQuantumList.map((item) => (
                    <View
                        key={item.productReservationTimeId}
                        className={`quantum-item ${productReservationTimeId === item.productReservationTimeId ? "active" : ""} ${
                            reservationDate && item.availableStock === 0 ? "disabled" : ""
                        }`}
                        onClick={() => handleSelect(item)}
                    >
                        <View className="item-time">
                            {" "}
                            {item.startTime}-{item.endTime}
                        </View>
                        {reservationDate && (
                            <View className="item-desc">
                                {t("【可约")}
                                {item.availableStock}】
                            </View>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
}
