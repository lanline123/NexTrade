import type { StoreListParams, StoreDetailParams, PickupInfoParams } from "@/types/store/store";
import request from "@/utils/request";
import type { StoreListResponse, StoreDetailResponse, PickupInfoResponse } from "@/types/store/store";

/**
 * @description 获取门店列表
 * @param params 筛选条件（位置、距离排序、分页等）
 * @returns 门店列表，含位置、营业状态、配送范围等
 */
export const getStoreList = (params: StoreListParams) => {
    return request<StoreListResponse>({
        url: "shop/shop/storeList",
        method: "get",
        params
    });
};

/**
 * @description 获取门店详情
 * @param params 包含门店ID
 * @returns 门店完整信息（地址、营业时间、联系方式、配送设置等）
 */
export const getStoreDetail = (params: StoreDetailParams) => {
    return request<StoreDetailResponse>({
        url: "shop/shop/storeDetail",
        method: "get",
        params
    });
};

/**
 * @description 获取配送方式选项
 * @param params 包含门店ID、收货地址等
 * @returns 可用配送方式列表（快递/同城配送/到店自提）
 */
export const getDeliveryOptions = (params?: object) => {
    return request<any>({
        url: "o2o/orderPickup/getDeliveryOptions",
        method: "get",
        params
    });
};

/**
 * @description 获取自提订单取货信息
 * @param params 包含订单ID
 * @returns 自提点信息、取货码、取货时间等
 */
export const getPickupInfo = (params?: PickupInfoParams) => {
    return request<PickupInfoResponse>({
        url: "o2o/orderPickup/getOrderPickupShipment",
        method: "get",
        params
    });
};

/**
 * @description 获取门店评价列表
 * @param params 包含门店ID、分页参数
 * @returns 门店评价列表
 */
export const getShopCommentList = (params?: object) => {
    return request<any>({
        url: "shop/shop/getCommentList",
        method: "get",
        params
    });
};

/**
 * @description 获取自提点列表
 * @param params 筛选条件
 * @returns 可用自提点列表
 */
export const gePickupList = (params?: object) => {
    return request<any>({
        url: "shop/shop/pickupList",
        method: "get",
        params
    });
};

/**
 * @description 获取门店自提模板配置
 * @param params 包含门店ID
 * @returns 自提时间模板（可选取货时间段）
 */
export const getShopPickupTpl = (params?: object) => {
    return request<any>({
        url: "o2o/orderPickup/getShopPickupTpl",
        method: "get",
        params
    });
};

/**
 * @description 获取O2O门店首页装修数据
 * @param params 包含门店ID
 * @returns 门店首页装修配置
 */
export const getStoreDecorate = (params?: object) => {
    return request<any>({
        url: "home/home/o2oIndex",
        method: "get",
        params
    });
};
