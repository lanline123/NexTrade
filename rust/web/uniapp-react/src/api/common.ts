import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type {
    GuessLikeDataResponse,
    GuessLikeIdsDataResponse,
    ConfigResponse,
    ThemeResponse,
    LangListResponse,
    DefaultLangResponse,
    CurrencyResponse,
    MobileAreaCodeResponse,
    ProductsListResponse
} from "@/types/common";

/**
 * @description 获取猜你喜欢商品列表
 * @param params 分页参数及场景参数
 * @returns 推荐商品列表
 */
export const getGuessLike = (params: object) => {
    return request<GuessLikeDataResponse>({
        url: "common/recommend/guessLike",
        method: "get",
        params
    });
};

/**
 * @description 获取猜你喜欢商品ID列表
 * @param params 场景参数
 * @returns 商品ID数组
 */
export const getGuessLikeIds = (params: object) => {
    return request<GuessLikeIdsDataResponse>({
        url: "common/recommend/getProductIds",
        method: "get",
        params
    });
};

/**
 * @description 获取基础配置
 * @returns 站点名称、Logo、版权信息等全局配置
 */
export const getBaseConfig = () => {
    return request<ConfigResponse>({
        url: "common/config/base",
        method: "get"
    });
};

/**
 * @description 获取移动端搜索风格
 * @returns 1 普通商品搜索；2 门店聚合搜索
 */
export const getMobileSearchStyle = () => {
    return request<{ code: number; message: string; data: number }>({
        url: "common/config/mobileSearchStyle",
        method: "get"
    });
};

/**
 * @description 初始化配置项（支持预览模式）
 * @param previewId 可选，装修预览ID
 * @returns 完整配置数据
 */
export const initConfigSettings = (previewId?: number) => {
    return request<ConfigResponse>({
        url: "common/config/initConfigSettings",
        method: "get",
        params: { previewId }
    });
};


/**
 * @description 获取主题配置
 * @returns 主题色、按钮样式等UI主题设置
 */
export const themeSettings = () => {
    return request<ThemeResponse>({
        url: "common/config/themeSettings",
        method: "get"
    });
};

/**
 * @description 生成二维码图片
 * @param url 需要编码的链接地址
 * @returns 二维码图片地址
 */
export const getQrCode = (url: string) => {
    return request({
        url: "common/util/qrCode?url=" + encodeURIComponent(url),
        method: "get"
    });
};

/**
 * @description 生成小程序码
 * @param url 小程序页面路径
 * @param productId 商品ID
 * @param salesmanId 分销员ID，分销员分享分销商品时携带，用于佣金归因
 * @param shopId 商品详情解析出的门店ID
 * @returns 小程序码图片地址
 */
export const getMiniCode = (url: string, productId: number, salesmanId?: string | number, shopId?: number) => {
    return request({
        url: "common/util/miniCode",
        method: "get",
        params: { path: url, id: productId, salesmanId, shopId }
    });
};

/** 解析小程序码 scene 短码（id+salesmanId 超 32 字符时后端存映射） */
export const resolveMiniScene = (scene: string) => {
    return request<ApiEnvelope<{ path?: string; id?: number; salesmanId?: number; shopId?: number }>>({
        url: "common/util/miniScene?scene=" + encodeURIComponent(scene),
        method: "get"
    });
};

/**
 * @description 获取客服配置
 * @returns 客服类型、联系方式、工作时间等
 */
export const getServiceConfig = () => {
    return request<any>({
        url: "home/home/getCustomerServiceConfig",
        method: "get"
    });
};

/**
 * @description 记录通用日志
 * @param params 日志内容
 * @returns 无业务数据
 */
export const commonLog = (params: AnyObject) => {
    return request({
        url: "common/log",
        method: "get",
        params
    });
};

/**
 * @description 获取指定语言的翻译包
 * @param localeCode 语言代码
 * @returns 翻译文本键值对
 */
export const getLang = (localeCode: string) => {
    return request({
        url: "common/i18n/getLocaleTranslations?localeCode=" + localeCode,
        method: "get"
    });
};

/**
 * @description 获取可用语言列表
 * @returns 语言列表
 */
export const getLangList = () => {
    return request<LangListResponse>({
        url: "common/i18n/getLocales",
        method: "get"
    });
};

/**
 * @description 获取默认语言配置
 * @param code 当前语言代码
 * @returns 默认语言信息
 */
export const getDefaultLang = (code: string) => {
    return request<DefaultLangResponse>({
        url: "common/i18n/getDefaultLocale?code=" + code,
        method: "get"
    });
};

/**
 * @description 文本翻译接口
 * @param data 待翻译文本及目标语言
 * @returns 翻译后的文本
 */
export const getTranslate = (data: object) => {
    return request<any>({
        url: "common/translate/translate",
        method: "post",
        data
    });
};

/**
 * @description 获取可用货币列表
 * @returns 货币列表
 */
export const getCurrencyList = () => {
    return request<CurrencyResponse>({
        url: "common/currency/getCurrency",
        method: "get"
    });
};

/**
 * @description 获取手机区号列表
 * @returns 国家/地区手机区号
 */
export const getmobileAreaCode = () => {
    return request<MobileAreaCodeResponse>({
        url: "common/config/mobileAreaCode",
        method: "get"
    });
};

/**
 * @description 通用商品列表查询
 * @param params 筛选条件
 * @returns 商品列表及分页信息
 */
export const getProductsList = (params: object) => {
    return request<ProductsListResponse>({
        url: "product/product/list",
        method: "get",
        params
    });
};

/**
 * @description 检查App更新
 * @param data 当前版本号、平台类型
 * @returns 是否有新版本、更新地址等
 */
export const getAppUpdate = (data: object) => {
    return request<any>({
        url: "appVersion/getAppUpdate",
        method: "post",
        data
    });
};
