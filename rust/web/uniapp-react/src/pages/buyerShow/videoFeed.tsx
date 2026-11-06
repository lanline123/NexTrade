import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, Slider, Swiper, SwiperItem, Text, Video, View } from "@tarojs/components";
import Taro, { useDidHide, useLoad, useReady, useUnload } from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import CommentSheet from "./components/CommentSheet";
import BuyerShowShare from "./components/BuyerShowShare";
import type { VideoFeedProduct } from "@/types/buyerShow/videoFeed";
import { redirect } from "@/utils";
import { useSafeAreaInsets } from "@/hooks";
import { useConfigStore } from "@/store/config";
import { ensureShareLogin } from "@/utils/shareLogin";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { useVideoFeed } from "./composables/useVideoFeed";
import playIcon from "./assets/videoFeed/play.png";

import "./videoFeed.scss";

/** rpx → px（等价旧 uni.upx2px） */
const rpx2px = (value: number) => (Taro.getSystemInfoSync().windowWidth / 750) * value;

/**
 * 买家秀视频流页（自旧 videoFeed.vue 移植）
 * - 外层竖向 swiper 翻内容，内层横向 swiper 翻当前条的附图
 * - 播放、分页与互动逻辑收敛在 useVideoFeed
 */
export default function VideoFeed() {
    usePageGuards();
    const { saveTop, safeBottom } = useSafeAreaInsets();
    const configStore = useConfigStore();
    const footerContentHeight = rpx2px(96);
    const footerHeight = safeBottom + footerContentHeight;
    const feedContentStyle = { height: `calc(100% - ${footerHeight}px)` };
    const progressBarStyle = { bottom: `${-rpx2px(8)}px` };
    const bottomBarStyle = { bottom: `${rpx2px(30)}px` };
    const assetSegBarStyle = { bottom: `${-rpx2px(8)}px` };
    const sideBarStyle = { bottom: `${Math.max(0, 200 - footerContentHeight)}px` };
    const footerStyle = { height: `${footerHeight}px`, paddingBottom: `${safeBottom}px` };

    const feed = useVideoFeed({ size: 5 });
    const {
        list,
        current,
        loading,
        hasMore,
        inited,
        currentTimeOf,
        initialTimeOf,
        durationOf,
        readVideoTime,
        previewSeek,
        commitSeek,
        videoId,
        playSrc,
        shouldRenderVideo,
        imagesOf,
        assetCount,
        hasMultiAsset,
        assetIndexOf,
        isVideoAsset,
        setAssetIndex,
        clearAutoPlay,
        scheduleAutoPlay,
        init,
        onChange,
        patchItem,
        toggleLike,
        toggleFollow
    } = feed;

    const [currentPaused, setCurrentPaused] = useState(false);
    // H5 直接访问或刷新时没有用户手势，浏览器只允许静音自动播放
    const [h5AutoplayMuted, setH5AutoplayMuted] = useState(() => {
        if (process.env.TARO_ENV !== "h5") return false;
        return typeof navigator === "undefined" || !(navigator as any).userActivation?.hasBeenActive;
    });
    const shouldMuteVideo = (index: number) => index !== current || h5AutoplayMuted;
    // 微信小程序由当前 video 的 autoplay 负责首播，避免与生命周期里的 play() 重复启动
    const shouldManuallyStartFirstVideo = process.env.TARO_ENV !== "weapp";

    /** 微信小程序只挂载当前屏 video，避免原生视频实例在后台自行播放串音 */
    const shouldMountVideo = (index: number) => {
        let shouldMount = shouldRenderVideo(index);
        if (process.env.TARO_ENV === "weapp") {
            shouldMount = index === current && isVideoAsset(index);
        }
        return shouldMount;
    };

    const [contentExpanded, setContentExpanded] = useState(false);
    // 文案超过 15 字显示展开/收起
    const isLongText = (content?: string) => !!content && content.length > 15;
    const collapsedContent = (content: string) => (content.length > 15 ? content.slice(0, 15) + "..." : content);

    const [commentVisible, setCommentVisible] = useState(false);
    const isFeedSwipingRef = useRef(false);
    const feedTouchStartY = useRef<number | null>(null);
    const feedTouchStartIndex = useRef<number | null>(null);
    const [showShare, setShowShare] = useState(false);
    const currentItem = list[current];
    const commentCountModel = currentItem?.commentCount ?? 0;

    useLoad((options?: Record<string, string | undefined>) => {
        void init(options?.buyerShowId);
    });

    useReady(() => {
        if (shouldManuallyStartFirstVideo && inited) {
            feed.playIndex(current);
            setTimeout(() => feed.warmNeighbors(current), 120);
        }
    });

    // 数据就绪后播放首屏并预热相邻
    useEffect(() => {
        if (shouldManuallyStartFirstVideo && inited) {
            setTimeout(() => {
                feed.playIndex(current);
                feed.warmNeighbors(current);
            }, 80);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inited]);

    // 评论弹层遮住画面期间不推进轮播，关闭后若仍停在图片位则续上
    useEffect(() => {
        if (commentVisible) {
            clearAutoPlay();
        } else if (!isVideoAsset(current)) {
            scheduleAutoPlay();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [commentVisible]);

    // pauseAll 内部已清理轮播定时器
    useDidHide(() => feed.pauseAll());
    useUnload(() => feed.pauseAll());

    const onSwiperChange = (e: any) => {
        const next = e.detail.current;
        isFeedSwipingRef.current = true;
        onChange(next);
        setCurrentPaused(false);
        setContentExpanded(false);
    };

    const onFeedTouchStart = (e: any) => {
        feedTouchStartY.current = e.touches?.[0]?.clientY ?? null;
        feedTouchStartIndex.current = current;
    };

    const onFeedTouchEnd = (e: any) => {
        const startY = feedTouchStartY.current;
        const startIndex = feedTouchStartIndex.current;
        feedTouchStartY.current = null;
        feedTouchStartIndex.current = null;
        if (startY === null || startIndex !== list.length - 1 || current !== list.length - 1 || hasMore) return;

        const endY = e.changedTouches?.[0]?.clientY;
        if (typeof endY !== "number" || startY - endY < rpx2px(80)) return;
        Taro.showToast({ title: t("暂时没有更多了"), icon: "none" });
    };

    /** 内层横滑：切换当前屏的素材位，播放态与轮播定时器由 setAssetIndex 统一处理 */
    const onAssetChange = (screen: number, e: any) => {
        setAssetIndex(screen, e.detail.current);
    };

    const togglePlay = () => {
        // H5 静音首播后的第一次点击用于恢复声音，并保持视频继续播放
        if (h5AutoplayMuted) {
            setH5AutoplayMuted(false);
            feed.playIndex(current);
            return;
        }
        if (currentPaused) {
            feed.playIndex(current);
        } else {
            feed.pauseIndex(current);
        }
    };

    const onVideoPlay = (index: number) => {
        // 微信小程序偶尔会自行恢复已挂载的相邻 video，立即暂停可避免串音
        if (process.env.TARO_ENV === "weapp" && index !== current) {
            feed.pauseIndex(index);
            return;
        }
        if (index === current) setCurrentPaused(false);
    };

    const onVideoPause = (index: number) => {
        if (index === current) setCurrentPaused(true);
    };

    const prepareCommentTap = () => {
        isFeedSwipingRef.current = false;
    };

    const openComment = (screen = current) => {
        if (isFeedSwipingRef.current || screen !== current) return;
        clearAutoPlay();
        setCommentVisible(true);
    };

    const handleShare = () => {
        if (!ensureShareLogin()) return;
        setShowShare(true);
    };

    const goProduct = (product: VideoFeedProduct) => {
        redirect({ url: "/pages/product/index", param: { id: product.productId } });
    };

    const goBack = () => {
        Taro.navigateBack({
            fail: () => {
                redirect({ url: "/pages/buyerShow/index" });
            }
        });
    };

    const formatCount = (num?: number) => {
        const value = Number(num) || 0;
        if (value >= 10000) return (value / 10000).toFixed(1) + "w";
        return String(value);
    };

    return (
        <View className="video-feed">
            {/* 返回按钮 */}
            <View className="nav-back" style={{ top: `${saveTop + 8}px` }} onClick={goBack}>
                <View className="iconfont-h5 icon-zhankai nav-back-icon" />
            </View>

            {list.length > 0 && (
                <Swiper
                    className="feed-swiper"
                    style={feedContentStyle}
                    vertical
                    current={current}
                    circular={false}
                    duration={250}
                    onChange={onSwiperChange}
                    onTouchStart={onFeedTouchStart}
                    onTouchEnd={onFeedTouchEnd}
                >
                    {list.map((item, index) => (
                        <SwiperItem key={String(item.buyerShowId)}>
                            <View className="feed-item">
                                {/* 无附图：保持单视频结构，不引入内层容器 */}
                                {!hasMultiAsset(index) ? (
                                    shouldMountVideo(index) ? (
                                        <Video
                                            id={videoId(index)}
                                            className="feed-video"
                                            src={shouldRenderVideo(index) ? playSrc(index) : ""}
                                            poster={item.video.videoCover}
                                            initialTime={initialTimeOf(index)}
                                            controls={false}
                                            autoplay={index === current}
                                            muted={shouldMuteVideo(index)}
                                            loop
                                            showCenterPlayBtn={false}
                                            enableProgressGesture={false}
                                            objectFit="cover"
                                            onPlay={() => onVideoPlay(index)}
                                            onPause={() => onVideoPause(index)}
                                            onTimeUpdate={(event) => readVideoTime(index, event as any)}
                                            onClick={togglePlay}
                                        />
                                    ) : (
                                        <Image className="feed-video" src={item.video.videoCover} mode="aspectFill" />
                                    )
                                ) : (
                                    /* 有附图：视频占第 1 位，附图依次跟后，可横滑切换 */
                                    <Swiper
                                        className="asset-swiper"
                                        current={assetIndexOf(index)}
                                        circular={false}
                                        duration={200}
                                        onChange={(event) => onAssetChange(index, event)}
                                    >
                                        <SwiperItem>
                                            {shouldMountVideo(index) ? (
                                                <Video
                                                    id={videoId(index)}
                                                    className="feed-video"
                                                    src={shouldRenderVideo(index) ? playSrc(index) : ""}
                                                    poster={item.video.videoCover}
                                                    initialTime={initialTimeOf(index)}
                                                    controls={false}
                                                    autoplay={index === current}
                                                    muted={shouldMuteVideo(index)}
                                                    loop
                                                    showCenterPlayBtn={false}
                                                    enableProgressGesture={false}
                                                    objectFit="cover"
                                                    onPlay={() => onVideoPlay(index)}
                                                    onPause={() => onVideoPause(index)}
                                                    onTimeUpdate={(event) => readVideoTime(index, event as any)}
                                                    onClick={togglePlay}
                                                />
                                            ) : (
                                                <Image className="feed-video" src={item.video.videoCover} mode="aspectFill" />
                                            )}
                                        </SwiperItem>
                                        {imagesOf(index).map((img, j) => (
                                            <SwiperItem key={j}>
                                                <Image className="feed-image" src={img.picUrl} mode="aspectFit" />
                                            </SwiperItem>
                                        ))}
                                    </Swiper>
                                )}

                                {/* 暂停时的播放按钮；图片位不显示 */}
                                {index === current && currentPaused && isVideoAsset(index) && (
                                    <Image className="play-btn" src={playIcon} mode="aspectFit" onClick={(event) => {
                                        event.stopPropagation();
                                        togglePlay();
                                    }} />
                                )}

                                {index === current && isVideoAsset(index) && !hasMultiAsset(index) && (
                                    <View
                                        className="video-progress-wrap"
                                        style={progressBarStyle}
                                        onTouchStart={(event) => event.stopPropagation()}
                                        onTouchMove={(event) => event.stopPropagation()}
                                    >
                                        <Slider
                                            className="video-progress"
                                            value={Math.min(currentTimeOf(index), Math.max(durationOf(index), 1))}
                                            max={Math.max(durationOf(index), 1)}
                                            blockSize={12}
                                            activeColor="#ffffff"
                                            backgroundColor="rgba(255, 255, 255, 0.35)"
                                            onChanging={(event) => previewSeek(index, event as any)}
                                            onChange={(event) => commitSeek(index, event as any)}
                                        />
                                    </View>
                                )}

                                {/* 素材分段进度条：段数 = 1 视频 + N 附图 */}
                                {hasMultiAsset(index) && (
                                    <View
                                        className="asset-seg-bar"
                                        style={assetSegBarStyle}
                                        onTouchStart={(event) => event.stopPropagation()}
                                        onTouchMove={(event) => event.stopPropagation()}
                                    >
                                        {Array.from({ length: assetCount(index) }, (_v, segIndex) => segIndex + 1).map((seg) => (
                                            <View className="asset-seg" key={seg}>
                                                {seg === 1 && isVideoAsset(index) ? (
                                                    <Slider
                                                        className="asset-video-progress"
                                                        value={Math.min(currentTimeOf(index), Math.max(durationOf(index), 1))}
                                                        max={Math.max(durationOf(index), 1)}
                                                        blockSize={10}
                                                        activeColor="#ffffff"
                                                        backgroundColor="rgba(255, 255, 255, 0.3)"
                                                        onChanging={(event) => previewSeek(index, event as any)}
                                                        onChange={(event) => commitSeek(index, event as any)}
                                                    />
                                                ) : (
                                                    <View className={`asset-seg-line${seg - 1 === assetIndexOf(index) ? " is-active" : ""}`} />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* 右侧互动栏 */}
                                <View className="side-bar" style={sideBarStyle}>
                                    <View className="side-item" onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleLike(item);
                                    }}>
                                        <View className={`iconfont-h5 side-icon ${item.isLike ? "icon-yiguanzhu is-like" : "icon-yishoucang1"}`} />
                                        <Text className="side-num">{formatCount(item.likeCount)}</Text>
                                    </View>
                                    <View
                                        className="side-item"
                                        onTouchStart={prepareCommentTap}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            openComment(index);
                                        }}
                                    >
                                        <View className="iconfont-h5 icon-pinglun1 side-icon" />
                                        <Text className="side-num">{formatCount(item.commentCount)}</Text>
                                    </View>
                                    <View className="side-item" onClick={(event) => {
                                        event.stopPropagation();
                                        handleShare();
                                    }}>
                                        <View className="iconfont-h5 icon-fenxiang2 side-icon" />
                                    </View>
                                </View>

                                {/* 底部信息 */}
                                <View className="bottom-bar" style={bottomBarStyle}>
                                    {item.productList && item.productList.length > 0 && (
                                        <View className="product-card" onClick={(event) => {
                                            event.stopPropagation();
                                            goProduct(item.productList[0]);
                                        }}>
                                            <View className="pc-icon">
                                                <View className="iconfont-h5 icon-gouwucheman1 pc-icon-img" />
                                            </View>
                                            <Text className="pc-name">{item.productList[0].productName}</Text>
                                        </View>
                                    )}

                                    <View className="author-row">
                                        <TigImage src={item.author.buyerPhoto} className="author-avatar" mode="aspectFill" />
                                        <Text className="author-name">{item.author.buyerName}</Text>
                                        {item.author.userId && !item.author.isFollow && (
                                            <View className="follow-btn" onClick={(event) => {
                                                event.stopPropagation();
                                                void toggleFollow(item);
                                            }}>
                                                {t("关注")}
                                            </View>
                                        )}
                                    </View>

                                    {item.content && (
                                        <View className="content-box">
                                            {isLongText(item.content) && !contentExpanded ? (
                                                <View className="content-collapsed-row">
                                                    <Text className="content-text is-collapsed">{collapsedContent(item.content)}</Text>
                                                    <Text className="content-toggle" onClick={(event) => {
                                                        event.stopPropagation();
                                                        setContentExpanded(true);
                                                    }}>
                                                        {t("展开")}
                                                    </Text>
                                                </View>
                                            ) : isLongText(item.content) ? (
                                                <>
                                                    <ScrollView
                                                        className="content-scroll"
                                                        scrollY
                                                        onTouchStart={(event) => event.stopPropagation()}
                                                        onTouchMove={(event) => event.stopPropagation()}
                                                    >
                                                        <Text className="content-text">{item.content}</Text>
                                                    </ScrollView>
                                                    <Text className="content-toggle content-toggle--expanded" onClick={(event) => {
                                                        event.stopPropagation();
                                                        setContentExpanded(false);
                                                    }}>
                                                        {t("收起")}
                                                    </Text>
                                                </>
                                            ) : (
                                                <Text className="content-text">{item.content}</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </SwiperItem>
                    ))}
                </Swiper>
            )}

            {list.length === 0 && loading && (
                <View className="feed-status">
                    <View className="feed-loading" />
                </View>
            )}
            {list.length === 0 && !loading && (
                <View className="feed-status">
                    <Text className="feed-empty-text">{t("暂无视频买家秀")}</Text>
                </View>
            )}

            {currentItem && (
                <View className="feed-footer" style={footerStyle}>
                    <View
                        className="comment-entry"
                        onTouchStart={prepareCommentTap}
                        onClick={(event) => {
                            event.stopPropagation();
                            openComment();
                        }}
                    >
                        <Text className="comment-placeholder">{t(configStore.buyerShowGuidanceContent || "说点什么吧~")}</Text>
                    </View>
                </View>
            )}

            {currentItem && (
                <CommentSheet
                    show={commentVisible}
                    buyerShowId={currentItem.buyerShowId}
                    commentCount={commentCountModel}
                    onShowChange={setCommentVisible}
                    onCommentCountChange={(count) => patchItem(current, { commentCount: count })}
                />
            )}
            {currentItem && (
                <BuyerShowShare
                    modelValue={showShare}
                    buyerShowId={currentItem.buyerShowId}
                    content={currentItem.content}
                    buyerName={currentItem.author.buyerName}
                    buyerPhoto={currentItem.author.buyerPhoto}
                    cover={currentItem.video.videoCover}
                    onModelValueChange={setShowShare}
                />
            )}
        </View>
    );
}