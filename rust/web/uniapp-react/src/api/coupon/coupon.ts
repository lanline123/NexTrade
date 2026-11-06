import request from "@/utils/request";
import type {
    CouponResponse,
    CouponFilterParams,
    CouponListByIdsResponse,
    CouponDetailResponse,
    CouponInfoParams,
    DiscountAmountResponse
} from "@/types/coupon/coupon";

/**
 * @description 获取可领取优惠券列表
 * @param params 筛选条件
 * @returns 优惠券列表
 */
export const getCouponList = (params: CouponFilterParams) => {
    return request<CouponResponse>({
        url: "user/coupon/getList",
        method: "get",
        params
    });
};

/**
 * @description 获取我的优惠券列表
 * @param params 筛选条件（状态等）
 * @returns 用户已领取的优惠券列表
 */
export const getMyCouponList = (params: CouponFilterParams) => {
    return request<CouponResponse>({
        url: "user/coupon/list",
        method: "get",
        params
    });
};

/**
 * @description 领取优惠券
 * @param data 包含优惠券ID
 * @returns 领取结果
 */
export const addCoupon = (data: object) => {
    return request({
        url: "user/coupon/claim",
        method: "post",
        data
    });
};

/**
 * @description 删除我的优惠券
 * @param data 包含优惠券ID
 * @returns 操作结果
 */
export const delCoupon = (data: object) => {
    return request({
        url: "user/coupon/del",
        method: "post",
        data
    });
};

/**
 * @description 获取优惠券详情
 * @param params 包含优惠券ID
 * @returns 优惠券详情
 */
export const getMyCouponInfo = (params: CouponInfoParams) => {
    return request<CouponDetailResponse>({
        url: "user/coupon/detail",
        method: "get",
        params
    });
};

/**
 * @description 检查优惠券是否可用并计算优惠金额
 * @param id 优惠券ID
 * @returns 是否可用及优惠金额
 */
export const getCouponDiscount = (id: number) => {
    return request<DiscountAmountResponse>({
        url: "cart/cart/getCouponDiscount?couponId=" + id,
        method: "get"
    });
};

/**
 * @description 按 IDs 批量获取优惠券信息
 * @param ids 优惠券 ID 数组
 * @returns 优惠券列表（已删除的券不返回，顺序不保证与入参一致）
 * - 用于装修模块（如新人二重礼）一次性回显多张已选优惠券
 * - 与 admin 端 getCouponListByIds 共用 promotion/coupon/listByIds 接口
 */
export const getCouponListByIds = (ids: number[]) => {
    return request<CouponListByIdsResponse>({
        url: "promotion/coupon/listByIds",
        method: "get",
        params: { ids: ids.join(",") }
    });
};
