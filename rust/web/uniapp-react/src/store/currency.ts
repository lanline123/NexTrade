import Taro from "@tarojs/taro";
import { create } from "zustand";

import { getCurrencyList } from "@/api/common";
import type { CurrencyItem } from "@/types/common";

export interface CurrencyState {
    /** 货币列表 */
    currencyList: CurrencyItem[];
    /** 当前货币数据 */
    currentCurrencyData: CurrencyItem;
    fetchCurrencyList: () => Promise<void>;
    setDefaultData: (currentCurrency: CurrencyItem) => void;
}

const CURRENCY_STORAGE_KEY = "currencyData";

/**
 * 货币 store（旧方案经 useStorageData hook 中转 storage，这里直接读写 storage）
 */
export const useCurrencyStore = create<CurrencyState>((set, get) => ({
    currencyList: [],
    currentCurrencyData: (Taro.getStorageSync(CURRENCY_STORAGE_KEY) || {}) as CurrencyItem,

    async fetchCurrencyList() {
        try {
            const result = await getCurrencyList();
            set({ currencyList: result });

            const defaultData = result.find((item) => item.isDefault === 1)!;
            const cached = Taro.getStorageSync(CURRENCY_STORAGE_KEY) as CurrencyItem | "";

            if (cached && cached.id) {
                const latest = result.find((item) => item.id === cached.id);
                get().setDefaultData(latest || defaultData || cached);
                return;
            }

            get().setDefaultData(defaultData);
        } catch (error) {
            console.error(error);
        }
    },

    setDefaultData(currentCurrency: CurrencyItem) {
        Taro.setStorageSync(CURRENCY_STORAGE_KEY, currentCurrency);
        set({ currentCurrencyData: currentCurrency });
    }
}));
