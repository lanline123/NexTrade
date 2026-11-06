import { useEffect, useState } from "react";
import { Image, Input, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import type { VideoFeedCommentRow } from "@/types/buyerShow/videoFeed";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";
import { useVideoComments } from "../composables/useVideoComments";

import "./CommentSheet.scss";

interface Props {
    /** 旧 v-model:show */
    show: boolean;
    buyerShowId: string | number;
    commentCount?: number;
    onShowChange?: (value: boolean) => void;
    /** 旧 v-model:comment-count */
    onCommentCountChange?: (count: number) => void;
}

/**
 * 买家秀视频流评论弹层（自旧 components/commentSheet.vue 移植）
 * - 一级评论分页加载，二级回复按需展开
 * - 点赞、回复、发送均复用 useVideoComments
 * - 旧 tig-popup → NutUI Popup（bottom + 16 圆角）
 */
export default function CommentSheet({ show, buyerShowId, commentCount = 0, onShowChange, onCommentCountChange }: Props) {
    const { list, total, loading, hasMore, replyPlaceholder, reload, loadMore, like, send, setReplyTarget, clearReplyTarget, toggleReplies } =
        useVideoComments();
    const [content, setContent] = useState("");
    const [isFocus, setIsFocus] = useState(false);

    const displayTotal = total || commentCount || 0;

    const windowHeight = Taro.getSystemInfoSync().windowHeight || 667;
    const sheetHeight = Math.round(windowHeight * 0.7);
    const sheetStyle = { height: `${sheetHeight}px` };
    const bodyStyle = { flex: 1, height: "0px", minHeight: "0px" };

    const focusInput = () => {
        setIsFocus(false);
        setTimeout(() => {
            setIsFocus(true);
        }, 100);
    };

    useEffect(() => {
        if (show) {
            void reload(buyerShowId);
        } else {
            clearReplyTarget();
            setContent("");
            setIsFocus(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    const handleLike = (item: VideoFeedCommentRow) => {
        void like(item);
    };

    const handleReply = (item: VideoFeedCommentRow) => {
        setReplyTarget(item);
        focusInput();
    };

    const handleToggleReplies = (item: VideoFeedCommentRow) => {
        void toggleReplies(item);
    };

    const handleSend = async () => {
        const ok = await send(content);
        if (ok) {
            setContent("");
            onCommentCountChange?.(total);
        }
    };

    const previewImage = (images: string[], current: string) => {
        // 迁移说明：Taro.previewImage 不支持 uni 的 indicator / loop 参数
        Taro.previewImage({ urls: images, current });
    };

    return (
        <Popup
            visible={show}
            position="bottom"
            closeable={false}
            onClose={() => onShowChange?.(false)}
            style={{ backgroundColor: "#fff", borderRadius: "16px 16px 0 0" }}
        >
            <View className="comment-sheet" style={sheetStyle}>
                <View className="sheet-header">
                    <Text className="title">{isOverseas() ? t("共{0}条评论", { 0: displayTotal }) : `共${displayTotal}条评论`}</Text>
                    <View className="close" onClick={() => onShowChange?.(false)}>
                        <View className="iconfont-h5 icon-chacha close-icon" />
                    </View>
                </View>

                <ScrollView scrollY enableFlex className="sheet-body" style={bodyStyle} onScrollToLower={loadMore}>
                    {list.map((item, index) => (
                        <View className="c-item" key={item.buyerShowCommentId || index}>
                            <Image className="c-avatar" src={item.buyerPhoto || ""} mode="aspectFill" />
                            <View className="c-main">
                                <View className="c-top">
                                    <View className="c-name-box">
                                        <Text className="c-name">{item.buyerName}</Text>
                                        {Number(item.isMe) === 1 ? (
                                            <Text className="c-tag">{t("我")}</Text>
                                        ) : Number(item.isAuthor) === 1 ? (
                                            <Text className="c-tag">{t("作者")}</Text>
                                        ) : null}
                                    </View>
                                    <View className="c-like" onClick={() => handleLike(item)}>
                                        <View className={`iconfont-h5 c-like-icon ${item.isLike ? "icon-yiguanzhu is-like" : "icon-guanzhu"}`} />
                                        <Text className="c-like-num">{Number(item.likeCount) > 0 ? item.likeCount : ""}</Text>
                                    </View>
                                </View>
                                <Text className="c-content">{item.content}</Text>
                                {item.images && item.images.length > 0 && (
                                    <View className="c-images">
                                        {item.images.map((img, i) => (
                                            <Image
                                                key={i}
                                                className="c-img"
                                                src={img}
                                                mode="aspectFill"
                                                onClick={() => previewImage(item.images as string[], img)}
                                            />
                                        ))}
                                    </View>
                                )}
                                <View className="c-bottom">
                                    <Text className="c-time">{item.addTime}</Text>
                                    <Text className="c-reply" onClick={() => handleReply(item)}>
                                        {t("回复")}
                                    </Text>
                                </View>

                                {item.showAllReplies && item.replies && item.replies.length > 0 && (
                                    <View className="replies">
                                        {item.replies.map((reply, rIndex) => (
                                            <View className="reply-item" key={reply.buyerShowCommentId || rIndex}>
                                                <Image className="c-avatar c-avatar--sm" src={reply.buyerPhoto || ""} mode="aspectFill" />
                                                <View className="c-main">
                                                    <View className="c-top">
                                                        <View className="c-name-box">
                                                            <Text className="c-name">{reply.buyerName}</Text>
                                                            {Number(reply.isMe) === 1 ? (
                                                                <Text className="c-tag">{t("我")}</Text>
                                                            ) : Number(reply.isAuthor) === 1 ? (
                                                                <Text className="c-tag">{t("作者")}</Text>
                                                            ) : null}
                                                        </View>
                                                        <View className="c-like" onClick={() => handleLike(reply)}>
                                                            <View
                                                                className={`iconfont-h5 c-like-icon ${
                                                                    reply.isLike ? "icon-yiguanzhu is-like" : "icon-guanzhu"
                                                                }`}
                                                            />
                                                            <Text className="c-like-num">
                                                                {Number(reply.likeCount) > 0 ? reply.likeCount : ""}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <Text className="c-content">{reply.content}</Text>
                                                    <View className="c-bottom">
                                                        <Text className="c-time">{reply.addTime}</Text>
                                                        <Text className="c-reply" onClick={() => handleReply(item)}>
                                                            {t("回复")}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {Number(item.replyCount) > 0 && (
                                    <View className="view-more" onClick={() => handleToggleReplies(item)}>
                                        <Text className="view-more-text">
                                            {item.toggleText ||
                                                (isOverseas()
                                                    ? t("展开{0}条回复", { 0: item.replyCount })
                                                    : `展开${item.replyCount}条回复`)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}

                    {loading ? (
                        <View className="c-tip">{t("加载中...")}</View>
                    ) : !hasMore && list.length > 0 ? (
                        <View className="c-tip">{t("没有更多评论了")}</View>
                    ) : !loading && list.length === 0 ? (
                        <View className="c-empty">{t("暂无评论")}</View>
                    ) : null}
                </ScrollView>

                <View className="sheet-footer">
                    <View className="footer-input">
                        <Input
                            value={content}
                            placeholder={replyPlaceholder}
                            placeholderStyle="font-size: 26rpx;"
                            focus={isFocus}
                            cursorSpacing={60}
                            holdKeyboard
                            confirmType="send"
                            onInput={(event) => setContent(event.detail.value)}
                            onFocus={() => setIsFocus(true)}
                            onBlur={() => setIsFocus(false)}
                            onConfirm={handleSend}
                        />
                    </View>
                    <View className={`footer-send${content ? " active" : ""}`} onClick={handleSend}>
                        {t("发送")}
                    </View>
                </View>
            </View>
        </Popup>
    );
}