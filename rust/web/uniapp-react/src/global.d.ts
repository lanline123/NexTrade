/// <reference types="@tarojs/taro" />

// 与旧 uniapp（@dcloudio/types）保持一致的全局类型，让迁移代码零改动
declare type AnyObject = Record<string, any>;

// Taro 构建期环境变量（.env 中 TARO_APP_* 前缀，经 DefinePlugin 编译期内联）
interface ProcessEnv {
    readonly TARO_ENV: string;
    readonly TARO_APP_API_URL?: string;
    readonly TARO_APP_API_PREFIX?: string;
    readonly TARO_APP_STATIC_RESOURCE?: string;
    readonly TARO_APP_SOCKET_URL?: string;
    readonly TARO_APP_IS_MERCHANT?: string;
    readonly TARO_APP_IS_PRO?: string;
    readonly TARO_APP_IS_B2B?: string;
    readonly TARO_APP_IS_OVERSEAS?: string;
    readonly TARO_APP_IS_STORE?: string;
    readonly TARO_APP_IS_VENDOR?: string;
    readonly TARO_APP_IS_DEMO?: string;
}

declare module "*.png";
declare module "*.gif";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.css";
declare module "*.less";
declare module "*.scss";
declare module "*.sass";
declare module "*.styl";

declare namespace NodeJS {
    interface ProcessEnv {
        /** NODE_ENV */
        NODE_ENV: "development" | "production";
        /** 当前构建的平台 */
        TARO_ENV:
            | "weapp"
            | "swan"
            | "alipay"
            | "h5"
            | "rn"
            | "tt"
            | "qq"
            | "jd"
            | "harmony"
            | "dd";
    }
}
