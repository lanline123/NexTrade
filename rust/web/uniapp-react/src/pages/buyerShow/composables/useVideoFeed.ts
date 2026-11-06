import { useCallback, useRef, useState } from "react";
import Taro from "@tarojs/taro";

import { buyerShowLike } from "@/api/buyerShow/buyerShow";
import { buyerShowFavorite, buyerShowFollowAuthor, buyerShowVideoFeed } from "@/api/buyerShow/videoFeed";
import type { VideoFeedItem } from "@/types/buyerShow/videoFeed";
import { getErrorMessage } from "@/utils/error";
import { resolvePlayableUrl, takeFeedBootstrap, takePrefetchedFeed } from "./videoFeedPrefetch";

/** video 组件 id 前缀，供 createVideoContext 定位 */
const VIDEO_ID_PREFIX = "bs-feed-video-";

/** 同时挂载/预热的半径：当前 ±N，兼顾预加载与内存 */
const PRELOAD_RADIUS = 2;

/** 单条最多展示的附图数，与发布端上限一致 */
const MAX_IMAGE_COUNT = 8;

/** 图片位自动轮播间隔（ms） */
const AUTO_PLAY_INTERVAL = 3000;

export interface UseVideoFeedOptions {
    /** 每页条数 */
    size?: number;
    /**
     * RN（旧 nvue）端 createVideoContext 需要传入组件实例（this）；
     * H5 / 小程序端可不传。
     */
    instance?: unknown;
}

/**
 * 买家秀视频流共用逻辑（自旧 composables/useVideoFeed.ts 移植为 React hook）
 *
 * 与旧实现的差异（仅状态承载方式，业务时序保持一致）：
 * - Vue ref 数组改为 useState + ref 双写：ref 供事件闭包读取，state 触发渲染；
 * - list 内条目的原地修改改为 map 生成新对象，避免 React 不重渲染；
 * - Taro.createVideoContext 的返回值统一按 any 处理（各端方法集不一致）。
 */
export function useVideoFeed(options: UseVideoFeedOptions = {}) {
    const size = options.size ?? 5;

    const [list, setListState] = useState<VideoFeedItem[]>([]);
    const listRef = useRef<VideoFeedItem[]>([]);
    const setList = useCallback((next: VideoFeedItem[]) => {
        listRef.current = next;
        setListState(next);
    }, []);

    const [current, setCurrentState] = useState(0);
    const currentRef = useRef(0);
    const setCurrent = useCallback((next: number) => {
        currentRef.current = next;
        setCurrentState(next);
    }, []);

    const [loading, setLoadingState] = useState(false);
    const loadingRef = useRef(false);
    const setLoading = useCallback((next: boolean) => {
        loadingRef.current = next;
        setLoadingState(next);
    }, []);

    const [hasMore, setHasMoreState] = useState(true);
    const hasMoreRef = useRef(true);
    const setHasMore = useCallback((next: boolean) => {
        hasMoreRef.current = next;
        setHasMoreState(next);
    }, []);

    const [inited, setInitedState] = useState(false);
    const initedRef = useRef(false);
    const setInited = useCallback((next: boolean) => {
        initedRef.current = next;
        setInitedState(next);
    }, []);

    /** 每屏视频的当前播放秒数 */
    const [videoCurrentTimes, setVideoCurrentTimes] = useState<number[]>([]);
    const videoCurrentTimesRef = useRef<number[]>([]);
    /** 每屏视频的总时长秒数 */
    const [videoDurations, setVideoDurations] = useState<number[]>([]);
    const videoDurationsRef = useRef<number[]>([]);
    /** 正在拖动进度条的屏，拖动期间忽略 timeupdate 回写 */
    const seekingScreens = useRef<Set<number>>(new Set());
    /** 原生 video 重挂载时使用的起播位置；Map 非响应式，避免 timeupdate 持续改写 initial-time */
    const videoResumeTimes = useRef<Map<number, number>>(new Map());
    /** 每屏当前素材下标：0 为视频位，1..N 为附图位 */
    const [assetIndexes, setAssetIndexesState] = useState<number[]>([]);
    const assetIndexesRef = useRef<number[]>([]);
    /** 分页游标 */
    const cursorRef = useRef<string | null>(null);
    /** 预热定时器，避免快速滑屏堆积 play/pause */
    const warmTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
    /** 图片位自动轮播定时器；仅当前屏需要，故为单例 */
    const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setAssetIndexes = useCallback((next: number[]) => {
        assetIndexesRef.current = next;
        setAssetIndexesState(next);
    }, []);

    const setTimes = useCallback((next: number[]) => {
        videoCurrentTimesRef.current = next;
        setVideoCurrentTimes(next);
    }, []);

    const setDurations = useCallback((next: number[]) => {
        videoDurationsRef.current = next;
        setVideoDurations(next);
    }, []);

    /** 生成第 index 屏的 video id */
    const videoId = useCallback((index: number) => `${VIDEO_ID_PREFIX}${index}`, []);

    /** 播放地址：优先用进页前 downloadFile 预热的本地临时文件 */
    const playSrc = useCallback((index: number) => {
        const url = listRef.current[index]?.video?.videoUrl || "";
        return resolvePlayableUrl(url);
    }, []);

    /** 获取 video 上下文，兼容 RN 端需要实例 */
    const getContext = useCallback(
        (index: number): any => {
            const id = videoId(index);
            try {
                return Taro.createVideoContext(id) as any;
            } catch {
                return null;
            }
        },
        [videoId]
    );

    /** 挂载当前及相邻屏真实视频源，供原生层缓冲下一条 */
    const shouldRenderVideo = useCallback((index: number) => Math.abs(index - currentRef.current) <= PRELOAD_RADIUS, []);

    const clearWarmTimer = (index: number) => {
        const timer = warmTimers.current.get(index);
        if (timer) {
            clearTimeout(timer);
            warmTimers.current.delete(index);
        }
    };

    const playIndex = useCallback(
        (index: number) => {
            clearWarmTimer(index);
            getContext(index)?.play?.();
        },
        [getContext]
    );

    const pauseIndex = useCallback(
        (index: number) => {
            clearWarmTimer(index);
            getContext(index)?.pause?.();
        },
        [getContext]
    );

    const currentTimeOf = useCallback((index: number) => videoCurrentTimesRef.current[index] ?? 0, []);

    /** 停止并销毁前保留当前进度，避免原生 video 残留音轨 */
    const stopIndex = useCallback(
        (index: number, preserveTime = false) => {
            clearWarmTimer(index);
            if (preserveTime) {
                videoResumeTimes.current.set(index, videoCurrentTimesRef.current[index] ?? 0);
                seekingScreens.current.add(index);
            }
            getContext(index)?.stop?.();
            if (preserveTime) {
                setTimeout(() => seekingScreens.current.delete(index), 200);
            }
        },
        [getContext]
    );

    const clearAutoPlay = useCallback(() => {
        if (autoPlayTimer.current) {
            clearTimeout(autoPlayTimer.current);
            autoPlayTimer.current = null;
        }
    }, []);

    const pauseAll = useCallback(() => {
        clearAutoPlay();
        listRef.current.forEach((_item, index) => pauseIndex(index));
    }, [clearAutoPlay, pauseIndex]);

    const initialTimeOf = useCallback((index: number) => videoResumeTimes.current.get(index) ?? 0, []);

    const durationOf = useCallback(
        (index: number) => videoDurationsRef.current[index] || Number(listRef.current[index]?.video?.duration) || 0,
        []
    );

    const readVideoTime = useCallback(
        (index: number, event: { detail?: { currentTime?: number; duration?: number } }) => {
            const currentTime = Number(event?.detail?.currentTime);
            const duration = Number(event?.detail?.duration);
            if (Number.isFinite(duration) && duration > 0) {
                const next = [...videoDurationsRef.current];
                next[index] = duration;
                setDurations(next);
            }
            if (!seekingScreens.current.has(index) && Number.isFinite(currentTime) && currentTime >= 0) {
                const next = [...videoCurrentTimesRef.current];
                next[index] = currentTime;
                setTimes(next);
            }
        },
        [setDurations, setTimes]
    );

    const previewSeek = useCallback(
        (index: number, event: { detail?: { value?: number } }) => {
            seekingScreens.current.add(index);
            const value = Number(event?.detail?.value);
            if (Number.isFinite(value) && value >= 0) {
                const next = [...videoCurrentTimesRef.current];
                next[index] = value;
                setTimes(next);
            }
        },
        [setTimes]
    );

    const commitSeek = useCallback(
        (index: number, event: { detail?: { value?: number } }) => {
            const duration = videoDurationsRef.current[index] || Number(listRef.current[index]?.video?.duration) || 0;
            const value = Math.min(Math.max(Number(event?.detail?.value) || 0, 0), duration || 0);
            const next = [...videoCurrentTimesRef.current];
            next[index] = value;
            setTimes(next);
            getContext(index)?.seek?.(value);
            setTimeout(() => seekingScreens.current.delete(index), 150);
        },
        [getContext, setTimes]
    );

    /** 素材位数组与 list 对齐；已有屏保留当前位，新增屏从视频位开始 */
    const syncAssetIndexes = useCallback(
        (nextList: VideoFeedItem[]) => {
            const prev = assetIndexesRef.current;
            setAssetIndexes(nextList.map((_item, index) => prev[index] ?? 0));
        },
        [setAssetIndexes]
    );

    /** 第 index 屏的附图，先剔除空地址再按上限截断 */
    const imagesOf = useCallback(
        (index: number) => (listRef.current[index]?.images || []).filter((img) => !!img?.picUrl).slice(0, MAX_IMAGE_COUNT),
        []
    );

    /** 第 index 屏的素材总数：1 个视频 + N 张附图 */
    const assetCount = useCallback((index: number) => imagesOf(index).length + 1, [imagesOf]);

    /** 第 index 屏是否需要横向素材容器与进度条 */
    const hasMultiAsset = useCallback((index: number) => assetCount(index) > 1, [assetCount]);

    /** 第 index 屏当前素材位 */
    const assetIndexOf = useCallback((index: number) => assetIndexesRef.current[index] ?? 0, []);

    /** 第 index 屏是否停在视频位 */
    const isVideoAsset = useCallback((index: number) => (assetIndexesRef.current[index] ?? 0) === 0, []);

    /** 图片位每 AUTO_PLAY_INTERVAL 前进一张；视频位不调度，末张停住不循环 */
    const scheduleAutoPlay = useCallback(() => {
        clearAutoPlay();
        const screen = currentRef.current;
        const pos = assetIndexesRef.current[screen] ?? 0;
        const total = (listRef.current[screen]?.images || []).filter((img) => !!img?.picUrl).slice(0, MAX_IMAGE_COUNT).length + 1;
        if (pos <= 0 || pos >= total - 1) return;
        autoPlayTimer.current = setTimeout(() => {
            autoPlayTimer.current = null;
            // 回调期间可能已切屏，此时不得改动其它屏的素材位
            if (currentRef.current !== screen) return;
            const nextPos = (assetIndexesRef.current[screen] ?? 0) + 1;
            setAssetIndexInternal(screen, nextPos);
        }, AUTO_PLAY_INTERVAL);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearAutoPlay]);

    /**
     * 设置第 screen 屏的素材位，并同步视频播放态与轮播定时器。
     * 横滑事件与自动轮播都走这里，保证状态单一出口。
     */
    const setAssetIndexInternal = (screen: number, next: number) => {
        const total = (listRef.current[screen]?.images || []).filter((img) => !!img?.picUrl).slice(0, MAX_IMAGE_COUNT).length + 1;
        const safe = Math.min(Math.max(next, 0), total - 1);
        const indexes = [...assetIndexesRef.current];
        indexes[screen] = safe;
        setAssetIndexes(indexes);
        if (screen !== currentRef.current) return;
        if (safe === 0) {
            playIndex(screen);
        } else if (process.env.TARO_ENV === "weapp") {
            // 微信小程序内层 swiper 切到图片时 pause 偶尔失效，停止并卸载可避免音轨残留
            stopIndex(screen, true);
        } else {
            pauseIndex(screen);
        }
        scheduleAutoPlay();
    };

    const setAssetIndex = useCallback(
        (screen: number, next: number) => {
            setAssetIndexInternal(screen, next);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [playIndex, pauseIndex, stopIndex, scheduleAutoPlay, setAssetIndexes]
    );

    /**
     * 静音预热相邻屏：短时 play 触发缓冲后 pause。
     * 优先预热下一条与下下条（上滑方向），减少切屏黑屏等待。
     */
    const warmNeighbors = useCallback(
        (center: number) => {
            // 微信小程序动态 muted 偶有失效，播放式预热会导致相邻视频串音；保留挂载预加载即可
            if (process.env.TARO_ENV === "weapp") return;
            const targets = [center + 1, center + 2, center - 1].filter(
                (index) => index >= 0 && index < listRef.current.length && index !== center && Math.abs(index - currentRef.current) <= PRELOAD_RADIUS
            );
            targets.forEach((index) => {
                clearWarmTimer(index);
                try {
                    getContext(index)?.play?.();
                } catch {
                    return;
                }
                warmTimers.current.set(
                    index,
                    setTimeout(() => {
                        warmTimers.current.delete(index);
                        if (currentRef.current !== index) {
                            try {
                                getContext(index)?.pause?.();
                            } catch {
                                /* ignore */
                            }
                        }
                    }, 450)
                );
            });
        },
        [getContext]
    );

    /**
     * 接口回填后补播当前屏：首屏占位无附图，回填 images 后模板会从单层 video
     * 切到内层 swiper，节点重挂载；此时 inited 已为 true，视图层 watch 不会再触发。
     */
    const resumeCurrentVideo = useCallback(() => {
        if (process.env.TARO_ENV === "weapp") return;
        if (!listRef.current.length || (assetIndexesRef.current[currentRef.current] ?? 0) !== 0) return;
        setTimeout(() => {
            playIndex(currentRef.current);
            setTimeout(() => warmNeighbors(currentRef.current), 120);
        }, 80);
    }, [playIndex, warmNeighbors]);

    /** 续拉下一页 */
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMoreRef.current || !cursorRef.current) return;
        setLoading(true);
        try {
            const res = await buyerShowVideoFeed({ size, cursor: cursorRef.current });
            const records = res?.records || [];
            const existingIds = new Set(listRef.current.map((item) => String(item.buyerShowId)));
            const uniqueRecords = records.filter((item) => {
                const id = String(item.buyerShowId);
                if (existingIds.has(id)) return false;
                existingIds.add(id);
                return true;
            });
            const nextList = [...listRef.current, ...uniqueRecords];
            setList(nextList);
            syncAssetIndexes(nextList);
            cursorRef.current = res?.nextCursor ?? null;
            setHasMore(Boolean(res?.hasMore && res?.nextCursor));
        } catch (error) {
            Taro.showToast({ title: getErrorMessage(error), icon: "none" });
        } finally {
            setLoading(false);
        }
    }, [size, setHasMore, setList, setLoading, syncAssetIndexes]);

    /** 首次加载，可指定起始买家秀 id 保证首屏是用户点击的那条 */
    const init = useCallback(
        async (startId?: string | number) => {
            if (initedRef.current || loadingRef.current) return;

            // 列表点击带入的首屏：先上屏再等接口，缩短打开时的等待
            const boot = takeFeedBootstrap(startId);
            let shouldUseBoot = Boolean(boot);
            // 微信小程序不先挂载简化版首屏，避免接口回填附图后重建原生 video 留下旧音轨
            if (process.env.TARO_ENV === "weapp") {
                shouldUseBoot = false;
            }
            if (boot && shouldUseBoot) {
                setList([boot]);
                syncAssetIndexes([boot]);
                setInited(true);
            } else {
                setLoading(true);
            }

            try {
                const prefetched = takePrefetchedFeed(startId);
                const res = prefetched ? await prefetched : await buyerShowVideoFeed({ size, startId });
                const records = res?.records || [];
                // 首条已在播时尽量保持同 id，减少整表替换导致的闪断
                const bootId = listRef.current[0]?.buyerShowId;
                const bootUrl = listRef.current[0]?.video?.videoUrl;
                if (bootId != null && records[0] && String(records[0].buyerShowId) === String(bootId) && bootUrl) {
                    records[0].video.videoUrl = bootUrl;
                }
                setList(records);
                syncAssetIndexes(records);
                cursorRef.current = res?.nextCursor ?? null;
                setHasMore(Boolean(res?.hasMore && res?.nextCursor));
                setInited(true);
                resumeCurrentVideo();
            } catch (error) {
                if (!listRef.current.length) {
                    Taro.showToast({ title: getErrorMessage(error), icon: "none" });
                }
            } finally {
                setLoading(false);
            }
            // 首屏若只返回起始一条，只有一屏无法上划、续拉将永不触发；此处主动补拉一屏
            if (initedRef.current && listRef.current.length < 2 && hasMoreRef.current) {
                await loadMore();
            }
        },
        [loadMore, resumeCurrentVideo, setHasMore, setInited, setList, setLoading, size, syncAssetIndexes]
    );

    /** 切屏：暂停上一屏、播放当前屏、预热相邻、临近末尾续拉 */
    const onChange = useCallback(
        (index: number) => {
            const prev = currentRef.current;
            if (prev === index) return;
            clearAutoPlay();
            if (process.env.TARO_ENV === "weapp") {
                // 微信小程序原生 video 偶有后台续播，切屏时明确暂停所有非目标实例
                listRef.current.forEach((_item, itemIndex) => {
                    if (itemIndex !== index) stopIndex(itemIndex, true);
                });
            } else {
                pauseIndex(prev);
            }
            // 切走与切入的两屏都回到视频位
            const indexes = [...assetIndexesRef.current];
            indexes[prev] = 0;
            indexes[index] = 0;
            setAssetIndexes(indexes);
            setCurrent(index);
            playIndex(index);
            // 等当前屏 video 挂载后再预热相邻
            setTimeout(() => warmNeighbors(index), 80);
            if (index >= listRef.current.length - 3) {
                loadMore();
            }
        },
        [clearAutoPlay, loadMore, pauseIndex, playIndex, setAssetIndexes, setCurrent, stopIndex, warmNeighbors]
    );

    /** 更新某条数据（评论数等），等价旧版对 item 字段的直接赋值 */
    const patchItem = useCallback(
        (target: VideoFeedItem | number, patch: Partial<VideoFeedItem>) => {
            const index = typeof target === "number" ? target : listRef.current.indexOf(target);
            if (index < 0) return;
            const next = [...listRef.current];
            next[index] = { ...next[index], ...patch };
            setList(next);
        },
        [setList]
    );

    /** 点赞 / 取消，复用买家秀点赞接口 */
    const toggleLike = useCallback(
        async (item: VideoFeedItem) => {
            const next = item.isLike ? 0 : 1;
            try {
                await buyerShowLike({ buyerShowId: item.buyerShowId, isLike: next });
                const index = listRef.current.findIndex((row) => String(row.buyerShowId) === String(item.buyerShowId));
                if (index < 0) return;
                const row = listRef.current[index];
                const updated = [...listRef.current];
                updated[index] = { ...row, isLike: next, likeCount: Math.max(0, (row.likeCount || 0) + (next ? 1 : -1)) };
                setList(updated);
            } catch (error) {
                Taro.showToast({ title: getErrorMessage(error), icon: "none" });
            }
        },
        [setList]
    );

    /** 收藏 / 取消 */
    const toggleFavorite = useCallback(
        async (item: VideoFeedItem) => {
            const next = item.isFavorite ? 0 : 1;
            try {
                await buyerShowFavorite({ buyerShowId: item.buyerShowId, isFavorite: next });
                const index = listRef.current.findIndex((row) => String(row.buyerShowId) === String(item.buyerShowId));
                if (index < 0) return;
                const row = listRef.current[index];
                const updated = [...listRef.current];
                updated[index] = { ...row, isFavorite: next, favoriteCount: Math.max(0, (row.favoriteCount || 0) + (next ? 1 : -1)) };
                setList(updated);
            } catch (error) {
                Taro.showToast({ title: getErrorMessage(error), icon: "none" });
            }
        },
        [setList]
    );

    /** 关注 / 取消关注作者 */
    const toggleFollow = useCallback(
        async (item: VideoFeedItem) => {
            const next = item.author.isFollow ? 0 : 1;
            try {
                await buyerShowFollowAuthor({ userId: item.author.userId, isFollow: next });
                const index = listRef.current.findIndex((row) => String(row.buyerShowId) === String(item.buyerShowId));
                if (index < 0) return;
                const row = listRef.current[index];
                const updated = [...listRef.current];
                updated[index] = { ...row, author: { ...row.author, isFollow: next } };
                setList(updated);
            } catch (error) {
                Taro.showToast({ title: getErrorMessage(error), icon: "none" });
            }
        },
        [setList]
    );

    return {
        list,
        current,
        loading,
        hasMore,
        inited,
        assetIndexes,
        videoCurrentTimes,
        videoDurations,
        currentTimeOf,
        initialTimeOf,
        durationOf,
        readVideoTime,
        previewSeek,
        commitSeek,
        videoId,
        playSrc,
        shouldRenderVideo,
        playIndex,
        pauseIndex,
        stopIndex,
        pauseAll,
        warmNeighbors,
        imagesOf,
        assetCount,
        hasMultiAsset,
        assetIndexOf,
        isVideoAsset,
        setAssetIndex,
        clearAutoPlay,
        scheduleAutoPlay,
        init,
        loadMore,
        onChange,
        patchItem,
        toggleLike,
        toggleFavorite,
        toggleFollow
    };
}