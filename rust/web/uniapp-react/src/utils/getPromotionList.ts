import { getPromotion } from "@/api/product/product";

interface PromotionFilterParams {
    products: Products[];
    shopId?: number;
    from?: string;
}
interface Products {
    productId: number;
    skuId?: number;
}

/** 批量获取商品促销信息（自旧 utils/getPromotionList.ts 移植） */
const getPromotionList = async (data: PromotionFilterParams) => {
    try {
        const result = await getPromotion({
            products: data.products,
            shopId: data.shopId,
            from: data.from
        });
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

export default getPromotionList;
