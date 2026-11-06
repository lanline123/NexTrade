import { useCallback, useRef, useState } from "react";
import { useReachBottom } from "@tarojs/taro";

import getPromotionList from "@/utils/getPromotionList";

/**
 * @description: 列表hook（自旧 useList.ts composable 移植为 React 版）
 * @params api:请求接口
 * @params options:配置项
 * @params options.params:请求参数（与旧版一致：传入的对象会被本 hook 直接持有并原地改写 page/size，页面与 hook 共享同一份对象）
 * @params options.path:数据字段
 * @params options.immediate:是否立即请求
 * @params options.needReachBottom:是否需要触底加载
 * @params options.needPromotionList:是否需要获取促销列表
 * @params options.manageData:数据管理函数
 */

interface ListResponse<T> {
    [key: string]: any;
    list?: T[];
    total?: number;
}

interface ListOptions<P> {
    immediate?: boolean;
    needReachBottom?: boolean;
    needPromotionList?: boolean;
    params?: P;
    path?: {
        dataKey?: string;
        totalKey?: string;
        pageKey?: string;
        sizeKey?: string;
    };
    manageData?: (data: any[]) => void;
}

export default function useList<T = any, P extends object = Record<string, any>>(
    api: (params: P) => Promise<ListResponse<T>>,
    options: ListOptions<P>
) {
    const [data, setData] = useState<T[]>([]);
    const [promotionList, setPromotionList] = useState<Record<string, any>>({});
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadMore, setIsLoadMore] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const persistentExtraDataRef = useRef<Record<string, any>>({});
    const dataRef = useRef<T[]>([]);

    // 镜像 state 供触底闭包读取，避免 React 陈旧闭包
    const isLoadingRef = useRef(true);
    const isLoadMoreRef = useRef(false);
    const totalRef = useRef(0);

    const { immediate = false, needReachBottom = true, needPromotionList = false, path = {} } = options;
    const { dataKey = "list", totalKey = "total", pageKey = "page", sizeKey = "size" } = path;

    // 与旧版一致：params 对象由页面传入并被原地维护（分页字段直接改写）
    const paramsRef = useRef<Record<string, any>>((options.params ?? {}) as Record<string, any>);

    // 初始化分页参数
    if (!paramsRef.current[pageKey]) {
        paramsRef.current[pageKey] = 1;
    }
    if (!paramsRef.current[sizeKey]) {
        paramsRef.current[sizeKey] = 10;
    }

    const optionsRef = useRef(options);
    optionsRef.current = options;

    const getList = useCallback(
        async (extraData?: Partial<P> | (() => Partial<P>)) => {
            try {
                let transientExtraData: Record<string, any> = {};
                if (extraData !== undefined) {
                    const resolvedExtraData = typeof extraData === "function" ? (extraData as () => Partial<P>)() : extraData;
                    transientExtraData = (resolvedExtraData || {}) as Record<string, any>;
                    // 如果外部显式传了 page/size，则同步到内部分页状态，保证触底加载从正确页继续
                    if (transientExtraData[pageKey] !== undefined) {
                        paramsRef.current[pageKey] = transientExtraData[pageKey];
                    }
                    if (transientExtraData[sizeKey] !== undefined) {
                        paramsRef.current[sizeKey] = transientExtraData[sizeKey];
                    }
                    // 仅持久化过滤条件，不持久化 page/size，避免覆盖触底加载分页
                    const cloned = { ...transientExtraData };
                    delete cloned[pageKey];
                    delete cloned[sizeKey];
                    persistentExtraDataRef.current = { ...persistentExtraDataRef.current, ...cloned };
                }

                const requestData = {
                    ...paramsRef.current,
                    ...persistentExtraDataRef.current,
                    ...transientExtraData
                };

                if (requestData[pageKey] > 1) {
                    setIsLoadMore(true);
                    isLoadMoreRef.current = true;
                } else {
                    setIsLoading(true);
                    isLoadingRef.current = true;
                    setData([]); // 重置数据
                    dataRef.current = [];
                }

                const res = await api(requestData as P);
                const currentData = (dataKey === "" ? res : res?.[dataKey] ?? []) as unknown as T[];

                dataRef.current = requestData[pageKey] === 1 ? currentData : [...dataRef.current, ...currentData];
                setData(dataRef.current);
                setTotal(res?.[totalKey] ?? 0);
                totalRef.current = res?.[totalKey] ?? 0;

                if (needPromotionList && currentData.length) {
                    try {
                        const productIds = currentData.map((item: any) => ({
                            productId: item.productId
                        }));
                        const promotionListQuery: any = {
                            products: productIds,
                            from: "list"
                        };
                        // 自营门店使用 shopId=0，不能用 truthy 判断，否则促销接口会漏传门店 ID
                        const shopId = requestData.shopId;
                        if (shopId !== undefined && shopId !== null && shopId !== "") {
                            promotionListQuery.shopId = shopId;
                        }
                        const resPromotion = await getPromotionList(promotionListQuery);
                        setPromotionList((prev) => ({
                            ...prev,
                            ...resPromotion
                        }));
                    } catch (err) {
                        console.error("获取促销信息失败:", err);
                    }
                }

                if (optionsRef.current.manageData) {
                    optionsRef.current.manageData(dataRef.current);
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                setError(error);
                console.error("获取列表数据失败:", err);
            } finally {
                setIsLoading(false);
                isLoadingRef.current = false;
                setIsLoadMore(false);
                isLoadMoreRef.current = false;
            }
        },
        // api/dataKey/totalKey/pageKey/sizeKey/needPromotionList 均视为首挂载即固定（与旧版闭包一致）
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [api]
    );

    const resetState = useCallback(() => {
        setData([]);
        dataRef.current = [];
        setTotal(0);
        totalRef.current = 0;
        setError(null);
        paramsRef.current[pageKey] = 1;
        persistentExtraDataRef.current = {};
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 触底加载（needReachBottom=false 时等价于旧版不注册 onReachBottom）
    useReachBottom(() => {
        if (!needReachBottom) return;
        if (!isLoadingRef.current && !isLoadMoreRef.current && paramsRef.current[pageKey] < Math.ceil(totalRef.current / paramsRef.current[sizeKey])) {
            paramsRef.current[pageKey]++;
            void getList();
        }
    });

    // immediate：挂载后立即请求一次（对应旧版 setup 阶段的 getList()）
    const immediateRef = useRef(immediate);
    if (immediateRef.current) {
        immediateRef.current = false;
        void getList();
    }

    /** 手动改写 total（对应旧版直接对 ref 赋值，如搜索页 resetList 里的 total.value = 0） */
    const updateTotal = useCallback((value: number) => {
        totalRef.current = value;
        setTotal(value);
    }, []);

    return {
        data,
        promotionList,
        total,
        isLoading,
        isLoadMore,
        error,
        getList,
        resetState,
        updateTotal
    };
}
