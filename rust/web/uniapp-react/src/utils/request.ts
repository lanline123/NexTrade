import Taro from "@tarojs/taro";

import { t } from "@/utils/i18n";
import { KEY, aesEncrypt } from "@/utils/crypto";
import { baseUrl } from "@/utils/requestBaseUrl";
import { formatArguments } from "@/utils/requestArguments";
import { getRequestRuntime } from "@/utils/requestRuntime";

export { baseUrl };

/**
 * @description 获取加密密钥
 * @returns 基于时间戳的加密密钥
 */
export const getSecret = () => {
    const currentTimeStamp = Math.floor(Date.now() / 1000);
    return aesEncrypt(currentTimeStamp, KEY);
};

export function requestHeader(customHeaders: Record<string, string> = {}): Record<string, string> {
    const runtime = getRequestRuntime();
    return {
        Authorization: "Bearer " + (Taro.getStorageSync("token") ? Taro.getStorageSync("token") : null),
        ...customHeaders,
        "X-Client-Type": runtime.getClientType(),
        "X-Locale-Code": runtime.getLocaleCode(),
        Secret: getSecret()
    };
}

/**
 * 请求配置接口
 */
interface RequestConfig {
    /** 请求URL */
    url: string;
    /** 请求方法 */
    method?: "GET" | "POST" | "post" | "get";
    /** POST请求体数据 */
    data?: any;
    /** GET请求参数 */
    params?: any;
    /** 自定义请求头 */
    header?: any;
    /** 401时是否跳过登录跳转 */
    noSkipLogin?: boolean;
    /** API前缀 */
    prefix?: string;
    /** 是否取消前一个相同key的请求 */
    cancelPrevious?: boolean;
    /** 请求唯一标识，用于取消请求 */
    requestKey?: string;
}

/**
 * 响应数据结构
 */
interface ResponseData {
    code?: number;
    message: string;
    data: any;
}

/** 存储活跃的请求任务，用于请求取消 */
const activeRequests: Map<string, Taro.RequestTask<any>> = new Map();

let isIniting = false;

/**
 * @description 设置初始化状态
 * @param value 是否正在初始化
 */
export const setIsInit = (value: boolean) => {
    isIniting = value;
};

/**
 * @description 发送网络请求
 * @param config 请求配置
 * @returns Promise，解析为响应数据
 * @throws 错误信息，如请求失败、未登录(401)等
 */
export default function request<T extends ResponseData>(config: RequestConfig): Promise<T["data"]> {
    const runtime = getRequestRuntime();
    config.noSkipLogin = config.noSkipLogin || false;
    const method = (config.method || "GET").toUpperCase();
    const prefix = config.prefix || process.env.TARO_APP_API_PREFIX || "/api/";
    const url = `${baseUrl}${prefix}${config.url}`;
    const header = requestHeader(config.header);
    const data = method === "GET" ? formatArguments(config.params) : config.data;

    if (config.cancelPrevious && config.requestKey) {
        const previousRequest = activeRequests.get(config.requestKey);
        if (previousRequest) {
            previousRequest.abort();
            activeRequests.delete(config.requestKey);
        }
    }

    return new Promise<T["data"]>((resolve, reject) => {
        const requestTask = Taro.request({
            url,
            method: method as "GET" | "POST",
            data,
            header,
            success: (response) => {
                if (config.requestKey) {
                    activeRequests.delete(config.requestKey);
                }
                const data = response.data as T;
                if (data.code !== 0) {
                    if (data.code === 401 && !config.noSkipLogin) {
                        runtime.handleLogin();

                        if (!isIniting) {
                            setIsInit(true);
                            void runtime.initialize();
                        }

                        reject({ message: t("请登录") });
                    }
                    reject(data);
                } else {
                    resolve(data.data);
                }
            },
            fail: (err) => {
                if (config.requestKey) {
                    activeRequests.delete(config.requestKey);
                }
                if (err && err.errMsg && err.errMsg.indexOf("abort") !== -1) {
                    reject({ code: -1, message: t("请求已取消"), data: null });
                } else {
                    reject(err);
                }
            }
        }) as unknown as Taro.RequestTask<any>;

        if (config.requestKey) {
            activeRequests.set(config.requestKey, requestTask);
        }
    });
}

/**
 * @description 取消指定请求
 * @param requestKey 请求唯一标识
 * @returns 是否成功取消
 */
export function abortRequest(requestKey: string): boolean {
    const request = activeRequests.get(requestKey);
    if (request) {
        request.abort();
        activeRequests.delete(requestKey);
        return true;
    }
    return false;
}

/**
 * @description 取消所有进行中的请求
 */
export function abortAllRequests(): void {
    activeRequests.forEach((request) => request.abort());
    activeRequests.clear();
}
