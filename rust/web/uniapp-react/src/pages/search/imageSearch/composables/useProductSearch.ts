import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCategoryProduct } from "@/api/search/search";
import useList from "@/hooks/useList";
import getPromotionList from "@/utils/getPromotionList";

import { getLocationParams, nextSortState, type SortState, type SortValue } from "../utils/searchRequest";

type ProductApi = (data: any) => Promise<any>;

/**
 * 商品列表的查询、排序与分页（自旧 composables/useProductSearch.ts 移植为 React hook）
 * 触底由调用方决定何时触发：结果页用页面滚动
 * @param api 默认是普通商品搜索；图搜结果传带会话的列表接口
 * @param getConditions 每次从第一页查询时附带的条件，如图搜会话和筛选项
 */
export function useProductSearch(api: ProductApi = getCategoryProduct, getConditions: () => Record<string, any> = () => ({})) {
    // 与旧 reactive 同构：单个可变对象，useList 会原地改写 page/size
    const params = useMemo(() => ({ page: 1, size: 10, sort: "default", order: "", keyword: "", pageType: "search" }), []);
    const [sortState, setSortState] = useState<SortState>({ sort: "default", order: "" });
    const [promotionList, setPromotionList] = useState<Record<string, any>>({});

    // 对应旧 latestOnly：序号之外的旧响应不再写回促销，也不让旧结果覆盖新数据
    const seqRef = useRef(0);
    // 供闭包读取的最新态镜像，避免 React 陈旧闭包
    const errorRef = useRef<Error | null>(null);
    const isLoadingRef = useRef(true);
    const isLoadMoreRef = useRef(false);
    const totalRef = useRef(0);

    const requestApi = useCallback(
        async (data: any) => {
            const id = ++seqRef.current;
            // 保留后端文案与 code，供调用方区分失败原因。
            const result = await api(data).catch((err: any) => {
                throw Object.assign(new Error(err?.message || ""), { code: err?.code });
            });
            if (id !== seqRef.current) {
                // 迟到的旧请求：丢掉内容，避免覆盖当前列表（对应旧 latestOnly 不 resolve）
                return { records: [], total: 0 };
            }
            let promotions: Record<string, any> = {};
            if (result?.records?.length) {
                try {
                    const shopId = data.shopId;
                    promotions = await getPromotionList({
                        products: result.records.map((item: any) => ({ productId: item.productId })),
                        from: "list",
                        ...(shopId !== undefined && shopId !== null && shopId !== "" ? { shopId } : {})
                    });
                } catch (err) {
                    // 促销失败不阻断商品列表。
                    console.error("获取促销信息失败:", err);
                }
            }
            if (id !== seqRef.current) return { records: [], total: 0 };
            setPromotionList((prev) => ({ ...prev, ...promotions }));
            return result;
        },
        [api]
    );

    const list = useList<any>(requestApi, {
        params,
        path: { dataKey: "records" },
        needReachBottom: false
    });

    useEffect(() => {
        errorRef.current = list.error;
        isLoadingRef.current = list.isLoading;
        isLoadMoreRef.current = list.isLoadMore;
        totalRef.current = list.total;
    }, [list.error, list.isLoading, list.isLoadMore, list.total]);

    /** 让进行中的请求失效，并清掉它留下的加载状态 */
    const stop = useCallback(() => {
        seqRef.current++;
        // TODO(MIGRATION)：useList 未暴露 loading 重置；旧版在此同步置 false。
        // 新请求发起时会重新置 true，最终由最后一次请求的 finally 收尾。
    }, []);

    const search = useCallback(
        (keyword = params.keyword) => {
            stop();
            list.resetState();
            setPromotionList({});
            params.keyword = keyword;
            void list.getList({ ...getLocationParams(), ...getConditions() });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [stop, getConditions]
    );

    /** 返回是否真的切换了排序，调用方据此决定要不要回到顶部 */
    const changeSort = useCallback(
        (value: SortValue) => {
            const next = nextSortState(sortState, value);
            if (!next) return false;
            setSortState(next);
            params.sort = next.sort;
            params.order = next.order;
            search();
            return true;
        },
        [sortState, search, params]
    );

    const resetSort = useCallback(() => {
        setSortState({ sort: "default", order: "" });
        params.sort = "default";
        params.order = "";
    }, [params]);

    /** 失败后重试当前页：首屏重拉，加载更多则保留已加载的商品 */
    const retry = useCallback(() => {
        void list.getList();
    }, [list]);

    const reachBottom = useCallback(() => {
        // 上一页失败时页码已自增，等用户点重试，不能继续往后翻
        if (errorRef.current) return;
        if (isLoadingRef.current || isLoadMoreRef.current) return;
        const totalPages = Math.ceil(totalRef.current / (params.size || 10));
        if (params.page >= totalPages) return;
        params.page += 1;
        void list.getList();
    }, [list, params]);

    return {
        data: list.data,
        promotionList,
        isLoading: list.isLoading,
        isLoadMore: list.isLoadMore,
        total: list.total,
        error: list.error,
        params,
        sortState,
        search,
        changeSort,
        resetSort,
        retry,
        reachBottom,
        stop
    };
}