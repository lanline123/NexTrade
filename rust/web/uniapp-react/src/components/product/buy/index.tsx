import type { ReactNode } from "react";
import { useRef } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { addToCart } from "@/api/product/product";
import { addExchangeToCart } from "@/api/exchange/exchange";
import { useConfigStore } from "@/store/config";
import { useCartStore } from "@/store/cart";
import { t } from "@/utils/i18n";

interface Props {
    id?: number;
    number?: number;
    skuId?: number;
    extraAttrIds?: string;
    disabled?: boolean;
    stock?: number | string;
    isQuick?: boolean;
    type?: string;
    skuItem?: any[];
    shopId?: number;
    /** 拼团信息 */
    grouponData?: any;
    /** 抽奖记录id */
    lotteryRecordId?: number;
    /** 周期购/次卡营销规格 id（旧 buy.vue 未声明该 prop，仅透传占位，保持调用点一致） */
    cycleSpecId?: number;
    /** 立即购买跳结算页时附加的 query（如门店自提 tab 锁定配送方式），以 & 开头 */
    checkQueryExtra?: string;
    children?: ReactNode;
    onCallback?: () => void;
}

/**
 * 加购/购买执行器（自旧 components/product/buy.vue 移植）：
 * - 非 isQuick：加入购物车并提示成功
 * - isQuick：加入购物车后直接跳结算页 /pages/order/check?flowType=xxx
 */
export default function Buy({
    id,
    number = 1,
    skuId,
    extraAttrIds = "",
    disabled = false,
    stock,
    isQuick = false,
    type,
    skuItem,
    shopId = 0,
    grouponData,
    lotteryRecordId,
    checkQueryExtra = "",
    children,
    onCallback
}: Props) {
    const loadingRef = useRef(false);

    const showToast = (message: string) => {
        Taro.showToast({ title: message, icon: "none", duration: 1500 });
    };

    const getSalemanId = (productId: number) => {
        const salesmanProducts = Taro.getStorageSync("salesmanProducts") || [];
        if (!salesmanProducts.length) return 0;
        const salesman = salesmanProducts.find((item: any) => item.productId == productId);
        return Number(salesman?.salesmanId) || 0;
    };

    const handleBuy = async () => {
        if (disabled || (stock !== undefined && Number(stock) <= 0)) return;

        try {
            if (loadingRef.current) return;
            loadingRef.current = true;
            const salesmanId = getSalemanId(id!);
            let result: any = {};
            const filterParams: any = {
                id: id ?? 0,
                number: number,
                skuId: skuId,
                isQuick: isQuick ? 1 : 0
            };
            if (extraAttrIds) {
                filterParams.extraAttrIds = extraAttrIds;
            }
            if (Array.isArray(skuItem) && skuItem.length > 0) {
                filterParams.skuItem = skuItem;
            }

            // 判断是否有拼团信息
            if (grouponData && grouponData.grouponPromotionId) {
                filterParams.grouponData = grouponData;
            }
            if (lotteryRecordId) {
                filterParams.lotteryRecordId = lotteryRecordId;
            }
            if (shopId && shopId > 0) {
                filterParams.shopId = shopId;
            }

            switch (type) {
                case "exchange":
                    result = await addExchangeToCart(filterParams);
                    break;
                default:
                    filterParams.salesmanId = salesmanId > 0 ? salesmanId : undefined;
                    result = await addToCart(filterParams);
            }
            onCallback?.();
            // 同步底部导航/头部购物车角标
            void useCartStore.getState().fetchCartCount(true);
            if (isQuick == true) {
                if (useConfigStore.getState().closeOrder === 1) return showToast(t("商城已关闭下单"));
                // 预约到店(9)/预约上门(10)走独立预约流程，不附加门店 tab 的配送方式锁定参数
                const extraQuery = [9, 10].includes(Number(result.flowType)) ? "" : checkQueryExtra;
                if (lotteryRecordId) {
                    return Taro.navigateTo({ url: `/pages/order/check?flowType=${result.flowType}&lotteryRecordId=${lotteryRecordId}${extraQuery}` });
                } else {
                    Taro.navigateTo({ url: `/pages/order/check?flowType=${result.flowType}${extraQuery}` });
                }
            } else {
                Taro.showToast({ title: t("加入购物车成功"), duration: 1500, icon: "none" });
            }
        } catch (error: any) {
            showToast(error.message);
        } finally {
            loadingRef.current = false;
        }
    };

    return (
        <View className="buy" onClick={(e) => { e.stopPropagation(); handleBuy(); }}>
            {children}
        </View>
    );
}
