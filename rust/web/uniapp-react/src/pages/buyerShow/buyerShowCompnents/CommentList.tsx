import { useCallback, useEffect, useReducer, useRef } from "react";
import { Text, View } from "@tarojs/components";

import TigImage from "@/components/tig/tig-image/TigImage";
import { t } from "@/utils/i18n";

import "./CommentList.scss";

export interface CommentUser {
    id: string | number;
    userName: string;
    userPhoto?: string;
    isMe?: number;
    isAuthor?: number;
}

export interface CommentReply extends CommentUser {
    id: string | number;
    content: string;
    addTime: string | number;
    likeCount: number;
    isLike?: boolean;
    replyTo?: string; // 回复的对象用户名
}

export interface CommentItem extends CommentUser {
    id: string | number;
    content: string;
    addTime: string | number;
    likeCount: number;
    isLike?: boolean;
    replies?: CommentReply[] | any[];
    // 用于控制展开收起
    isLong?: boolean;
    expanded?: boolean;
    showReplyInput?: boolean;
    replyContent?: string;
    // 用于控制回复显示
    showAllReplies?: boolean;
    replyCount?: number;
    toggleText?: string;
    page?: number;
}

interface Props {
    /** 旧 v-model:comments */
    comments: CommentItem[];
    loading?: boolean;
    hasMore?: boolean;
    maxLines?: number; // 最大显示行数
    /** 旧 emits */
    onLikeComment?: (comment: CommentItem) => void;
    onLikeReply?: (reply: CommentReply) => void;
    onSubmitReply?: (comment: CommentItem, content: string) => void;
    onSubmitReplyTo?: (comment: CommentItem, reply: CommentReply, content: string) => void;
    onLoadMore?: () => void;
    onShowReplyInput?: (comment: CommentItem) => void;
    onGetReplyList?: (payload: CommentItem & { index: number }) => void;
}

/**
 * 评论列表组件（自旧 buyerShowCompnents/CommentList.vue 移植）
 * - 展示评论和回复
 * - 支持点赞交互
 *
 * 说明：旧实现直接改写 comment / reply 对象（Vue 深层响应式自动刷新）；
 * React 下对象为页面共享数据，这里改写后通过本地 reducer 强制刷新本组件视图。
 */
export default function CommentList({
    comments,
    loading = false,
    hasMore = true,
    maxLines = 3,
    onLikeComment,
    onLikeReply,
    onLoadMore,
    onShowReplyInput,
    onGetReplyList
}: Props) {
    const [, forceRender] = useReducer((x: number) => x + 1, 0);
    const preparedRef = useRef<WeakSet<object>>(new WeakSet());

    const noMore = !hasMore && !loading;

    // 初始化评论数据（旧 onMounted 逻辑；数据异步到达时按未初始化项补做，避免长文不显示展开）
    useEffect(() => {
        comments.forEach((comment) => {
            if (comment && typeof comment === "object") {
                if (preparedRef.current.has(comment)) return;
                preparedRef.current.add(comment);
            }
            // 判断是否为长文本（超过指定行数）
            comment.isLong = (comment.content?.match(/\n/g) || []).length >= maxLines || (comment.content || "").length > 100;
            comment.expanded = false;
            comment.showReplyInput = false;
            comment.replyContent = "";
            comment.showAllReplies = false;

            // 初始化回复
            if (comment.replies) {
                comment.replies.forEach((reply: any) => {
                    reply.isLike = reply.isLike || false;
                });
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [comments]);

    // 切换评论展开收起
    const toggleComment = useCallback((comment: CommentItem) => {
        comment.expanded = !comment.expanded;
        forceRender();
    }, []);

    // 显示/隐藏回复输入框
    const toggleReplyInput = useCallback(
        (comment: CommentItem) => {
            onShowReplyInput?.(comment);
        },
        [onShowReplyInput]
    );

    // 点赞评论
    const likeComment = useCallback(
        (comment: CommentItem) => {
            onLikeComment?.(comment);
        },
        [onLikeComment]
    );

    // 点赞回复
    const likeReply = useCallback(
        (_comment: CommentItem, reply: CommentReply) => {
            onLikeReply?.(reply);
        },
        [onLikeReply]
    );

    // 回复某条回复
    const showReplyTo = useCallback(
        (comment: CommentItem, _reply: CommentReply) => {
            onShowReplyInput?.(comment);
        },
        [onShowReplyInput]
    );

    const toggleReplies = useCallback(
        (comment: CommentItem, index: number) => {
            comment.showAllReplies = true;
            onGetReplyList?.({ ...comment, index });
            forceRender();
        },
        [onGetReplyList]
    );

    const collapseReplies = useCallback((comment: CommentItem) => {
        comment.showAllReplies = false;
        comment.toggleText = `${t("展开")}${comment.replyCount}${t("条回复")}`;
        comment.page = 1;
        comment.replies = [];
        forceRender();
    }, []);

    const getLoadedReplyCount = (comment: CommentItem) => (Array.isArray(comment.replies) ? comment.replies.length : 0);

    const shouldShowLoadMoreReplies = (comment: CommentItem) => {
        const replyCount = Number(comment.replyCount) || 0;
        if (replyCount <= 0) return false;
        if (!comment.showAllReplies) return true;
        return getLoadedReplyCount(comment) < replyCount;
    };

    const shouldShowCollapseReplies = (comment: CommentItem) => {
        const replyCount = Number(comment.replyCount) || 0;
        return !!comment.showAllReplies && replyCount > 0 && getLoadedReplyCount(comment) >= replyCount;
    };

    const getLoadMoreRepliesText = (comment: CommentItem) => {
        const replyCount = Number(comment.replyCount) || 0;
        if (!comment.showAllReplies) {
            return `${t("展开")}${replyCount}${t("条回复")}`;
        }
        const remainingCount = Math.max(replyCount - getLoadedReplyCount(comment), 0);
        return `${t("展开")}${remainingCount}${t("条回复")}`;
    };

    return (
        <View className="comment-list">
            {/* 评论列表 */}
            {comments.map((comment, index) => (
                <View className="comment-item" key={index}>
                    {/* 主评论 */}
                    <View className="comment-main">
                        {/* 用户头像 */}
                        <View className="user-userPhoto">
                            <TigImage src={comment.userPhoto || ""} className="userPhoto-img" mode="aspectFill" />
                        </View>

                        {/* 评论内容区 */}
                        <View className="comment-content">
                            {/* 用户信息 */}
                            <View className="user-info">
                                <View className="user-info-content">
                                    <Text className="userName">{comment.userName}</Text>
                                    {comment.isMe === 1 ? (
                                        <Text className="writer-tag">{t("我")}</Text>
                                    ) : comment.isAuthor === 1 ? (
                                        <Text className="writer-tag">{t("作者")}</Text>
                                    ) : null}
                                </View>
                                <View className="action-item" onClick={() => likeComment(comment)}>
                                    <Text className={`iconfont-h5 ${comment.isLike ? "icon-yiguanzhu" : "icon-guanzhu"}`} />
                                    <Text className={`like-count${comment.isLike ? " liked" : ""}`}>
                                        {(comment.likeCount || 0) > 0 ? comment.likeCount : ""}
                                    </Text>
                                </View>
                            </View>

                            {/* 评论文本 */}
                            <View className="comment-text">
                                <Text
                                    className={!comment.expanded && comment.isLong ? "text-collapse" : ""}
                                    style={{ WebkitLineClamp: comment.expanded ? "unset" : String(maxLines) } as any}
                                >
                                    {comment.content}
                                </Text>
                                {/* 展开/收起按钮 */}
                                {comment.isLong && (
                                    <Text className="toggle-btn" onClick={() => toggleComment(comment)}>
                                        {comment.expanded ? t("收起") : t("展开")}
                                    </Text>
                                )}
                            </View>

                            {/* 评论操作 */}
                            <View className="comment-actions">
                                <View className="action-item">
                                    <Text className="time">{comment.addTime}</Text>
                                    <Text className="replyText" onClick={() => toggleReplyInput(comment)}>
                                        {t("回复")}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* 回复列表 */}
                    {comment.replies && comment.replies.length > 0 && comment.showAllReplies && (
                        <View className="replies-list">
                            {comment.replies.map((reply: any, replyIndex: number) => (
                                <View className="reply-item" key={replyIndex}>
                                    <View className="reply-main">
                                        <View className="user-userPhoto">
                                            <TigImage src={reply.userPhoto || ""} className="userPhoto-img small" mode="aspectFill" />
                                        </View>

                                        <View className="reply-content">
                                            <View className="user-info">
                                                <View className="user-info-content">
                                                    <Text className="userName">{reply.userName}</Text>
                                                    {reply.isMe === 1 ? (
                                                        <Text className="writer-tag">{t("我")}</Text>
                                                    ) : reply.isAuthor === 1 ? (
                                                        <Text className="writer-tag">{t("作者")}</Text>
                                                    ) : null}
                                                </View>
                                                <View className="action-item" onClick={() => likeReply(comment, reply)}>
                                                    <Text className={`iconfont-h5 ${reply.isLike ? "icon-yiguanzhu" : "icon-guanzhu"}`} />
                                                    <Text className={`like-count${reply.isLike ? " liked" : ""}`}>
                                                        {(reply.likeCount || 0) > 0 ? reply.likeCount : ""}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="reply-text">
                                                <Text>{reply.content}</Text>
                                            </View>
                                            <View>
                                                <Text className="time">{reply.addTime}</Text>
                                                <Text className="replyText" onClick={() => showReplyTo(comment, reply)}>
                                                    {t("回复")}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                    {/* 有剩余回复时显示继续展开按钮 */}
                    {shouldShowLoadMoreReplies(comment) && (
                        <View className="view-more-replies" onClick={() => toggleReplies(comment, index)}>
                            <Text>{getLoadMoreRepliesText(comment)}</Text>
                        </View>
                    )}
                    {shouldShowCollapseReplies(comment) && (
                        <View className="view-more-replies" onClick={() => collapseReplies(comment)}>
                            <Text>{t("收起回复")}</Text>
                        </View>
                    )}
                </View>
            ))}
            {/* 加载更多 */}
            {loading && (
                <View className="loading-more">
                    <Text>{t("加载中...")}</Text>
                </View>
            )}
            {noMore && comments.length > 0 && (
                <View className="no-more">
                    <Text>{t("没有更多评论了")}</Text>
                </View>
            )}
        </View>
    );
}