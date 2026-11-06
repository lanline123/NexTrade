import request from "@/utils/request";
import type { GiftCardDetailResponse, GiftCardExchangeParams } from "@/types/giftCard/giftCard";

/**
 * @description 礼品卡兑换
 * @param params 包含卡号、卡密
 * @returns 兑换结果（储值卡充值到余额/兑换商品进入购物流程）
 */
export const giftCardExchange = (params: GiftCardExchangeParams) => {
    return request({
        url: "promotion/giftCardGroups/exchange",
        method: "post",
        data: params
    });
};

/**
 * @description 获取礼品卡详情
 * @param cardNum 礼品卡卡号
 * @param giftCardSn 卡唯一序列号
 * @returns 礼品卡信息（面额、类型、有效期、状态）
 */
export const getGiftCardDetail = (cardNum: string, giftCardSn: string) => {
    return request<GiftCardDetailResponse>({
        url: "promotion/giftCardGroups/detail",
        method: "get",
        params: { cardNum, giftCardSn }
    });
};

/**
 * @description 查看礼品卡密码
 * @param cardNum 礼品卡卡号
 * @param giftCardSn 卡唯一序列号
 * @returns 礼品卡密码（脱敏处理）
 */
export const getGiftCardPassword = (cardNum: string, giftCardSn: string) => {
    return request({
        url: "promotion/giftCardGroups/showCardPassword",
        method: "get",
        params: { cardNum, giftCardSn }
    });
};

/**
 * @description 礼品卡转赠给他人
 * @param data 包含礼品卡序列号及转赠来源标识
 * @returns 转赠结果（生成分享链接/二维码）
 */
export const giftCardTransfer = (data: { giftCardSn: string; isFrom: string }) => {
    return request({
        url: "promotion/giftCardGroups/transfer",
        method: "post",
        data
    });
};

/**
 * @description 领取他人转赠的礼品卡
 * @param data 包含卡号及序列号
 * @returns 领取结果，礼品卡绑定到当前用户
 */
export const giftCardClaim = (data: { cardNum: string; giftCardSn: string }) => {
    return request({
        url: "promotion/giftCardGroups/claim",
        method: "post",
        data
    });
};
