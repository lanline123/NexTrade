import Taro from "@tarojs/taro";
import { create } from "zustand";

import { themeSettings } from "@/api/common";

export interface ThemeState {
    themeId: number;
    themeStyle: { [key: string]: string };
    getThemeSettings: () => Promise<void>;
    hexToRgba: (hex: string, alpha?: number) => string;
}

export const useThemeStore = create<ThemeState>((set) => ({
    themeId: 0,
    themeStyle: {},

    async getThemeSettings() {
        if (Taro.getStorageSync("themeStyle")) {
            set({ themeStyle: Taro.getStorageSync("themeStyle") });
        }
        try {
            const res = await themeSettings();

            const data = JSON.parse(res.themeStyle);

            set((state) => {
                if (Object.keys(state.themeStyle).length === 0) {
                    return { themeStyle: data };
                } else if (state.themeStyle["--general"] !== data["--general"]) {
                    return { themeStyle: data };
                }
                return { themeStyle: state.themeStyle };
            });

            Taro.setStorageSync("themeStyle", data);
        } catch (error: any) {
            set({
                themeStyle: {
                    "--general": "#ff4444",
                    "--main-bg": "#ff4444",
                    "--main-bg-gradient": "#ff4444",
                    "--main-text": "#ffffff",
                    "--vice-bg": "#ff8855",
                    "--vice-text": "#fff",
                    "--icon": "#FC0000",
                    "--price": "#FC0000",
                    "--tag-text": "#CF0000",
                    "--tag-bg": "#FFF2F2",
                    "--primary-light-3": "#ff7c7c",
                    "--primary-light-5": "#ffa2a2",
                    "--primary-light-7": "#ffc7c7",
                    "--primary-light-8": "#ffdada",
                    "--primary-light-9": "#ffecec",
                    "--primary-dark-2": "#cc3636",
                    "--ump-main-bg": "#ff4444",
                    "--ump-main-text": "#ffffff",
                    "--ump-vice-bg": "#ff8855",
                    "--ump-vice-text": "#fff",
                    "--ump-icon": "#FC0000",
                    "--ump-price": "#FC0000",
                    "--ump-tag-text": "#CF0000",
                    "--ump-tag-bg": "#FFF2F2",
                    "--ump-coupon-bg": "#FFF2F2",
                    "--ump-border": "#FFCCCC",
                    "--ump-start-bg": "#F86F30",
                    "--ump-end-bg": "#E91717"
                }
            });
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    },

    hexToRgba(hex: string, alpha: number = 1): string {
        hex = hex.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}));
