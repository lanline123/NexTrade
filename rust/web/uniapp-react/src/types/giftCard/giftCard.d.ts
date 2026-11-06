/**
 * 礼品卡兑换提交参数
 */
export interface GiftCardExchangeParams {
    cardNumber: string;
    cardPassword: string;
}

export interface GiftCardProduct {
    productId: number;
    productSn: string;
    productName: string;
    categoryId: number;
    picUrl: string;
    skuId: number;
    skuData: string;
    shopId: number;
    skuPrice: number;
    productPrice: number;
}

export interface GiftCardGroupDetail {
    cardGroupsId: number;
    groupType: number;
    cardType: number;
    cardGroupName: string;
    validityType: number;
    expireTime: string;
    imageUrl: string;
    shopInfo: {
        shopId: number;
        shopTitle: string;
        shopImg: string;
    };
    giftCardProducts: GiftCardProduct[];
}

/**
 * 礼品卡分组详情响应结果
 */
export interface GiftCardDetailResponse {
    data: GiftCardInfo;
    code: number;
    message: string;
}

/**
 * 礼品卡详情
 */
export interface GiftCardInfo {
    giftCardsId: number;
    giftCardSn: string;
    cardGroupsId: number;
    cardNumber: string;
    cardPassword: string;
    cardGroupName: string;
    shopId: number;
    shopTitle: string;
    expiredTime?: number;
    shopLogo?: string;
    imageUrl?: string;
    isAvailable?: number; // 是否可用
    isExchange?: string; // 是否兑换
    isSold?: string; // 是否售出
    giftCardProducts?: GiftCardProduct[];
    giftCardGroups?: GiftCardGroupDetail;
    status?: number; // 0-未使用 1-已使用 2-已过期
}
