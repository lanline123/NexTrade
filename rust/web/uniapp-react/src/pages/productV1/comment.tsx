import { useEffect, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useReachBottom, useRouter, useUnload } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { imageFormat } from "@/utils/format";
import { getCommentList } from "@/api/product/product";
import type { CommentItem } from "@/types/product/product";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./comment.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 商品评论列表页（自旧 pages/productV1/comment.vue 移植）
 * - 分页展示商品的所有用户评论
 * - 支持按好评/中评/差评/有图筛选
 * - 显示评论内容、图片、追评和商家回复
 */
export default function ProductCommentPage() {
    usePageGuards();
    const router = useRouter();
    const productId = String(router.params.id || "");

    const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
    const [overflowReplies, setOverflowReplies] = useState<Set<number>>(new Set());

    const toggleReplies = (commentId: number) => {
        setExpandedReplies((prev) => {
            const next = new Set(prev);
            if (next.has(commentId)) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });
    };

    /**
     * 对应旧 checkReplyOverflow：nextTick + 200ms 后逐条比较隐藏测量层与折叠层高度
     * 旧实现读取 commentList.value（最新列表），React 侧改为显式传入本次列表避免闭包旧值
     */
    const checkReplyOverflow = (list: CommentItem[]) => {
        setTimeout(() => {
            const items = list.filter((item) => item.replies?.length && item.commentId);
            if (items.length === 0) return;
            const newSet = new Set<number>();
            let count = 0;
            items.forEach((item) => {
                const id = item.commentId as number;
                const query = Taro.createSelectorQuery();
                query.select(`#reply-m-${id}`).boundingClientRect();
                query.select(`#reply-b-${id}`).boundingClientRect();
                query.exec((res: any[]) => {
                    const measureRect = res[0];
                    const bodyRect = res[1];
                    if (measureRect && bodyRect && measureRect.height > bodyRect.height + 1) {
                        newSet.add(id);
                    }
                    count++;
                    if (count === items.length) {
                        setOverflowReplies(newSet);
                    }
                });
            });
        }, 200);
    };

    const [loading, setLoading] = useState(false);
    const [commentList, setCommentList] = useState<CommentItem[]>([]);
    const [page, setPage] = useState<number>(1);
    const size = 10;
    const [total, setTotal] = useState(0);
    const [, setLoaded] = useState(false);
    const imagePreview = (url: string) => {
        Taro.previewImage({
            urls: [url]
        });
    };
    const _getCommentList = async (targetPage: number) => {
        if (targetPage > 1) {
            setLoaded(true);
        }
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result = await getCommentList(Number(productId), {
                type: 1,
                size: size,
                page: targetPage
            });
            const nextList = [...commentList, ...result.records];
            // 并发/快速翻页时以本次最新合并结果为准
            setCommentList((prev) => [...prev, ...result.records]);
            setTotal(result.total);
            checkReplyOverflow(nextList);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoaded(false);
            Taro.hideLoading();
        }
    };

    // 对应旧 onLoad
    useEffect(() => {
        if (productId) {
            void _getCommentList(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    useReachBottom(() => {
        if (page < Math.ceil(total / size)) {
            const nextPage = page + 1;
            setPage(nextPage);
            void _getCommentList(nextPage);
        }
    });

    // 关闭预览图片（对应旧 onUnload #ifdef H5 || APP）
    useUnload(() => {
        if (process.env.TARO_ENV === "h5") {
            (Taro as any).closePreviewImage?.();
        }
    });

    /* 原 uni-rate（readonly）→ 只读五角星（value=commentRank、14px、灰/橙） */
    const renderRate = (value: number) => (
        <Text className="uni-rate-inline" style={{ fontSize: "14px", lineHeight: 1, color: "#bfbfbf" }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ color: star <= Math.round(value) ? "#ffa800" : "#bfbfbf" }}>
                    ★
                </Text>
            ))}
        </Text>
    );

    return (
        <TigLayout title={t("商品评价")}>
            <View className="product-comment-card">
                {commentList.map((item, index) => (
                    <View key={index} className="comment-item">
                        <View className="user-info flex justify-between align-center">
                            <View className="user-name flex align-center">
                                <View className="head_logo">
                                    <Image src={imageFormat(item?.avatar || "")} />
                                </View>
                                <View>
                                    <Text>{item.username}</Text>
                                    {renderRate(Number(item.commentRank ?? 0))}
                                </View>
                            </View>
                            <View className="time">{item.addTime}</View>
                        </View>
                        <View className="tags flex-wrap">
                            {(item.commentTag || []).map((tag: string, tagIndex: number) => (
                                <View key={tagIndex} className="tag">
                                    {tag}
                                </View>
                            ))}
                        </View>
                        <View className="user-content">{item.content}</View>
                        <View className="user-imgs flex-wrap align-center">
                            {(item.showPics || []).map((pic: any, picIndex: number) => (
                                <Image
                                    key={picIndex}
                                    mode="aspectFit"
                                    src={imageFormat(pic.picThumb)}
                                    onClick={() => imagePreview(imageFormat(pic?.picUrl || ""))}
                                />
                            ))}
                        </View>
                        {item.replies && item.replies.length > 0 ? (
                            <View className="reply-section">
                                <View className="reply-card">
                                    <View id={`reply-m-${item.commentId}`} className="reply-measure">
                                        <Text>
                                            {t("客服回复")}：{item.replies[0]?.content}
                                        </Text>
                                    </View>
                                    <View
                                        id={`reply-b-${item.commentId}`}
                                        className={`reply-body ${!expandedReplies.has(item.commentId!) ? "is-collapsed" : ""}`}
                                    >
                                        <Text className="reply-label">{t("客服回复")}：</Text>
                                        <Text className="reply-text">{item.replies[0]?.content}</Text>
                                        {overflowReplies.has(item.commentId!) && expandedReplies.has(item.commentId!) ? (
                                            <Text
                                                className="reply-toggle"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleReplies(item.commentId!);
                                                }}
                                            >
                                                {t("收起")}
                                            </Text>
                                        ) : null}
                                    </View>
                                    {overflowReplies.has(item.commentId!) && !expandedReplies.has(item.commentId!) ? (
                                        <View
                                            className="reply-expand"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleReplies(item.commentId!);
                                            }}
                                        >
                                            <Text className="reply-expand-text">...</Text> {t("展开")}
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        ) : null}
                    </View>
                ))}
            </View>
            {page > 1 ? (
                <View className="loading-box">
                    {loading ? (
                        <View className="bottomLoading">
                            <Image lazyLoad className="loading" src={staticResource("common/loading.gif")} />
                        </View>
                    ) : null}
                </View>
            ) : null}
            <View className="loading-box">
                {commentList.length < 1 ? <View>{t("暂无评价")}</View> : null}
            </View>
        </TigLayout>
    );
}