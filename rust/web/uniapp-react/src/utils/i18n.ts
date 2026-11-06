import i18next from "@/i18n";

/**
 * 非组件环境（api 层、store、工具函数）使用的翻译函数。
 * 组件内建议使用 react-i18next 的 useTranslation()。
 */
export const t = (key: string, params?: Record<string, unknown>): string => {
    return i18next.t(key, params ?? {}) as string;
};

/**
 * 兼容旧调用点：旧方案需要向 vue-i18n 注入翻译函数，
 * i18next 可在任意环境直接调用，保留空实现避免逐个删除调用点。
 */
export const setTranslationFunction = (_t: (key: string, params?: unknown) => string) => {
    void _t;
};

/** {0} / {name} 占位符兜底替换（i18next 已原生支持，保留以防个别调用点手工拼接） */
export const formatI18nParams = (text: string, params?: unknown): string => {
    if (!params || typeof params !== "object") {
        return text;
    }
    return text.replace(/\{(\w+)\}/g, (m, k: string) => {
        const v = (params as Record<string, unknown>)[k];
        return v != null ? String(v) : m;
    });
};
