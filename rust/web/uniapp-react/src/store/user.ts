import Taro from "@tarojs/taro";
import { create } from "zustand";

import { useConfigStore } from "@/store/config";
import { redirect } from "@/utils";
import { getUser } from "@/api/user/user";
import { userLogout } from "@/api/login/login";
import { getServiceConfig } from "@/api/common";
import { getOrderNum } from "@/api/user/order";
import type { OrderNumItem } from "@/types/user/order";

/** 客服配置接口 */
interface ServiceConfig {
    url: string;
    openType: number;
    show: number;
    serviceType: number;
    corpId: string;
}

export interface UserState {
    /** 用户token */
    token: string;
    /** 用户信息 */
    userInfo: AnyObject;
    /** 认证方式（wechatLogin等） */
    authType: string;
    /** 客服配置 */
    serviceConfig: ServiceConfig;
    /** 订单各状态数量统计（用于会员中心角标） */
    orderNum: OrderNumItem;
    /** 用户退出登录 */
    logout: () => Promise<void>;
    /** 清除用户登录态 */
    clear: () => void;
    /** 设置用户信息 */
    setUserInfo: (data: any) => void;
    /** 设置用户token */
    setToken: (tokenValue: string) => void;
    /** 设置认证方式 */
    setAuthType: (authTypeValue: string) => void;
    /** 获取用户详情并更新store */
    getUserInfo: () => Promise<void>;
    /** 获取客服配置并更新store */
    getServiceConfigData: () => Promise<void>;
    /** 拉取订单数量角标（force 忽略并发去重） */
    getOrderNum: (force?: boolean) => Promise<OrderNumItem>;
}

let orderNumPromise: Promise<OrderNumItem> | null = null;

/**
 * 用户状态管理Store
 * 管理用户登录态、用户信息、认证方式及客服配置
 */
export const useUserStore = create<UserState>((set, get) => ({
    token: Taro.getStorageSync("token") || "",
    userInfo: Taro.getStorageSync("userInfo") || {},
    authType: "",
    serviceConfig: {
        url: "",
        openType: 0,
        show: 0,
        serviceType: 0,
        corpId: ""
    },
    orderNum: {} as OrderNumItem,

    async logout() {
        try {
            await userLogout();
        } catch (error) {
            console.error(error);
        } finally {
            // 无论接口是否成功，本地登录态都必须清掉，否则分享门控会误判仍已登录
            const configStore = useConfigStore.getState();
            get().clear();
            set({ authType: "" });
            if (process.env.TARO_ENV === "weapp") {
                redirect({
                    url: "/pages/index/index"
                });
            } else if (configStore.XClientType === "wechat") {
                redirect({
                    url: "/pages/member/index"
                });
            } else {
                Taro.reLaunch({
                    url: "/pages/login/index"
                }).catch(() => {});
            }
        }
    },

    clear() {
        Taro.removeStorageSync("token");
        Taro.removeStorageSync("userInfo");
        set({ token: "", userInfo: {}, orderNum: {} as OrderNumItem });
        orderNumPromise = null;
    },

    setUserInfo(data: any) {
        Taro.setStorageSync("userInfo", data);
        set({ userInfo: data });
    },

    setToken(tokenValue: string) {
        Taro.setStorageSync("token", tokenValue);
        set({ token: tokenValue });
    },

    setAuthType(authTypeValue: string) {
        set({ authType: authTypeValue });
    },

    async getUserInfo() {
        try {
            const result = await getUser();
            get().setUserInfo(result);
        } catch (error) {
            console.error(error);
        }
    },

    async getServiceConfigData() {
        try {
            const result = await getServiceConfig();
            set({ serviceConfig: { ...get().serviceConfig, ...result } });
        } catch (error) {
            console.error(error);
        }
    },

    /**
     * 拉取订单数量角标
     * - 未登录时直接返回空对象
     * - 并发调用复用同一个请求，避免重复打接口
     */
    async getOrderNum(force = false): Promise<OrderNumItem> {
        if (!get().token) {
            set({ orderNum: {} as OrderNumItem });
            return get().orderNum;
        }
        if (orderNumPromise && !force) {
            return orderNumPromise;
        }
        orderNumPromise = (async () => {
            try {
                const result = (await getOrderNum()) as unknown as OrderNumItem;
                set({ orderNum: result || ({} as OrderNumItem) });
                return get().orderNum;
            } catch (error) {
                console.error(error);
                return get().orderNum;
            } finally {
                orderNumPromise = null;
            }
        })();
        return orderNumPromise;
    }
}));
