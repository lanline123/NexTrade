import Taro from "@tarojs/taro";

import { buyerShowVideoFeed } from "@/api/buyerShow/videoFeed";
import type { BuyerShowFilterState } from "@/types/buyerShow/buyerShow";
import type { VideoFeedItem, VideoFeedResponse } from "@/types/buyerShow/videoFeed";

const FEED_TTL_MS = 60_000;
const VIDEO_TTL_MS = 120_000;

interface FeedCache {
    startId: string;
    promise: Promise<VideoFeedResponse>;
    at: number;
}

interface Bootstrap {
    startId: string;
    firstItem: VideoFeedItem;
    at: number;
}

let feedCache: FeedCache | null = null;
let bootstrap: Bootstrap | null = null;
/** 远端 url → 本地临时路径（downloadFile 预热） */
const localVideoMap = new Map<string, { path: string; at: number }>();

const toId = (id: string | number | undefined | null) => (id == null || id === "" ? "" : String(id));

/** 从瀑布流卡片拼首屏，进页即可挂视频，不必干等接口 */
export function buildBootstrapItem(item: BuyerShowFilterState): VideoFeedItem | null {
    const buyerShowId = item.buyerShowId;
    const media = item.videoList?.[0];
    const videoUrl = media?.videoUrl;
    if (!buyerShowId || !videoUrl) return null;
    return {
        buyerShowId,
        video: {
            videoUrl,
            videoCover: media?.videoCover || ""
        },
        author: {
            userId: "",
            buyerName: item.buyerName || "",
            buyerPhoto: item.buyerPhoto || "",
            isFollow: 0
        },
        productList: [],
        content: item.content || "",
        likeCount: Number(item.likeCount) || 0,
        isLike: item.isLike ? 1 : 0,
        favoriteCount: 0,
        isFavorite: 0,
        commentCount: 0
    };
}

/** 点击进流前调用：缓存首屏 + 预取 feed + 预热视频文件 */
export function prefetchVideoFeedEntry(item: BuyerShowFilterState, size = 5) {
    const id = toId(item.buyerShowId);
    if (!id) return;

    const firstItem = buildBootstrapItem(item);
    if (firstItem) {
        bootstrap = { startId: id, firstItem, at: Date.now() };
        prefetchVideoFile(firstItem.video.videoUrl);
    }

    if (feedCache && feedCache.startId === id && Date.now() - feedCache.at < FEED_TTL_MS) {
        return feedCache.promise;
    }

    const promise = buyerShowVideoFeed({ size, startId: id });
    feedCache = { startId: id, promise, at: Date.now() };
    promise.catch(() => {
        if (feedCache?.startId === id) feedCache = null;
    });
    return promise;
}

/** 进页后取首屏占位，一次性 */
export function takeFeedBootstrap(startId?: string | number): VideoFeedItem | null {
    const id = toId(startId);
    if (!bootstrap || !id || bootstrap.startId !== id) return null;
    if (Date.now() - bootstrap.at > FEED_TTL_MS) {
        bootstrap = null;
        return null;
    }
    const item = bootstrap.firstItem;
    bootstrap = null;
    return item;
}

/** 进页后复用预取中的 feed 请求 */
export function takePrefetchedFeed(startId?: string | number): Promise<VideoFeedResponse> | null {
    const id = toId(startId);
    if (!feedCache || !id || feedCache.startId !== id) return null;
    if (Date.now() - feedCache.at > FEED_TTL_MS) {
        feedCache = null;
        return null;
    }
    const promise = feedCache.promise;
    feedCache = null;
    return promise;
}

/** 若已预热到本地临时文件，优先用本地路径开播 */
export function resolvePlayableUrl(remoteUrl: string): string {
    if (!remoteUrl) return remoteUrl;
    const hit = localVideoMap.get(remoteUrl);
    if (!hit) return remoteUrl;
    if (Date.now() - hit.at > VIDEO_TTL_MS) {
        localVideoMap.delete(remoteUrl);
        return remoteUrl;
    }
    return hit.path || remoteUrl;
}

function prefetchVideoFile(url: string) {
    if (!url || localVideoMap.has(url)) return;
    try {
        Taro.downloadFile({
            url,
            success: (res) => {
                if (res.statusCode === 200 && res.tempFilePath) {
                    localVideoMap.set(url, { path: res.tempFilePath, at: Date.now() });
                }
            }
        });
    } catch {
        /* ignore */
    }
}