import type { PropsWithChildren } from "react";
import Taro, { useLaunch } from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { configureRequestRuntime } from "@/utils/requestRuntime";
import { handleLogin } from "@/utils/handleLogin";
import { useI18nStore } from "@/store/i18n";
import init from "@/utils/init";
import { isOverseas } from "@/utils";

import "./app.scss";
// 全局装修样式（.module-ad-con 布局等）+ iconfont，自旧 App.vue 的 @import 平移
import "@/static/css/style.css";

function App({ children }: PropsWithChildren<any>) {
    useLaunch(() => {
        // 请求运行时：clientType / locale / 401 登录 / 启动初始化
        configureRequestRuntime({
            getClientType: () => useConfigStore.getState().XClientType,
            getLocaleCode: () => (isOverseas() ? useI18nStore.getState().langCode || "" : ""),
            handleLogin,
            initialize: init
        });

        // 设备信息与运行环境（对应旧 App.vue onLaunch 中的系统信息采集）
        const configStore = useConfigStore.getState();
        configStore.getWindowInfo();
        configStore.getSystemInfo();
        configStore.getMenuButtonInfo();

        // 启动初始化：i18n / 基础配置 / tabbar / 主题 / 用户 / 货币
        void init();
    });

    // children 即当前渲染的页面
    return children;
}

export default App;
