import Taro from "@tarojs/taro";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import zh from "@/locale/zh.json";
import en from "@/locale/en.json";

export const i18nResources: Record<string, { translation: Record<string, string> }> = {
    zh: { translation: zh },
    en: { translation: en }
};

/**
 * i18next 实例
 *
 * 与旧 vue-i18n 方案的差异：
 * - 字典仍为 zh.json / en.json 扁平 key-value，key 即中文文案，迁移零成本；
 * - 旧方案的 {0} / {name} 占位符通过配置 interpolation 前后缀原生支持，
 *   不再需要 locale/index.ts 的 Message Function 预处理（小程序禁 eval 的问题
 *   对 i18next 不存在，其插值为纯字符串替换）；
 * - missing key 默认返回 key 本身，等价于旧 missing: (l, key) => key。
 */
const instance = i18next.createInstance();

void instance.use(initReactI18next).init({
    resources: i18nResources,
    lng: Taro.getStorageSync("langCode") || "zh",
    fallbackLng: "zh",
    interpolation: {
        // React 已对输出做转义，这里关掉 i18next 自身的转义
        escapeValue: false,
        prefix: "{",
        suffix: "}"
    },
    returnEmptyString: false,
    react: {
        useSuspense: false
    }
});

export default instance;
