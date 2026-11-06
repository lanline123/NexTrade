import { t } from "@/utils/i18n";

/**
 * 门店/自提相关工具（自旧 utils/store.ts 移植）。
 * TODO(MIGRATION)：旧文件含 getBusinessHours 等更多函数，随门店批次按需补齐；
 * 当前仅移植订单结算页（pages/order/check）依赖的两个函数。
 */

export const getOrderPickupParams = (data: any[]) => {
    return data?.map((item: any) => {
        return { shopId: item.shopId, pickupId: item.pickups[0].shopId, pickupTitle: item.pickups[0].shopTitle };
    });
};

// 过滤掉已经过了的时间段
export const filterDayList = (list: any[], appointmentTime?: { timeNum: number; timeUnit: "d" | "h" | "m" }) => {
    const now = new Date();

    // 计算需要提前的时间（转换为分钟）
    let advanceMinutes = 0;
    if (appointmentTime) {
        switch (appointmentTime.timeUnit) {
            case "h":
                advanceMinutes = appointmentTime.timeNum * 60;
                break;
            case "m":
                advanceMinutes = appointmentTime.timeNum;
                break;
        }
    }

    // 计算截止时间
    const deadlineTime = new Date(now.getTime() + advanceMinutes * 60 * 1000);
    const deadlineHour = deadlineTime.getHours();
    const deadlineMinute = deadlineTime.getMinutes();

    return list.filter((item: any) => {
        let itemHour = 0,
            itemMinute = 0;
        if (item.endTime) {
            const [h, m] = item.endTime.split(":").map(Number);
            itemHour = h;
            itemMinute = m;
        }

        // 保留大于截止时间的时间段
        return itemHour > deadlineHour || (itemHour === deadlineHour && itemMinute > deadlineMinute);
    });
};
