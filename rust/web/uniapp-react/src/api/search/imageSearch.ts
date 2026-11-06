import Taro from "@tarojs/taro";

import request, { baseUrl, getSecret } from "@/utils/request";
import { getRequestRuntime } from "@/utils/requestRuntime";
import type { attrsData, attrsListData, ProductFilterResult, ProductListResponse } from "@/types/search/search";

/** 图搜结果的查询条件：必须带上传返回的 searchToken，其余沿用商品搜索的含义 */
export interface ImageSearchQuery {
    searchToken: string;
    attrs?: attrsData[];
    [key: string]: any;
}

export interface ImageSearchSession {
    searchToken: string;
}

export interface ImageSearchError {
    // -1 表示用户取消；0 表示网络错误或响应不是约定的 JSON
    code: number;
    message: string;
}

/** 图搜会话无效或已过期：结果页按没有数据处理，其余失败不属于这种情况 */
export const IMAGE_SEARCH_TOKEN_EXPIRED = 40001;

export const isImageSearchExpired = (error: unknown): boolean => {
    return !!error && (error as { code?: unknown }).code === IMAGE_SEARCH_TOKEN_EXPIRED;
};

/** 后台已关闭图搜：不提示，直接退出图搜流程 */
export const IMAGE_SEARCH_DISABLED = 403;

export const isImageSearchDisabled = (error: unknown): boolean => {
    return !!error && (error as { code?: unknown }).code === IMAGE_SEARCH_DISABLED;
};

// 上传包含图片预处理和云端检索，不能沿用普通列表的超时
const UPLOAD_TIMEOUT_MS = 90000;
const GUEST_SESSION_KEY = "imageSearchGuestSession";
const GUEST_SESSION_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * 游客图搜标识：上传、筛选、翻页必须是同一个值，所以生成一次后存在本地
 * 它不是登录凭证，已登录时后端以登录身份为准
 */
function getGuestSession(): string {
    let session = Taro.getStorageSync(GUEST_SESSION_KEY) as string;
    if (!session) {
        session = Array.from({ length: 32 }, () => GUEST_SESSION_CHARS[Math.floor(Math.random() * GUEST_SESSION_CHARS.length)]).join("");
        Taro.setStorageSync(GUEST_SESSION_KEY, session);
    }
    return session;
}

// 上传接口要求显式传端类型，后端按它判断对应的端开关
// 后端没有独立的小程序端类型，微信小程序暂时借用 H5 的端类型和开关
let CLIENT = "app";
if (process.env.TARO_ENV === "h5" || process.env.TARO_ENV === "weapp") {
    CLIENT = "h5";
}

const guestHeader = () => ({ "X-Image-Search-Session": getGuestSession() });

/**
 * @description 上传图片并创建图搜会话
 * @param filePath 本地图片路径
 * @param shopId 店铺内搜索时传店铺 ID，省略为全站
 * @returns promise 解析为会话；abort 取消上传（不保证撤销后端已发出的云端检索）
 */
export const searchByImage = (filePath: string, shopId?: number) => {
    let task: Taro.UploadTask | null = null;
    const promise = new Promise<ImageSearchSession>((resolve, reject) => {
        const runtime = getRequestRuntime();
        // 首批商品不带定位条件，结果页会重新请求第一页，这里只取最少数量
        const formData: Record<string, string> = { client: CLIENT, size: "1" };
        if (shopId !== undefined) formData.shopId = String(shopId);
        task = Taro.uploadFile({
            url: `${baseUrl}${process.env.TARO_APP_API_PREFIX || "/api/"}search/image/search`,
            filePath,
            name: "file",
            formData,
            timeout: UPLOAD_TIMEOUT_MS,
            // 身份头与 request 封装保持一致，保证上传和后续列表请求被识别为同一身份
            header: {
                Authorization: "Bearer " + (Taro.getStorageSync("token") ? Taro.getStorageSync("token") : null),
                ...guestHeader(),
                "X-Client-Type": runtime.getClientType(),
                "X-Locale-Code": runtime.getLocaleCode(),
                Secret: getSecret()
            },
            success: (res) => {
                try {
                    const body = JSON.parse(res.data);
                    if (body.code === 0 && body.data?.searchToken) {
                        resolve({ searchToken: body.data.searchToken });
                    } else {
                        reject({ code: Number(body.code) || 0, message: body.message || "" } as ImageSearchError);
                    }
                } catch {
                    reject({ code: 0, message: "" } as ImageSearchError);
                }
            },
            fail: (err) => {
                const aborted = (err?.errMsg || "").indexOf("abort") !== -1;
                reject({ code: aborted ? -1 : 0, message: "" } as ImageSearchError);
            }
        });
    });
    return { promise, abort: () => task?.abort() };
};

/**
 * @description 图搜结果的商品列表，条件只在本次图片召回的商品内生效
 * @param data 查询条件、排序与分页
 * @returns 商品分页
 */
export const getImageSearchProduct = (data: ImageSearchQuery) => {
    return request<ProductListResponse>({
        url: "search/search/getProduct",
        method: "post",
        data,
        header: guestHeader()
    });
};

/**
 * @description 图搜结果的筛选项
 * @param data 与商品列表一致的查询条件
 * @returns 本次相似商品内的分类、品牌和最高价
 */
export const getImageSearchFilter = (data: ImageSearchQuery) => {
    return request<ProductFilterResult>({
        url: "search/search/getFilter",
        method: "post",
        data,
        header: guestHeader()
    });
};

/**
 * @description 图搜结果的属性筛选建议
 * @param query 与商品列表一致的查询条件
 * @returns 属性名称及可选值
 */
export const getImageSearchAttributes = (query: ImageSearchQuery) => {
    const { attrs = [], ...params } = query;
    // GET 的对象数组必须按下标展开，后端不接受 JSON 字符串
    attrs.forEach((attr, i) => {
        params[`attrs[${i}].attrName`] = attr.attrName;
        attr.attrValue.forEach((value, j) => {
            params[`attrs[${i}].attrValue[${j}]`] = value;
        });
    });
    return request<{ data: { attributes: attrsListData[] }; code: number; message: string }>({
        url: "search/search/getAttributeSuggestions",
        method: "get",
        params,
        header: guestHeader()
    });
};

export interface ImageSearchCapabilities {
    enabled: boolean;
    h5Enabled: boolean;
    pcEnabled: boolean;
    appEnabled: boolean;
    /** 店铺/门店内图搜开关，已结合总开关计算；端开关仍需另外判断 */
    shopEnabled?: boolean;
    formats: string[];
}

/**
 * @description 读取图搜能力和各端开关
 * @returns 端开关已结合总开关计算；图搜默认关闭，由后台开关控制
 */
export const getImageSearchCapabilities = () => {
    return request<{ data: ImageSearchCapabilities; code: number; message: string }>({
        url: "search/image/capabilities",
        method: "get",
        noSkipLogin: true
    });
};
