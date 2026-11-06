import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import CommentList from "./buyerShowCompnents/CommentList";
import type { CommentItem } from "./buyerShowCompnents/CommentList";
import LoadingBox from "@/components/loading-box";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import { buyerShowCommentLike, buyerShowCommentList } from "@/api/buyerShow/buyerShow";
import type { BuyerShowCommentData, BuyerShowCommentFilterState, BuyerShowCommentListParams } from "@/types/buyerShow/buyerShow";
import useList from "@/hooks/useList";
import { t } from "@/utils/i18n";

import "./comments.scss";

interface Props {
    /** v-model:buyer-show-id */
    buyerShowId?: string | number;
    /** 旧 @show-reply-input */
    onShowReplyInput?: (data: any) => void;
    /** 旧 @get-comment-list */
    onGetCommentList?: () => void;
}

export interface CommentsRef {
    getList: (extraData?: Partial<BuyerShowCommentListParams>) => Promise<void>;
    total: number;
}

type CommentRow = CommentItem & {
    buyerShowCommentId: number;
    replyCount?: number;
    replies?: any[];
    page?: number;
    showAllReplies?: boolean;
};

/**
 * 买家秀评论组件（自旧 comments.vue 移植）
 * - 展示评论列表
 * - 支持评论点赞
 * - 分页加载更多评论
 *
 * 说明：旧页面通过 onLoad 读取 buyerShowId（作为子组件时不会触发），
 * 这里以 prop 优先、路由参数兜底，保证详情页评论区可正常加载。
 */
const Comments = forwardRef<CommentsRef, Props>(function Comments({ buyerShowId, onShowReplyInput }, ref) {
    const router = useRouter();
    const [, forceRender] = useState(0);
    const filterParamsRef = useRef<BuyerShowCommentListParams>({
        page: 1,
        size: 10,
        parentId: 0
    });
    const buyerShowIdRef = useRef<string | number>("");
    const disposedRef = useRef(false);
    const loadingRepliesRef = useRef<WeakSet<object>>(new WeakSet());

    const {
        getList,
        data: buyerShowCommentListData,
        isLoading,
        isLoadMore,
        total
    } = useList<CommentRow, BuyerShowCommentListParams>(buyerShowCommentList as any, {
        params: filterParamsRef.current,
        path: {
            dataKey: "records"
        },
        immediate: false
    });

    const dataRef = useRef<CommentRow[]>(buyerShowCommentListData);
    dataRef.current = buyerShowCommentListData;

    useEffect(() => {
        disposedRef.current = false;
        return () => {
            disposedRef.current = true;
        };
    }, []);

    // 旧 onLoad(options)：buyerShowId 来自页面参数；作为子组件时由父级 prop 传入
    const resolvedId = buyerShowId ?? (router.params?.buyerShowId as string | undefined);
    useEffect(() => {
        const id = resolvedId;
        if (!id) return;
        buyerShowIdRef.current = id;
        void getList({ buyerShowId: id, parentId: 0 } as Partial<BuyerShowCommentListParams>);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedId]);

    useImperativeHandle(
        ref,
        () => ({
            getList,
            total
        }),
        [getList, total]
    );

    const showReplyInput = (data: any) => {
        onShowReplyInput?.(data);
    };

    const getReplyList = async ({ buyerShowCommentId }: any) => {
        const comment = dataRef.current.find((item) => String(item.buyerShowCommentId) === String(buyerShowCommentId));
        if (disposedRef.current || !comment || loadingRepliesRef.current.has(comment)) return;

        const page = comment.page || 1;
        const previousReplies = comment.replies;
        loadingRepliesRef.current.add(comment);
        try {
            // 接口实际返回 { records, total }，BuyerShowCommentListFilter.data 的声明与之不符
            const result = (await buyerShowCommentList({
                buyerShowId: buyerShowIdRef.current,
                parentId: buyerShowCommentId,
                size: 3,
                page
            })) as unknown as BuyerShowCommentData;
            // 主列表刷新或回复被收起后，不再把旧请求写回页面。
            if (
                disposedRef.current ||
                !dataRef.current.includes(comment) ||
                comment.showAllReplies === false ||
                comment.replies !== previousReplies
            )
                return;
            comment.replies = page === 1 ? result.records : [...(previousReplies ?? []), ...result.records];
            comment.replyCount = result.total;
            comment.page = page + 1;
            forceRender((v) => v + 1);
        } catch (error) {
            console.error("Failed to load comment replies:", error);
        } finally {
            loadingRepliesRef.current.delete(comment);
        }
    };

    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const handleLikeComment = (data: any) => {
        // 处理评论点赞
        void likeComment({ ...data, level: 1 });
    };

    const handleLikeReply = (data: any) => {
        // 处理回复点赞
        void likeComment({ ...data, level: 2 });
    };

    const likeComment = async (data: any) => {
        // 处理评论点赞
        try {
            await buyerShowCommentLike({
                buyerShowCommentId: data.buyerShowCommentId,
                isLike: !data.isLike ? 1 : 0
            });
            Taro.showToast({
                title: !data.isLike ? t("点赞成功") : t("取消点赞"),
                icon: "none"
            });
            const list = dataRef.current;
            if (data.level === 1) {
                const index = list.findIndex((item: any) => String(item.buyerShowCommentId) === String(data.buyerShowCommentId));
                if (index === -1) return;
                (list[index] as any).isLike = !data.isLike;
                (list[index] as any).likeCount = !data.isLike ? data.likeCount + 1 : data.likeCount - 1;
            } else {
                const replyListData = list.flatMap((comment) => comment.replies ?? []);
                const index = replyListData.findIndex((item: any) => String(item.buyerShowCommentId) === String(data.buyerShowCommentId));
                if (index === -1) return;
                (replyListData[index] as any).isLike = !data.isLike;
                (replyListData[index] as any).likeCount = !data.isLike ? data.likeCount + 1 : data.likeCount - 1;
            }
            forceRender((v) => v + 1);
        } catch (error: any) {
            Taro.showToast({
                title: error?.message
            });
        }
    };

    const handleSubmitReply = (comment: any, content: string) => {
        // 处理提交回复
        if (!comment.replies) {
            comment.replies = [];
        }

        comment.replies.push({
            id: Date.now(),
            username: t("当前用户"),
            content: content,
            createTime: Date.now(),
            likeCount: 0,
            isLiked: false
        });
        forceRender((v) => v + 1);
    };

    const handleSubmitReplyTo = (comment: any, reply: any, content: string) => {
        // 处理回复某人
        if (!comment.replies) {
            comment.replies = [];
        }

        comment.replies.push({
            id: Date.now(),
            username: t("当前用户"),
            content: content,
            createTime: Date.now(),
            likeCount: 0,
            isLiked: false,
            replyTo: reply.username
        });
        forceRender((v) => v + 1);
    };

    const loadMoreComments = useCallback(() => {
        // 加载更多评论
        if (loading || !hasMore) return;

        setLoading(true);
        // 模拟加载数据
        setTimeout(() => {
            // 添加更多评论数据
            setLoading(false);
        }, 1000);
    }, [loading, hasMore]);

    return (
        <View>
            <View className="commentsTotal">
                {t("共")}
                {total}
                {t("条评论")}
            </View>
            <CommentList
                comments={buyerShowCommentListData as CommentItem[]}
                loading={loading}
                hasMore={hasMore}
                onLikeComment={handleLikeComment}
                onLikeReply={handleLikeReply}
                onSubmitReply={handleSubmitReply}
                onSubmitReplyTo={handleSubmitReplyTo}
                onLoadMore={loadMoreComments}
                onShowReplyInput={showReplyInput}
                onGetReplyList={getReplyList}
            />
            <TigLoadingPage modelValue={isLoading} />
            <LoadingBox modelValue={isLoadMore} page={filterParamsRef.current.page} length={buyerShowCommentListData.length} />
        </View>
    );
});

export default Comments;