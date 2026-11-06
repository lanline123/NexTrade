import { isReservationProductType, isSubCardReservationProduct as checkIsSubCardReservationProduct } from "@/utils/productSoldOut";
import type { ProductItem } from "@/types/product/product";
import type { PresaleInfo } from "@/types/presale/presale";

/**
 * 商品类型判断 Hook（自 uniapp pages/product/composables/useProductType.ts 移植）
 *
 * @description 从商品详情派生的类型判断（预约 / 虚拟 / 付费内容 / 预售 / 次卡预约）
 * 判断逻辑与 pages/product/index.vue 保持一致，纯派生、无副作用
 */
export interface UseProductTypeOptions {
    /** 商品详情数据（对应旧 Ref<ProductItem>，React 下直接传 state 值） */
    product?: ProductItem;
    /** 是否次卡（默认 false） */
    isSubCard?: boolean;
}

export interface UseProductTypeReturn {
    /** 是否预约商品（productType 5 / 6） */
    isReservation: boolean;
    /** 是否虚拟 / 卡密商品（productType 2 / 3） */
    isVirtual: boolean;
    /** 是否付费内容商品（productType 4） */
    isPaidContent: boolean;
    /** 是否预售商品（saleMode > 0） */
    isPresale: boolean;
    /** 预售信息（saleMode > 0 时存在） */
    productPresale: PresaleInfo | null;
    /** 是否次卡预约商品 */
    isSubCardReservationProduct: boolean;
    /** 预约方式文案 */
    reserveModeText: string;
    /** 预约提示文案 */
    reserveTipText: string;
}

export function useProductType(options: UseProductTypeOptions = {}): UseProductTypeReturn {
    const { product, isSubCard = false } = options;

    // 旧实现为 computed 链；React 下每次渲染直接重算，语义等价（纯派生、无副作用）
    const productPresale: PresaleInfo | null = (() => {
        const info = (product as any)?.presaleInfo;
        const saleMode = Number((product as any)?.saleMode ?? info?.saleMode ?? 0);
        if (saleMode > 0 && info) return info as PresaleInfo;
        return null;
    })();

    const isPresale = Number(productPresale?.saleMode ?? 0) > 0;

    const isReservation = (() => {
        const productType = Number(product?.productType ?? 0);
        const flowType = Number(product?.flowType ?? 0);
        return isReservationProductType(productType) || [9, 10].includes(flowType);
    })();

    const isVirtual = [2, 3].includes(Number(product?.productType ?? 0));

    const isPaidContent = Number(product?.productType ?? 0) === 4;

    const isSubCardReservationProduct = checkIsSubCardReservationProduct(product as unknown as Record<string, unknown>, isSubCard);

    const reserveModeText = (() => {
        const flowType = Number(product?.flowType ?? 0);
        if (flowType === 9) return "到店服务";
        if (flowType === 10) return "上门服务";
        const productType = Number(product?.productType ?? 0);
        if (productType === 5) return "到店服务";
        if (productType === 6) return "上门服务";
        return "预约服务";
    })();

    const reserveTipText = (() => {
        if (reserveModeText === "上门服务") return "下单时需选择预约时间段，建议提前与商家沟通上门安排";
        if (reserveModeText === "到店服务") return "下单时需选择预约时间段，请按预约时间到店消费";
        return "下单时需选择预约时间段";
    })();

    return {
        isReservation,
        isVirtual,
        isPaidContent,
        isPresale,
        productPresale,
        isSubCardReservationProduct,
        reserveModeText,
        reserveTipText
    };
}

export default useProductType;
