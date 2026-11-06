import type { ApiEnvelope } from "@/types/api";
import { t } from "@/utils/i18n";
import request from "@/utils/request";
import type {
    HomeResponse,
    GetCateProductFilterParams,
    GetCateProductResponse,
    SeckillListResponse,
    CouponResponse,
    GrouponItemListResponse
} from "@/types/home/home";
import type { WechatLiveGoodsState, WechatLiveRoomFilterParams, WechatLiveRoomFilterResult, WechatLiveRoomState } from "@/types/home/home";
import type { MobileCatNavFilterParams, MobileCatNavFilterResult } from "@/types/decorate/mobileCatNav.d";
import type { getProductListFilterState } from "@/types/decorate/mobileProduct";
import type { GrouponItemListParams } from "@/types/groupon/groupon";

const liveStatusMap: Record<number, string> = {
    0: t("草稿"),
    1: t("预告中"),
    2: t("直播中"),
    3: t("已结束"),
    4: t("禁播"),
    5: t("暂停"),
    6: t("异常"),
    7: t("已过期")
};

const auditStatusMap: Record<number, string> = {
    0: t("未审核"),
    1: t("审核中"),
    2: t("审核通过"),
    3: t("审核驳回")
};

const normalizeWechatLiveRoom = (item: any): WechatLiveRoomState => {
    const liveStatus = Number(item.liveStatus ?? 0);
    const auditStatus = item.auditStatus !== undefined ? Number(item.auditStatus) : undefined;
    const roomId = Number(item.roomId ?? 0);

    return {
        wechatLiveId: Number(item.wechatLiveId ?? item.id ?? roomId),
        roomId,
        roomIdStr: String(item.roomIdStr ?? roomId),
        name: item.name || item.wechatLiveTitle || "",
        wechatLiveTitle: item.wechatLiveTitle || item.name || "",
        coverImg: item.coverImg || item.backgroundWall || "",
        shareImg: item.shareImg || item.shareCardCover || "",
        feedsImg: item.feedsImg || item.liveCardCover || "",
        shareCardCover: item.shareCardCover || item.shareImg || "",
        liveCardCover: item.liveCardCover || item.feedsImg || "",
        backgroundWall: item.backgroundWall || item.coverImg || "",
        anchorName: item.anchorName || "",
        anchorWechat: item.anchorWechat || item.anchorOpenid || "",
        anchorOpenid: item.anchorOpenid || item.anchorWechat || "",
        isOfficialFeed: Number(item.isOfficialFeed ?? item.isFeedsPublic ?? 0),
        isFeedsPublic: Number(item.isFeedsPublic ?? item.isOfficialFeed ?? 0),
        auditStatus,
        auditStatusText: item.auditStatusText || (auditStatus !== undefined ? auditStatusMap[auditStatus] || "-" : "-"),
        liveStatus,
        liveStatusText: item.liveStatusText || liveStatusMap[liveStatus] || "-",
        startTime: item.startTime || "",
        endTime: item.endTime || "",
        createTime: item.createTime || "",
        lastUpdateTime: item.lastUpdateTime || ""
    };
};

/**
 * @description 获取首页装修数据
 * @param id 预览ID（可选，用于后台预览）
 * @returns 首页完整装修配置
 */
export const getIndex = (id?: number) => {
    const url = id ? `home/home/index?previewId=${id}` : "home/home/index";
    return request<HomeResponse>({
        url,
        method: "get"
    });
};

/**
 * @description 获取分类页装修配置（H5）
 * @param previewId 预览ID（可选，预览模式下传入）
 * @returns 分类页装修数据
 */
export const getH5CategoryDecorate = (previewId?: number | string) => {
    const hasPreviewId = previewId !== undefined && previewId !== null && previewId !== "" && previewId !== 0 && previewId !== "0";
    const url = hasPreviewId ? `home/home/h5Category?previewId=${previewId}` : "home/home/h5Category";
    return request<HomeResponse>({
        url,
        method: "get"
    });
};

/**
 * @description 获取首页分类导航栏
 * @param params 筛选条件
 * @returns 分类导航数据
 */
export const getMobileCatNavList = (params: MobileCatNavFilterParams) => {
    return request<MobileCatNavFilterResult>({
        url: "home/home/mobileCatNav",
        method: "get",
        params
    });
};

/**
 * @description 获取分类下商品列表
 * @param params 分类ID、分页等
 * @returns 商品列表
 */
export const getCateProduct = (params: GetCateProductFilterParams) => {
    return request<GetCateProductResponse>({
        url: "product/product/list",
        method: "get",
        params
    });
};

/**
 * @description 获取首页推荐商品列表
 * @param params 推荐类型、分页等
 * @returns 推荐商品列表
 */
export const getProductList = (params: object) => {
    return request<getProductListFilterState>({
        url: "home/home/getRecommend",
        method: "get",
        params
    });
};

/**
 * @description 获取首页秒杀活动
 * @returns 秒杀活动及商品列表
 */
export const getHomeSeckill = () => {
    return request<SeckillListResponse>({
        url: "home/home/getSeckill",
        method: "get"
    });
};

/**
 * @description 获取首页优惠券列表
 * @param id 店铺ID（可选）
 * @returns 优惠券列表
 */
export const getHomeCoupon = (id?: number) => {
    const url = id ? `home/home/getCoupon?shopId=${id}` : "home/home/getCoupon";
    return request<CouponResponse>({
        url,
        method: "get"
    });
};

/**
 * @description 获取用户中心装修配置
 * @param previewId 预览ID（可选，预览模式下传入）
 * @returns 用户中心页面装修数据
 */
export const getMemberDecorate = (previewId?: number | string) => {
    const hasPreviewId = previewId !== undefined && previewId !== null && previewId !== "" && previewId !== 0 && previewId !== "0";
    const url = hasPreviewId ? `home/home/h5Member?previewId=${previewId}` : "home/home/h5Member";
    return request({
        url,
        method: "get"
    });
};

/**
 * @description 获取老版本会员中心装修配置（兼容老用户）
 * - 返回广告位（bannerList）/ 菜单（menus）等老协议模块
 */
export const getMemberDecorateLegacy = () => {
    return request({
        url: "home/home/memberDecorate",
        method: "get"
    });
};

/**
 * @description 获取移动端登录页装修配置（新模块化装修：Decorate 页 H5 + pageType=5）
 * - 后端 home/home/mobileLogin 返回 DecorateModuleListVO，moduleList 中 type=mobileLogin 项的 module 为业务配置
 * - 与 PC 端 home/home/pcLogin 同构；未配置 / 接口缺失时前端全程兜底、样式零变化
 * @param previewId 预览ID（可选）
 * @returns 登录页装修模块列表
 */
export const getMobileLoginDecorate = (previewId?: number | string) => {
    const hasPreviewId = previewId !== undefined && previewId !== null && previewId !== "" && previewId !== 0 && previewId !== "0";
    const url = hasPreviewId ? `home/home/mobileLogin?previewId=${previewId}` : "home/home/mobileLogin";
    return request<ApiEnvelope<{ moduleList?: { type?: string; module?: Record<string, string> }[] }>>({
        url,
        method: "get"
    });
};

/**
 * @description 获取移动端搜索页装修配置（新模块化装修：Decorate 页 H5 + pageType=6）
 * - 后端 home/home/h5Search 返回 DecorateModuleListVO，moduleList 中 type=mobileSearchResult 项的 module 为业务配置
 * - 与 PC 端 home/home/pcSearch 同构；未配置 / 接口缺失时前端全程兜底、样式零变化
 * @param previewId 预览ID（可选，预览模式下传入）
 * @returns 搜索页装修模块列表
 */
export const getH5SearchDecorate = (previewId?: number | string) => {
    const hasPreviewId = previewId !== undefined && previewId !== null && previewId !== "" && previewId !== 0 && previewId !== "0";
    const url = hasPreviewId ? `home/home/h5Search?previewId=${previewId}` : "home/home/h5Search";
    return request<ApiEnvelope<{ moduleList?: { type?: string; module?: Record<string, any> }[] }>>({
        url,
        method: "get"
    });
};

/**
 * @description 获取商品详情页装修配置（H5，新模块化装修：Decorate 页 H5 + pageType=8）
 * - 后端 home/home/h5ProductDetail 返回 DecorateModuleListVO，moduleList 中 type=productDetailA1/A2/A3 项的 module 为业务配置
 * - module.decorateStyle 指定商详展示风格（A1 / A2 / A3）；未配置 / 接口缺失时前端全程兜底
 * @param previewId 预览ID（可选，预览模式下传入）
 * @returns 商品详情页装修模块列表
 */
export const getH5ProductDetailDecorate = (previewId?: number | string) => {
    const hasPreviewId = previewId !== undefined && previewId !== null && previewId !== "" && previewId !== 0 && previewId !== "0";
    const url = hasPreviewId ? `home/home/h5ProductDetail?previewId=${previewId}` : "home/home/h5ProductDetail";
    return request<ApiEnvelope<{ moduleList?: { type?: string; module?: Record<string, any> }[] }>>({
        url,
        method: "get"
    });
};

/**
 * @description 获取开屏广告
 * @returns 开屏广告配置
 */
export const getSplashAd = () => {
    return request({
        url: "decorate/discrete/getOpenAdvertising",
        method: "get"
    });
};

/**
 * @description 获取首页拼团商品列表
 * @param params 筛选条件
 * @returns 拼团商品列表
 */
export const getHomeGrouponList = (params: GrouponItemListParams) => {
    return request<GrouponItemListResponse>({
        url: "promotion/groupon/itemList",
        method: "get",
        params
    });
};

/**
 * @description 获取小程序直播间列表
 * @param params 查询参数
 * @returns 直播间分页列表
 */
export const getWechatLiveRoomList = (params: WechatLiveRoomFilterParams) => {
    return request<any>({
        url: "promotion/wechatLive/list",
        method: "get",
        params: {
            pageNum: params.page,
            pageSize: params.size,
            wechatLiveTitle: params.keyword,
            liveStatus: params.liveStatus,
            startTime: params.startTime,
            endTime: params.endTime
        }
    }).then((result) => {
        return {
            records: Array.isArray(result.records) ? result.records.map(normalizeWechatLiveRoom) : [],
            total: Number(result.total || 0)
        } as WechatLiveRoomFilterResult;
    });
};

/**
 * @description 获取直播间商品列表
 * @param roomId 直播间房间号
 * @returns 直播间商品数据
 */
export const getWechatLiveGoods = (roomId: number) => {
    return request<ApiEnvelope<any[]>>({
        url: `promotion/wechatLive/goods/${roomId}`,
        method: "get"
    }).then((result) => {
        return (Array.isArray(result) ? result : []).map((item) => {
            const auditStatus = item.auditStatus !== undefined ? Number(item.auditStatus) : undefined;
            return {
                id: Number(item.id ?? 0),
                roomId: Number(item.roomId ?? roomId),
                wechatGoodsId: item.wechatGoodsId ? Number(item.wechatGoodsId) : undefined,
                productId: Number(item.productId ?? 0),
                goodsName: item.goodsName || "",
                coverImg: item.coverImg || "",
                price: item.price !== undefined ? Number(item.price) : undefined,
                priceType: item.priceType !== undefined ? Number(item.priceType) : undefined,
                url: item.url || "",
                auditStatus,
                auditStatusText: item.auditStatusText || (auditStatus !== undefined ? auditStatusMap[auditStatus] || "-" : "-"),
                sort: item.sort !== undefined ? Number(item.sort) : undefined,
                isShow: item.isShow !== undefined ? Number(item.isShow) : undefined
            } as WechatLiveGoodsState;
        });
    });
};
