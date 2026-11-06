import request from "@/utils/request";
import type { TabbarDataResponse } from "@/types/tabbar";

/**
 * @description 获取移动端底部导航配置
 * @returns 导航栏配置数据
 */
export const getMobileNav = (params?: Record<string, unknown>) => {
    return request<TabbarDataResponse>({
        url: "home/home/mobileNav",
        method: "get",
        params
    });
};
