import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type { AddressFilterParams, AddressDetailResponse, AddressResponse } from "@/types/user/address";

/**
 * @description 获取收货地址常用标签列表
 * @returns 后端预设标签数组（如 ["家","公司","学校"]），前端在此基础上追加「自定义」
 */
export const getAddressTagList = () => {
    return request<ApiEnvelope<string[]>>({
        url: "user/address/tagList",
        method: "get"
    });
};

/**
 * @description 获取用户收货地址列表
 * @param params 筛选条件
 * @returns 地址列表
 */
export const getAddressList = (params: object) => {
    return request<AddressResponse>({
        url: "user/address/list",
        method: "get",
        params
    });
};

/**
 * @description 删除收货地址
 * @param data 包含地址ID
 * @returns 操作结果
 */
export const delAddress = (data: object) => {
    return request({
        url: "user/address/del",
        method: "post",
        data
    });
};

/**
 * @description 获取收货地址详情
 * @param params 包含地址ID
 * @returns 地址详细信息
 */
export const getAddressData = (params: object) => {
    return request<AddressDetailResponse>({
        url: "user/address/detail",
        method: "get",
        params
    });
};

/**
 * @description 新增收货地址
 * @param data 地址信息
 * @returns 新地址ID
 */
export const addAddressData = (data: object) => {
    return request<any>({
        url: "user/address/create",
        method: "post",
        data
    });
};

/**
 * @description 更新收货地址
 * @param data 地址信息
 * @returns 操作结果
 */
export const updateAddressData = (data: object) => {
    return request<any>({
        url: "user/address/update",
        method: "post",
        data
    });
};

/**
 * @description 设置当前选中的收货地址
 * @param data 包含地址ID
 * @returns 操作结果
 */
export const selectedAddress = (data: object) => {
    return request<any>({
        url: "user/address/setSelected",
        method: "post",
        data
    });
};
