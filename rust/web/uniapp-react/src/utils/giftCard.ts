import Taro from "@tarojs/taro";

import { t } from "@/utils/i18n";

// 旧格式前缀（保留用于向后兼容解析）
export const GIFT_CARD_COPY_PREFIX = "TIGSHOP_GIFTCARD|";

// 生成礼品卡复制格式（新格式：卡号：xxx\n卡密：xxx）
export const formatGiftCardCopyContent = (cardNumber: string, cardPassword: string) => {
    return `${t("卡号")}：${cardNumber}\n${t("卡密")}：${cardPassword}`;
};

// 解析礼品卡复制格式（兼容新旧两种格式）
export const parseGiftCardCopyContent = (content: string): { cardNumber: string; cardPassword: string } | null => {
    if (!content) return null;
    // 旧格式：TIGSHOP_GIFTCARD|卡号|卡密
    if (content.startsWith(GIFT_CARD_COPY_PREFIX)) {
        const parts = content.slice(GIFT_CARD_COPY_PREFIX.length).split("|");
        if (parts.length === 2) {
            return { cardNumber: parts[0], cardPassword: parts[1] };
        }
    }
    // 新格式：卡号：xxx\n卡密：xxx
    const lines = content
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    if (lines.length === 2) {
        const numberMatch = lines[0].match(/^(?:卡号|Card No\.?|Card Number)(?:：|:)\s*(.+)$/i);
        const pwdMatch = lines[1].match(/^(?:卡密|Card Pwd|Card Password)(?:：|:)\s*(.+)$/i);
        if (numberMatch && pwdMatch) {
            return { cardNumber: numberMatch[1].trim(), cardPassword: pwdMatch[1].trim() };
        }
    }
    return null;
};

/** 礼品卡商品订单类型 */
export const GIFT_CARD_ORDER_TYPE = 11;
/** 实体礼品卡商品类型，需物流配送 */
export const PHYSICAL_GIFT_CARD_PRODUCT_TYPE = 7;

type GiftCardAftersalesItem = { productType?: number | string | null } | null | undefined;
type GiftCardAftersalesOrder = { orderType?: number | string | null; items?: GiftCardAftersalesItem[] | null } | null | undefined;

/** 是否实体礼品卡商品行 */
export const isPhysicalGiftCardItem = (item: GiftCardAftersalesItem): boolean => {
    return Number(item?.productType ?? 0) === PHYSICAL_GIFT_CARD_PRODUCT_TYPE;
};

/**
 * 礼品卡订单是否禁止售后
 * 实体卡需要物流配送，售后能力与普通实体商品一致；只含电子卡的礼品卡订单仍不支持售后
 */
export const isGiftCardAftersalesBlocked = (order: GiftCardAftersalesOrder): boolean => {
    if (Number(order?.orderType ?? 0) !== GIFT_CARD_ORDER_TYPE) return false;
    return !(order?.items ?? []).some(isPhysicalGiftCardItem);
};

/** 礼品卡订单中单个商品行是否可申请售后：只放开实体卡商品行 */
export const canGiftCardItemApplyAftersales = (order: GiftCardAftersalesOrder, item: GiftCardAftersalesItem): boolean => {
    if (Number(order?.orderType ?? 0) !== GIFT_CARD_ORDER_TYPE) return true;
    return isPhysicalGiftCardItem(item);
};

/**
 * 复制礼品卡信息到剪切板
 * @param cardNumber 卡号
 * @param cardPassword 卡密
 * @returns Promise<boolean> 是否成功
 */
export const copyGiftCard = (cardNumber: string, cardPassword: string): Promise<boolean> => {
    const content = formatGiftCardCopyContent(cardNumber, cardPassword);
    return new Promise((resolve) => {
        Taro.setClipboardData({
            data: content,
            success: () => {
                resolve(true);
            },
            fail: (err) => {
                console.error("复制到剪切板失败", err);
                resolve(false);
            }
        });
    });
};