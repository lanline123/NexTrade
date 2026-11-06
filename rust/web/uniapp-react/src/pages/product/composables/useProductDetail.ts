import { useCallback, useRef, useState } from "react";
import Taro from "@tarojs/taro";
import { createRawImageContext, type RawImageContext } from "@/utils/productRawImageDownload";
import { normalizeProductQuery } from "@/utils/productQuery";
import { isProductOfflineError } from "@/utils/productSale";
import { getProductDetail as fetchProductDetail } from "@/api/product/product";
import { getExchangeDetail } from "@/api/exchange/exchange";
import { getActiveStyle } from "@/api/product/productStyle";
import { getShopDetail } from "@/api/shop/shop";
import { getStoreDetail } from "@/api/store/store";
import { useConfigStore } from "@/store/config";import { productImage } from "@/utils/format";
import { isO2o } from "@/utils";
import { setPageMeta, setJsonLd, extractDescription, clearJsonLd } from "@/utils/seo";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";
import type { PicList, ProductItem, AttrList, SkuList, ServiceList, RankDetail, DescArr, SkuPromotion, VideoList } from "@/types/product/product";
import type { ShopDetailItem } from "@/types/shop/shop";
import type { StoreDetailData } from "@/types/store/store";

/**
 * 商品详情数据获取和管理 Hook（自 uniapp pages/product/composables/useProductDetail.ts 移植）
 *
 * @description 拉取商品 / 兑换详情并落地各字段，处理门店参数、店铺与门店详情、
 * 活动样式、SEO（H5）、周期购 / 次卡回填与加载时序（detailLoaded + specLoaded 双闸）
 * 逻辑与 pages/product/index.vue 的 __getProductDetail 保持一致
 */
export interface UseProductDetailOptions {
    /** 商品类型：默认普通商品，exchange 为积分兑换商品（对应旧 Ref<string>，React 下直接传值） */
    type?: string;
    /** 详情加载完成后的回调（页面用于 handleLog 等；回传原始响应，供页面按需消费如批发字段） */
    onDetailLoaded?: (result?: any) => void;
}

export function useProductDetail(options: UseProductDetailOptions = {}) {
    const { type = "", onDetailLoaded } = options;

    // type / onDetailLoaded 以 ref 镜像，保证 getProductDetail 引用稳定（对应旧 Ref 读值语义）
    const typeRef = useRef(type);
    typeRef.current = type;
    const onDetailLoadedRef = useRef(onDetailLoaded);
    onDetailLoadedRef.current = onDetailLoaded;

    // 对应旧 useRegionStore() / useConfigStore()：Vue 版仅在方法内一次性读取（无模板依赖、不建立订阅），
    // 这里改为调用时 useConfigStore.getState() 读取，避免整库订阅引发多余重渲染。
    // useRegionStore 在 Vue 版中声明后未使用，保持不移植。

    // 基础数据
    const [rawImageContext, setRawImageContext] = useState<RawImageContext | null>(null);
    const detailGenerationRef = useRef(0);
    const lastDetailInputRef = useRef<string | number | object>("");
    const lastDetailParamsRef = useRef<Record<string, unknown> | undefined>(undefined);
    const [productId, setProductId] = useState<string>("");
    const [specificationId, setSpecificationId] = useState<number>(0);
    const [skuId, setSkuId] = useState<number>(0);
    const [product, setProduct] = useState<ProductItem>({
        productId: 0,
        productStock: 0
    });

    // 详情数据
    const [picList, setPicList] = useState<PicList[]>([]);
    const [videoList, setVideoList] = useState<VideoList[]>([]);
    const [attrList, setAttrList] = useState<AttrList>({} as AttrList);
    const [skuList, setSkuList] = useState<SkuList[]>([]);
    const [descArr, setDescArr] = useState<DescArr[]>([]);
    const [serviceList, setServiceList] = useState<ServiceList[]>([]);
    const [rankDetail, setRankDetail] = useState<RankDetail>({});
    const [checkedValue, setCheckedValue] = useState<string[]>([]);

    // 价格 / 库存 / 促销
    const [productPrice, setProductPrice] = useState<string>("0");
    const [productStock, setProductStock] = useState<number>(0);
    const [exchangeIntegral, setExchangeIntegral] = useState<number>(0);
    const [promotionList, setPromotionList] = useState<SkuPromotion[]>([]);

    // 店铺 / 门店
    const [shopId, setShopId] = useState<number>(-1);
    const [storeInfo, setStoreInfo] = useState<StoreDetailData>({} as StoreDetailData);
    const [shopInfo, setShopInfo] = useState<ShopDetailItem>({} as ShopDetailItem);

    // 周期购字段
    const [cycleInfo, setCycleInfo] = useState<any>({});
    const [isCycleBuy, setIsCycleBuy] = useState(false);
    const [isSubCard, setIsSubCard] = useState(false);

    // 活动样式
    const [activityStyleData, setActivityStyleData] = useState<ProductActiveStyleVO | null>(null);

    // 加载状态（detailLoaded / specLoaded / failLoad 会在 getProductDetail 异步流程内回读，
    // 统一「state + ref 镜像」双写）
    const [loadEndStatus, setLoadEndStatus] = useState(true);
    const [detailLoaded, setDetailLoaded] = useState(false);
    const [specLoaded, setSpecLoaded] = useState(false);
    const [failLoad, setFailLoad] = useState(false);
    const [productOffline, setProductOffline] = useState(false);
    const detailLoadedRef = useRef(false);
    const specLoadedRef = useRef(false);
    const failLoadRef = useRef(false);

    /** 活动背景图（对应旧 computed activityBgImage） */
    const activityBgImage = activityStyleData?.activityBackgroundImage || "";

    /**
     * 获取活动样式
     */
    const fetchActivityStyle = useCallback(async (pid: number): Promise<void> => {
        try {
            const result = await getActiveStyle(pid);
            setActivityStyleData(result);
        } catch {
            setActivityStyleData(null);
        }
    }, []);

    /**
     * 获取门店详情（O2O）
     */
    const getStoreDetailData = useCallback(async (id: number): Promise<void> => {
        try {
            const result = await getStoreDetail({ shopId: id });
            setStoreInfo(result);
        } catch (error) {
            console.error("Error fetching store details:", error);
        }
    }, []);

    /**
     * 获取店铺信息（客服入口 / 店铺相关）
     */
    const getShopInfo = useCallback(async (id: number): Promise<void> => {
        try {
            const result = await getShopDetail(id);
            setShopInfo(result);
        } catch (error: any) {
            console.error(error);
        }
    }, []);

    /**
     * 获取商品详情
     * O2O 场景优先使用指定门店 ID，否则使用最近门店 ID；支持普通商品与积分兑换两种模式
     * @param id 商品 ID 或包含 sn 的对象
     */
    const getProductDetail = useCallback(
        async (id: string | number | object, requestParams?: Record<string, unknown>): Promise<void> => {
            const generation = ++detailGenerationRef.current;
            setRawImageContext(null);
            setProductOffline(false);
            try {
                setLoadEndStatus(true);
                setDetailLoaded(false);
                detailLoadedRef.current = false;
                setFailLoad(false);
                failLoadRef.current = false;
                let result: any = {};

                let params: any = {};

                if (typeof id === "object") {
                    params = { ...params, ...id };
                } else {
                    params.id = id;
                }

                params = requestParams ? { ...requestParams } : normalizeProductQuery(params, isO2o());
                switch (typeRef.current) {
                    case "exchange":
                        if (typeof id === "object") return;
                        result = await getExchangeDetail(params);
                        if (generation !== detailGenerationRef.current) return;
                        setExchangeIntegral(result.exchangeInfo.exchangeIntegral);
                        setProductStock(Number(result.exchangeInfo?.productStock ?? 0));
                        setProductPrice(result.exchangeInfo.discountsPrice || "0");
                        setSpecificationId(result.exchangeInfo.id);
                        break;
                    default:
                        result = await fetchProductDetail(params);
                        if (generation !== detailGenerationRef.current) return;
                        setProductStock(Number(result.item?.productStock ?? 0));
                        setProductPrice(result.item.productPrice || "0");
                        setSpecificationId(result.item.productId);
                }
                lastDetailInputRef.current = typeof id === "object" ? { ...id } : id;
                lastDetailParamsRef.current = { ...params };
                setRawImageContext(createRawImageContext(result.item.productId, params));
                setProductId(String(result.item.productId ?? ""));
                setProduct(result.item);
                setAttrList(result.attrList);
                setPicList(result.picList);
                setVideoList(result.videoList);
                setRankDetail(result.rankDetail);
                setSkuList(result.skuList);
                setCheckedValue(result.checkedValue);
                setDescArr(result.descArr);
                setServiceList(result.serviceList);
                Taro.setNavigationBarTitle({
                    title: result.item.productName
                });
                // 对应旧 #ifdef H5（SEO 仅 H5 生效）
                if (process.env.TARO_ENV === "h5") {
                    const shopTitle = useConfigStore.getState().baseInfo.shopTitle;
                    const productTitle = `${result.item.productName} - ${shopTitle}`;
                    const productDesc = extractDescription(result.item.productBrief || result.item.productDesc || result.item.productName);
                    const productImageUrl = productImage(result.item);

                    setPageMeta({
                        title: productTitle,
                        description: productDesc,
                        keywords: result.item.productName,
                        image: productImageUrl,
                        type: "product"
                    });

                    setJsonLd({
                        "@context": "https://schema.org",
                        "@type": "Product",
                        name: result.item.productName,
                        description: productDesc,
                        image: productImageUrl,
                        url: window.location.href,
                        offers: {
                            "@type": "Offer",
                            price: result.item.productPrice,
                            priceCurrency: "CNY",
                            availability: result.item.productStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
                        }
                    });
                }

                // 路由门店只用于请求详情；后续业务统一使用详情接口最终解析出的门店。
                const detailShopId = result.item?.shopId ?? result.shopId;
                const finalShopId = typeof detailShopId === "number" && Number.isFinite(detailShopId) ? detailShopId : -1;
                setShopId(finalShopId);

                if (finalShopId > -1) {
                    void getShopInfo(finalShopId);
                }

                void fetchActivityStyle(result.item.productId);

                // 数据已落地，允许展示“已售罄”遮罩（最终是否售罄由库存判断决定）
                setDetailLoaded(true);
                detailLoadedRef.current = true;

                onDetailLoadedRef.current?.(result);

                // 只有“规格组件加载完成 + 详情接口落地完成”同时满足，才结束 loading
                if (specLoadedRef.current) setLoadEndStatus(false);
            } catch (error: any) {
                if (generation !== detailGenerationRef.current) return;
                setRawImageContext(null);
                console.error(error);
                setProductOffline(isProductOfflineError(error));
                setFailLoad(true);
                failLoadRef.current = true;
                setLoadEndStatus(false);
            } finally {
                if (generation !== detailGenerationRef.current) return;
                if (failLoadRef.current) {
                    setLoadEndStatus(false);
                } else if (detailLoadedRef.current && specLoadedRef.current) {
                    setLoadEndStatus(false);
                } else {
                    setLoadEndStatus(true);
                }
            }
        },
        [getShopInfo, fetchActivityStyle]
    );

    /**
     * 规格组件加载完成回调，隐藏加载页
     */
    const getLoadStatus = useCallback((): void => {
        setSpecLoaded(true);
        specLoadedRef.current = true;
        if (detailLoadedRef.current) {
            setLoadEndStatus(false);
        }
    }, []);

    /**
     * 用上一次请求的入参重新拉取详情（原图下载换配置后刷新上下文用）
     */
    const reloadRawImageDetail = useCallback(
        () => getProductDetail(lastDetailInputRef.current, lastDetailParamsRef.current),
        [getProductDetail]
    );

    return {
        rawImageContext,
        setRawImageContext,
        reloadRawImageDetail,
        // 基础数据
        productId,
        setProductId,
        specificationId,
        setSpecificationId,
        skuId,
        setSkuId,
        product,
        setProduct,
        // 详情数据
        picList,
        setPicList,
        videoList,
        setVideoList,
        attrList,
        setAttrList,
        skuList,
        setSkuList,
        descArr,
        setDescArr,
        serviceList,
        setServiceList,
        rankDetail,
        setRankDetail,
        checkedValue,
        setCheckedValue,
        // 价格 / 库存 / 促销
        productPrice,
        setProductPrice,
        productStock,
        setProductStock,
        exchangeIntegral,
        setExchangeIntegral,
        promotionList,
        setPromotionList,
        // 店铺 / 门店
        shopId,
        setShopId,
        storeInfo,
        setStoreInfo,
        shopInfo,
        setShopInfo,
        // 周期购
        cycleInfo,
        setCycleInfo,
        isCycleBuy,
        setIsCycleBuy,
        isSubCard,
        setIsSubCard,
        // 活动样式
        activityStyleData,
        setActivityStyleData,
        activityBgImage,
        // 状态
        loadEndStatus,
        setLoadEndStatus,
        detailLoaded,
        setDetailLoaded,
        specLoaded,
        setSpecLoaded,
        failLoad,
        setFailLoad,
        productOffline,
        setProductOffline,
        // 方法
        getProductDetail,
        getStoreDetailData,
        getShopInfo,
        fetchActivityStyle,
        getLoadStatus,
        // 兑换清理（H5 SEO）
        clearJsonLd
    };
}

export default useProductDetail;
