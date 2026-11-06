import { useCallback, useRef, useState } from "react";
import Taro from "@tarojs/taro";

import { buyerShowComment, buyerShowCommentLike } from "@/api/buyerShow/buyerShow";
import { buyerShowVideoComments } from "@/api/buyerShow/videoFeed";
import type { VideoFeedCommentResponse, VideoFeedCommentRow, VideoFeedId } from "@/types/buyerShow/videoFeed";
import { getErrorMessage } from "@/utils/error";
import { t } from "@/utils/i18n";

const isOverseasEnv = () => Number(process.env.TARO_APP_IS_OVERSEAS) == 1;
const replyToText = (name: string) => (isOverseasEnv() ? t("回复{0}", { 0: name }) : `回复${name}`);
const expandRepliesText = (count: number) => (isOverseasEnv() ? t("展开{0}条回复", { 0: count }) : `展开${count}条回复`);

function pickRows(res: VideoFeedCommentResponse | null | undefined): VideoFeedCommentRow[] {
    return res?.records ?? [];
}

/**
 * 买家秀视频流评论逻辑（自旧 composables/useVideoComments.ts 移植为 React hook）
 * 回复交互对齐详情页：两级扁平，回复二级仍挂在一级评论下。
 *
 * TODO(MIGRATION)：原实现直接取 i18n 实例（nvue 上下文限制），React 下统一走 @/utils/i18n 的 t()。
 */
export function useVideoComments() {
    const [list, setListState] = useState<VideoFeedCommentRow[]>([]);
    const listRef = useRef<VideoFeedCommentRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    /** 当前回复目标，始终是一级评论 */
    const [replyTarget, setReplyTargetState] = useState<VideoFeedCommentRow | null>(null);

    const size = 10;
    const replySize = 3;
    const pageRef = useRef(1);
    const buyerShowIdRef = useRef<VideoFeedId>("");
    const loadingRef = useRef(false);
    const hasMoreRef = useRef(true);

    const setList = useCallback((next: VideoFeedCommentRow[]) => {
        listRef.current = next;
        setListState(next);
    }, []);

    const setHasMoreState = useCallback((next: boolean) => {
        hasMoreRef.current = next;
        setHasMore(next);
    }, []);

    const setLoadingState = useCallback((next: boolean) => {
        loadingRef.current = next;
        setLoading(next);
    }, []);

    const setReplyTargetStateAndRef = useCallback((next: VideoFeedCommentRow | null) => {
        setReplyTargetState(next);
    }, []);

    /** 加载下一页一级评论 */
    const loadMore = useCallback(async () => {
        if (loadingRef.current || !hasMoreRef.current || !buyerShowIdRef.current) return;
        setLoadingState(true);
        try {
            const res = await buyerShowVideoComments({ buyerShowId: buyerShowIdRef.current, page: pageRef.current, size, parentId: 0 });
            const rows = pickRows(res);
            const next = [...listRef.current, ...rows];
            setList(next);
            setTotal(Number(res?.total) || next.length);
            setHasMoreState(next.length < Number(res?.total || 0));
            pageRef.current += 1;
        } catch (error) {
            Taro.showToast({ title: getErrorMessage(error), icon: "none" });
        } finally {
            setLoadingState(false);
        }
    }, [setHasMoreState, setList, setLoadingState]);

    /** 切换买家秀并重新加载 */
    const reload = useCallback(
        (id: VideoFeedId) => {
            buyerShowIdRef.current = id;
            setList([]);
            setTotal(0);
            pageRef.current = 1;
            setHasMoreState(true);
            setReplyTargetStateAndRef(null);
            return loadMore();
        },
        [loadMore, setHasMoreState, setList, setReplyTargetStateAndRef]
    );

    /** 评论点赞 / 取消，一级或二级通用 */
    const like = useCallback(async (item: VideoFeedCommentRow) => {
        const next = item.isLike ? 0 : 1;
        try {
            await buyerShowCommentLike({ buyerShowCommentId: item.buyerShowCommentId, isLike: next });
            const patch = (row: VideoFeedCommentRow): VideoFeedCommentRow =>
                String(row.buyerShowCommentId) === String(item.buyerShowCommentId)
                    ? { ...row, isLike: next, likeCount: Math.max(0, (Number(row.likeCount) || 0) + (next ? 1 : -1)) }
                    : { ...row, replies: row.replies?.map(patch) };
            const updated = listRef.current.map(patch);
            setListState(updated);
            listRef.current = updated;
        } catch (error) {
            Taro.showToast({ title: getErrorMessage(error), icon: "none" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** 选中回复目标，传一级评论；回复二级时也传其所属一级 */
    const setReplyTarget = useCallback(
        (comment: VideoFeedCommentRow) => {
            setReplyTargetStateAndRef(comment);
        },
        [setReplyTargetStateAndRef]
    );

    const clearReplyTarget = useCallback(() => {
        setReplyTargetStateAndRef(null);
    }, [setReplyTargetStateAndRef]);

    /** 拉取 / 续拉某条一级评论的二级回复 */
    const loadReplies = useCallback(
        async (comment: VideoFeedCommentRow) => {
            if (!buyerShowIdRef.current || !comment?.buyerShowCommentId) return;
            try {
                const replyPage = Number(comment.page || 1);
                const res = await buyerShowVideoComments({
                    buyerShowId: buyerShowIdRef.current,
                    page: replyPage,
                    size: replySize,
                    // 雪花 id 不可 Number()，会丢精度导致挂不到父评论
                    parentId: comment.buyerShowCommentId
                });
                const rows = pickRows(res);
                const replies = replyPage === 1 ? rows : [...(comment.replies || []), ...rows];
                const loaded = replies.length || 0;
                const replyTotal = Number(res?.total) || 0;
                const toggleText = loaded < replyTotal ? expandRepliesText(replyTotal - loaded) : t("收起");
                const updated = listRef.current.map((row) =>
                    String(row.buyerShowCommentId) === String(comment.buyerShowCommentId)
                        ? { ...row, replies, page: replyPage + 1, showAllReplies: true, toggleText }
                        : row
                );
                setList(updated);
            } catch (error) {
                Taro.showToast({ title: getErrorMessage(error), icon: "none" });
            }
        },
        [setList]
    );

    /**
     * 展开 / 续拉 / 收起回复，对齐详情页 CommentList
     * 文案为「收起」时再次点击即收起，否则展开或续拉
     */
    const toggleReplies = useCallback(
        async (comment: VideoFeedCommentRow) => {
            if (comment.toggleText === t("收起")) {
                const updated = listRef.current.map((row) =>
                    String(row.buyerShowCommentId) === String(comment.buyerShowCommentId)
                        ? {
                              ...row,
                              showAllReplies: false,
                              toggleText: expandRepliesText(Number(row.replyCount) || 0),
                              page: 1,
                              replies: []
                          }
                        : row
                );
                setList(updated);
                return;
            }
            await loadReplies(comment);
        },
        [loadReplies, setList]
    );

    /** 发送评论 / 回复，成功返回 true */
    const send = useCallback(
        async (content: string): Promise<boolean> => {
            const text = content.trim();
            if (!text) {
                Taro.showToast({ title: t("评论不能为空"), icon: "none" });
                return false;
            }
            // 雪花 id 不可 Number()：2081929394093555712 会变成 2081929394093555700
            const parentId = replyTarget?.buyerShowCommentId ?? 0;
            try {
                await buyerShowComment({ buyerShowId: buyerShowIdRef.current, content: text, parentId });
                Taro.showToast({ title: parentId ? t("回复成功") : t("评论成功") });
                clearReplyTarget();
                await reload(buyerShowIdRef.current);
                // 回复后重新展开对应一级评论，避免列表被 reload 收起
                if (parentId) {
                    const parent = listRef.current.find((item) => String(item.buyerShowCommentId) === String(parentId));
                    if (parent) {
                        const reset = listRef.current.map((row) =>
                            String(row.buyerShowCommentId) === String(parentId)
                                ? { ...row, page: 1, replies: [], toggleText: undefined }
                                : row
                        );
                        setList(reset);
                        const nextParent = reset.find((item) => String(item.buyerShowCommentId) === String(parentId));
                        if (nextParent) await loadReplies(nextParent);
                    }
                }
                return true;
            } catch (error) {
                Taro.showToast({ title: getErrorMessage(error), icon: "none" });
                return false;
            }
        },
        [clearReplyTarget, loadReplies, reload, replyTarget, setList]
    );

    const replyPlaceholder = replyTarget?.buyerName ? replyToText(replyTarget.buyerName) : t("说点什么吧~");

    return {
        list,
        total,
        loading,
        hasMore,
        replyTarget,
        replyPlaceholder,
        reload,
        loadMore,
        like,
        send,
        setReplyTarget,
        clearReplyTarget,
        toggleReplies,
        loadReplies
    };
}