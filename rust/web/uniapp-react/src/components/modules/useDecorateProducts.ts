import { getProductsList } from "@/api/common";

type DecorateProductOptions = {
    shopId?: number;
    extraParams?: Record<string, any>;
    allowEmptyParams?: boolean;
};

const paramsValueMap: Record<number, string[]> = {
    1: ["productIds"],
    2: ["productCategoryId", "productNumber"],
    3: ["productTag", "productNumber"]
};

const paramsKeyMap: Record<string, string> = {
    productIds: "ids",
    productCategoryId: "categoryId",
    productNumber: "size",
    productTag: "introType"
};

export const buildDecorateProductParams = (products: any, options: DecorateProductOptions = {}) => {
    const param: Record<string, any> = {};

    if (products && typeof products === "object" && products.productSelectType) {
        const type = Number(products.productSelectType);
        const keys = paramsValueMap[type];
        if (!keys) return null;

        if (type === 1) {
            const ids = Array.isArray(products.productIds) ? products.productIds : [];
            if (!ids.length) return null;
            param[paramsKeyMap[keys[0]]] = ids.join(",");
            param.size = ids.length;
        } else {
            param.page = 1;
            keys.forEach((key) => {
                param[paramsKeyMap[key]] = products[key];
            });
        }
    } else if (!options.allowEmptyParams) {
        return null;
    }

    if (options.shopId && options.shopId !== -1) {
        param.shopId = options.shopId;
    }

    return {
        ...(options.extraParams || {}),
        ...param
    };
};

export const getDecorateProducts = async (products: any, options: DecorateProductOptions = {}) => {
    const params = buildDecorateProductParams(products, options);
    if (!params) return [];

    const result = await getProductsList(params);
    return result.records ?? [];
};
