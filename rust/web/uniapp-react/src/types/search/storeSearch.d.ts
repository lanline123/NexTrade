/**
 * 门店聚合搜索类型定义
 * 接口：GET o2o/storeSearch/getStoreProduct
 */

/** 门店聚合搜索请求参数 */
export interface StoreSearchParams {
    /** 门店分组 ID，多个用逗号分隔 */
    groupIds?: string;
    /** 历史单选分组 */
    groupId?: string;
    shopType?: 2;
    /** 商品关键词，为空时返回门店最低价商品 */
    keyword?: string;
    /** 经度 */
    longitude?: number | string;
    /** 纬度 */
    latitude?: number | string;
    /** 指定门店，多个用逗号分隔，0 为平台自营门店；传了则其余门店筛选条件失效 */
    shopIds?: string | number[];
    /** 区域ID */
    regionId?: string | number;
    /** 配送类型多选：1到店自提 2上门服务 3预约到店 4同城配送 5快递配送 */
    deliveryTypes?: number[];
    /** 传 1 仅返回同城配送范围内的门店 */
    withinDeliveryRange?: number;
    /** 传 1 排除平台自营门店 */
    excludeSelfOperated?: number;
    /** 页码，分页作用于门店 */
    page?: number;
    /** 每页门店数 */
    size?: number;
}

/** 门店下挂的商品项 */
export interface StoreSearchProduct {
    productId: number;
    productName: string;
    picThumb?: string;
    picUrl?: string;
    /** 原价 */
    productPrice?: number | string;
    /** 展示价（已含门店覆盖价、促销价、会员价） */
    price?: number | string;
    /** false 关键词命中；true 命中不足时按最低价补齐 */
    isFilled?: boolean;
}

/** 门店聚合搜索单条门店记录 */
export interface StoreSearchRecord {
    shopId: number;
    shopTitle: string;
    shopLogo?: string;
    address?: string;
    /** 距离，单位米；未传经纬度时为 null */
    distance?: number | null;
    longitude?: number;
    latitude?: number;
    shopStar?: number;
    shopStarNum?: number;
    shopSales?: number | string;
    /** 该门店是否开启同城配送，false 时不展示起送/配送费 */
    localDeliveryEnabled?: boolean;
    /** 起送价（元） */
    minOrderAmount?: number | string | null;
    /** 预估配送费（元） */
    deliveryFee?: number | string | null;
    /** 命中关键词的商品总数，可能大于 productList 长度 */
    hitProductCount?: number;
    /** 门店商品，命中项在前、补齐项在后，最多 10 条 */
    productList?: StoreSearchProduct[];
    collectShop?: boolean;
    inLocalDeliveryRange?: boolean;
    inHomeServiceRange?: boolean;
    tipNames?: any[] | null;
}

/** 门店聚合搜索分页数据 */
export interface StoreSearchData {
    records: StoreSearchRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

/** 门店聚合搜索响应 */
export interface StoreSearchResponse {
    data: StoreSearchData;
    code: number;
    message: string;
}
