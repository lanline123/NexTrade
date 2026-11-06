import type { BuyerShowFilterState } from "@/types/buyerShow/buyerShow";

/**
 * 判定一条买家秀是否走视频流。
 *
 * 标准口径由后端 isVideo 给出，含义是「混排后的第一条素材是视频」。
 * 该字段缺失时退化为「是否含视频素材」，此时图片在前、视频在后的内容也会进入视频流。
 */
export function isVideoBuyerShow(item?: BuyerShowFilterState | null): boolean {
    if (item?.isVideo != null) return Number(item.isVideo) === 1;
    return Boolean(item?.videoList?.[0]?.videoUrl);
}