import { create } from "zustand";

import { asyncGetCartCount } from "@/api/cart/cart";
import { useUserStore } from "./user";

export interface CartState {
    cartCount: number;
    /** 多个页面/底部导航可能同时触发刷新，只保留同一时间窗口内的一个请求 */
    fetchCartCount: (force?: boolean) => Promise<void>;
    setCartCount: (count: number) => void;
}

let pendingCountRequest: Promise<void> | null = null;
// 头部和底部导航可能在同一页面先后触发刷新，短时间内复用已获取的结果。
let lastFetchedAt = 0;
const cacheDuration = 1000;

export const useCartStore = create<CartState>((set) => ({
    cartCount: 0,

    fetchCartCount(force = false): Promise<void> {
        if (!useUserStore.getState().token) {
            set({ cartCount: 0 });
            return Promise.resolve();
        }
        if (pendingCountRequest) return pendingCountRequest;
        if (!force && Date.now() - lastFetchedAt < cacheDuration) return Promise.resolve();

        pendingCountRequest = (async () => {
            try {
                const result = await asyncGetCartCount();
                set({ cartCount: result ?? 0 });
                lastFetchedAt = Date.now();
            } catch (error) {
                console.error(error);
            } finally {
                pendingCountRequest = null;
            }
        })();

        return pendingCountRequest;
    },

    setCartCount(count: number) {
        set({ cartCount: count });
        lastFetchedAt = Date.now();
    }
}));
