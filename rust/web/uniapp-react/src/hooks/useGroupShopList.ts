import { useCallback, useRef, useState } from "react";
import Taro, { useLoad, usePullDownRefresh, useReachBottom } from "@tarojs/taro";

import { getShopGroupDetail } from "@/api/shop/shop";
import { decodeGroupQuery, groupListParams, validGroupParams } from "@/utils/shopGroup";

/** 分页大小（旧实现固定 size = 10） */
const SIZE = 10;

interface GroupShopListResult<T> {
    title: string;
    keyword: string;
    records: T[];
    loading: boolean;
    error: string;
    finished: boolean;
    load: (reset?: boolean) => Promise<void>;
}

/**
 * 店铺/门店分组列表 hook（自旧 hooks/useGroupShopList.ts 91 行移植为 React 版）。
 *
 * 迁移要点：
 * - 旧 ref 状态改为 useState + 同名 ref 镜像：useReachBottom/onLoad 注册一次，
 *   闭包必须读到最新值，故所有分支判断走 ref，渲染取值走 state；
 * - 生命周期 onLoad/onReachBottom/onPullDownRefresh → useLoad/useReachBottom/usePullDownRefresh；
 * - 分组条件在搜索、刷新与分页时保持不变（groupParams 只在 onLoad 时从 query 解析一次）。
 */
export function useGroupShopList<T>(
    api: (params: any) => Promise<any>,
    shopType: 1 | 2,
    enabled: boolean,
    extraParams: () => Record<string, any> = () => ({})
): GroupShopListResult<T> {
    const [title, setTitle] = useState("");
    const [keyword, setKeyword] = useState("");
    const [records, setRecords] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [finished, setFinished] = useState(false);

    const groupParamsRef = useRef<Record<string, any>>({});
    const searchParamsRef = useRef<Record<string, any>>({});
    const keywordRef = useRef("");
    const recordsRef = useRef<T[]>([]);
    const loadingRef = useRef(false);
    const finishedRef = useRef(false);
    const pageRef = useRef(1);
    const generationRef = useRef(0);

    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;
    const extraParamsRef = useRef(extraParams);
    extraParamsRef.current = extraParams;

    const fillTitle = useCallback(
        async (requestGeneration: number) => {
            const groupParams = groupParamsRef.current;
            const raw = groupParams.groupIds ?? groupParams.groupId;
            if (raw === undefined || !validGroupParams(groupParams)) {
                if (requestGeneration === generationRef.current) setTitle("");
                return;
            }
            const ids = String(raw)
                .split(",")
                .map((id) => Number(id));
            const details = await Promise.all(
                ids.map(async (groupId) => {
                    try {
                        return await getShopGroupDetail(groupId, shopType);
                    } catch {
                        return null;
                    }
                })
            );
            if (requestGeneration !== generationRef.current) return;
            setTitle(
                details
                    .map((item) => String(item?.groupName ?? "").trim())
                    .filter(Boolean)
                    .join("、")
            );
        },
        [shopType]
    );

    const load = useCallback(
        async (reset = false) => {
            if (!enabledRef.current) return;
            if (!reset && (loadingRef.current || finishedRef.current)) return;
            if (reset) {
                generationRef.current += 1;
                searchParamsRef.current = { ...extraParamsRef.current(), keyword: keywordRef.current.trim() };
                pageRef.current = 1;
                recordsRef.current = [];
                setRecords([]);
                finishedRef.current = false;
                setFinished(false);
            }
            const requestGeneration = generationRef.current;
            if (reset) void fillTitle(requestGeneration);
            if (!validGroupParams(groupParamsRef.current)) {
                setError("分组参数无效");
                return;
            }
            loadingRef.current = true;
            setLoading(true);
            setError("");
            try {
                const result = await api({ ...searchParamsRef.current, ...groupParamsRef.current, page: pageRef.current, size: SIZE });
                if (requestGeneration !== generationRef.current) return;
                const rows: T[] = result.records ?? [];
                const nextRecords = reset ? rows : [...recordsRef.current, ...rows];
                recordsRef.current = nextRecords;
                setRecords(nextRecords);
                const isFinished = rows.length < SIZE || pageRef.current * SIZE >= Number(result.total ?? 0);
                finishedRef.current = isFinished;
                setFinished(isFinished);
                pageRef.current += 1;
            } catch (err: any) {
                if (requestGeneration === generationRef.current) setError(err?.message || "加载失败，请重试");
            } finally {
                if (requestGeneration === generationRef.current) {
                    loadingRef.current = false;
                    setLoading(false);
                }
            }
        },
        [api, fillTitle]
    );

    // 生命周期回调只注册一次，统一走 ref 取最新 load
    const loadRef = useRef(load);
    loadRef.current = load;

    useLoad((query: any) => {
        groupParamsRef.current = groupListParams(query ?? {}, shopType);
        const queryKeyword = decodeGroupQuery(query?.keyword);
        keywordRef.current = queryKeyword;
        setKeyword(queryKeyword);
        void loadRef.current(true);
    });

    useReachBottom(() => {
        void loadRef.current();
    });

    usePullDownRefresh(async () => {
        try {
            await loadRef.current(true);
        } finally {
            Taro.stopPullDownRefresh();
        }
    });

    return { title, keyword, records, loading, error, finished, load };
}
