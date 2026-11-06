import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Input, ScrollView, Swiper, SwiperItem, Text, Video, View } from "@tarojs/components";
import Taro, { useDidHide, useLoad, useUnload } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigImage from "@/components/tig/tig-image/TigImage";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import BuyerShowCloseTip from "./src/BuyerShowCloseTip";
import BuyerShowShare from "./components/BuyerShowShare";
import Comments from "./comments";
import type { CommentsRef } from "./comments";
import EmojiPicker from "./buyerShowCompnents/EmojiPicker";
import { buyerShowComment, buyerShowDetail, buyerShowLike } from "@/api/buyerShow/buyerShow";
import type { BuyerShowDetailState } from "@/types/buyerShow/buyerShow";
import { useConfigStore } from "@/store/config";
import { getImageInfo, redirect } from "@/utils";
import { imageFormat } from "@/utils/format";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import { ensureShareLogin } from "@/utils/shareLogin";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { useProductStyle } from "@/hooks/useProductStyle";

import "./buyerShowDetail.scss";

const BUYER_SHOW_LIST_NEED_REFRESH_KEY = "buyerShow:listNeedRefresh";
const MAX_IMAGE_HEIGHT = 600;
const MIN_IMAGE_HEIGHT = 300;

/**
 * 买家秀详情页（自旧 buyerShowDetail.vue 移植）
 * - 展示图片/视频轮播、用户信息、内容和关联商品
 * - 支持点赞和评论功能，评论支持表情输入
 * - 点赞状态变化时通过 Storage 标记，返回列表时刷新
 * - 页面隐藏时自动暂停视频播放
 */
export default function BuyerShowDetail() {
    usePageGuards();
    const configStore = useConfigStore();
    const commentsRef = useRef<CommentsRef>(null);

    const [buyerShowEnabled, setBuyerShowEnabled] = useState<number | undefined>(1);
    useEffect(() => {
        if (configStore.initLoading) {
            setBuyerShowEnabled(configStore.buyerShowEnabled);
        }
    }, [configStore.initLoading, configStore.buyerShowEnabled]);

    const [buyerShowId, setBuyerShowId] = useState<string | number | null>(null);
    const [showShare, setShowShare] = useState(false);
    const [buyerShowDetailData, setBuyerShowDetailData] = useState<BuyerShowDetailState>({
        videoList: [],
        imgList: []
    });

    // 供 useUnload 读取最新数据（Taro 生命周期回调可能持有首次渲染闭包）
    const detailDataRef = useRef<BuyerShowDetailState>(buyerShowDetailData);
    detailDataRef.current = buyerShowDetailData;

    const buyerShowProductList = useMemo(() => buyerShowDetailData?.productList ?? [], [buyerShowDetailData]);
    const { styleMap: buyerShowProductStyleMap } = useProductStyle(buyerShowProductList);

    // 进入详情时的点赞状态（用于判断离开时是否发生变化）
    const initialIsLikeRef = useRef<boolean | null>(null);
    // 仅当用户在详情里实际操作过点赞/取消点赞后，才触发返回刷新
    const hasLikeToggledRef = useRef(false);
    const [isLoading, setIsLoading] = useState(false);
    // 首张媒体（图片/视频封面）就绪后再展示轮播，避免空白 video 组件闪一下
    const [mediaReady, setMediaReady] = useState(false);
    // 与旧 ref 同步语义一致：playVideoByIndex 在 setState 后立即读取
    const mediaReadyRef = useRef(false);
    const setMediaReadyBoth = (value: boolean) => {
        mediaReadyRef.current = value;
        setMediaReady(value);
    };
    const [swiperHeight, setSwiperHeight] = useState("300rpx");
    const [content, setContent] = useState("");
    const [isFocus, setIsFocus] = useState(false);
    const [current, setCurrent] = useState(0);

    const [replyData, setReplyData] = useState<any>({});

    const swiperList = useMemo(() => {
        const list = [...(buyerShowDetailData?.videoList ?? []), ...(buyerShowDetailData?.imgList ?? [])].filter(Boolean);
        return list.map((item: any) => {
            // 有 videoUrl 视为视频；封面用 videoCover，没有则用 picUrl 兜底
            if (item.videoUrl) {
                return {
                    ...item,
                    type: "video",
                    image: item.videoUrl,
                    poster: imageFormat(item.videoCover || item.picUrl || "")
                };
            }
            return {
                ...item,
                type: "image",
                // 旧实现：imageFormat(item.picUrl || "")；previewImage 需要完整地址
                image: imageFormat(item.picUrl || "")
            };
        });
    }, [buyerShowDetailData]);

    // 海报封面：优先取首个视频封面，否则取首张图片（原始地址，交由海报组件统一 imageFormat）
    const shareCover = useMemo(() => {
        const video = (buyerShowDetailData?.videoList ?? [])[0];
        if (video) {
            return video.videoCover || video.picUrl || "";
        }
        const image = (buyerShowDetailData?.imgList ?? [])[0];
        return image?.picUrl || "";
    }, [buyerShowDetailData]);

    const touchStartXRef = useRef(0);
    const isSwipingRef = useRef(false);
    // 当前播放的视频索引
    const playingVideoIndexRef = useRef<number | null>(null);
    // 是否开启「切到视频自动播放」
    const autoPlayVideoRef = useRef(true);
    const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // 仅在详情接口回填后测一次首屏媒体尺寸（点赞等局部更新不重复测量）
    const pendingMeasureRef = useRef(false);

    // 暂停所有视频
    const pauseAllVideos = () => {
        swiperList.forEach((_item: any, index: number) => {
            const videoContext = Taro.createVideoContext(`video-${index}`);
            if (videoContext) {
                videoContext.pause();
            }
        });
        playingVideoIndexRef.current = null;
    };

    // 播放指定索引的视频（会等一帧，确保 video 节点已渲染）
    const playVideoByIndex = (index: number) => {
        if (!autoPlayVideoRef.current) return;
        if (!mediaReadyRef.current) return;
        if (swiperList[index]?.type !== "video") return;
        if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = setTimeout(() => {
            const videoContext = Taro.createVideoContext(`video-${index}`);
            // 某些端可能会因为「非用户手势」而禁止自动播放，失败也不影响其他功能
            try {
                videoContext?.play?.();
                playingVideoIndexRef.current = index;
            } catch {
                // noop
            }
        }, 80);
    };

    // 视频开始播放时记录
    const onVideoPlay = (index: number) => {
        // 暂停其他正在播放的视频
        if (playingVideoIndexRef.current !== null && playingVideoIndexRef.current !== index) {
            const videoContext = Taro.createVideoContext(`video-${playingVideoIndexRef.current}`);
            if (videoContext) {
                videoContext.pause();
            }
        }
        playingVideoIndexRef.current = index;
    };

    // 监听 swiper 滑动，标记为正在滑动
    const onSwiperChange = (e: any) => {
        const prevIndex = current;
        setCurrent(e.detail.current);
        isSwipingRef.current = true;

        // 切换时暂停之前的视频
        if (swiperList[prevIndex]?.type === "video") {
            const videoContext = Taro.createVideoContext(`video-${prevIndex}`);
            if (videoContext) {
                videoContext.pause();
            }
        }
        // 切换到视频时自动播放当前视频
        playVideoByIndex(e.detail.current);
    };

    const handleImagePreview = (item: any) => {
        const imageUrls = swiperList.filter((i: any) => i.type === "image").map((i: any) => i.image);
        Taro.previewImage({
            urls: imageUrls,
            current: item.image
            // 迁移说明：Taro.previewImage 不支持 uni 的 indicator / loop 参数，H5 与小程序的默认指示器行为一致
        });
    };

    const handleImageClick = (item: any) => {
        // 如果正在滑动，不触发预览
        if (isSwipingRef.current) {
            isSwipingRef.current = false;
            return;
        }
        handleImagePreview(item);
    };

    const onTouchStart = (e: any) => {
        const touch = e.touches[0];
        touchStartXRef.current = touch.clientX;
        isSwipingRef.current = false;
    };


    const getFirstImageSizeDefault = () => {
        const systemInfo = Taro.getSystemInfoSync();
        const width = systemInfo.windowWidth;
        const height = (width * 9) / 16; // 16:9 比例
        setSwiperHeight(height + "px");
    };

    // 获取第一张图片的实际尺寸
    const getFirstImageSize = async () => {
        if (swiperList.length > 0) {
            try {
                // 预取首张媒体（图片/封面），避免轮播先渲染出空白 video 壳
                setMediaReadyBoth(false);
                await getImageInfo(swiperList[0]?.poster || swiperList[0]?.image);
                const res = await Promise.all(
                    swiperList.map(async (item: any) => {
                        return await getImageInfo(item?.poster || item?.image);
                    })
                );
                // 返回 res.height 最大的项
                const maxItem = res.reduce((prev: any, curr: any) => {
                    return prev.height > curr.height ? prev : curr;
                });
                // 根据图片实际尺寸计算高度
                const systemInfo = Taro.getSystemInfoSync();
                const screenWidth = systemInfo.windowWidth;
                const imageHeight = (screenWidth * maxItem.height) / maxItem.width;
                setSwiperHeight(imageHeight > MAX_IMAGE_HEIGHT ? MAX_IMAGE_HEIGHT + "px" : imageHeight + "px");
                setMediaReadyBoth(true);
                // 首屏如果是视频，媒体就绪后自动播放
                playVideoByIndex(current);
            } catch {
                getFirstImageSizeDefault();
                setMediaReadyBoth(true);
                playVideoByIndex(current);
            }
        } else {
            getFirstImageSizeDefault();
            setMediaReadyBoth(true);
            playVideoByIndex(current);
        }
    };

    const getBuyerShowDetail = (id?: string | number) => {
        const target = id ?? buyerShowId;
        setIsLoading(true);
        setMediaReadyBoth(false);
        buyerShowDetail({ buyerShowId: target })
            .then((res: any) => {
                setBuyerShowDetailData(res);
                // 旧版此处手动 resetStyles + fetchStyles；useProductStyle 已按 productList 变化自动拉取
                // 记录进入详情时的点赞状态（只记录一次）
                if (initialIsLikeRef.current === null) {
                    initialIsLikeRef.current = Boolean(res?.isLike);
                }
                pendingMeasureRef.current = true;
                setIsLoading(false);
                setCurrent(0);
                // 尺寸测量在 buyerShowDetailData 渲染后的 effect 中执行（React 状态不同步更新）
            })
            .catch((error: any) => {
                setIsLoading(false);
                Taro.showToast({
                    title: error.message,
                    icon: "error"
                });
            });
    };

    const confirm = async () => {
        if (!content) {
            Taro.showToast({
                title: t("评论不能为空"),
                icon: "none"
            });
            return;
        }
        buyerShowComment({ buyerShowId, content, parentId: replyData?.buyerShowCommentId || 0 })
            .then(() => {
                setContent("");
                Taro.showToast({
                    title: t("评论成功")
                });
                void commentsRef.current?.getList({ buyerShowId } as any);
                setBuyerShowDetailData((prev) => ({ ...prev, commentCount: (prev.commentCount || 0) + 1 }));
                // 清除回复数据
                setReplyData({});
            })
            .catch((error: any) => {
                Taro.showToast({
                    title: error.message,
                    icon: "error"
                });
            });
    };

    // 输入框聚焦
    const inputFocus = () => {
        setIsFocus(true);
    };
    // 输入框失去焦点
    const inputBlur = () => {
        setIsFocus(false);
    };
    // 获取输入表情
    const insertEmoji = (emoji: string) => {
        setIsFocus(true);
        setContent((prev) => prev + emoji);
    };

    /**
     * 买家秀点赞/取消点赞
     * - 记录初始点赞状态，用于判断离开时是否需要刷新列表
     * - 本地乐观更新点赞数和状态
     */
    const likeComment = async () => {
        try {
            // 兜底：如果详情数据还没初始化完，先记录当前状态作为「进入时」状态
            if (initialIsLikeRef.current === null) {
                initialIsLikeRef.current = Boolean(buyerShowDetailData?.isLike);
            }
            await buyerShowLike({
                buyerShowId: buyerShowDetailData.buyerShowId,
                isLike: !buyerShowDetailData.isLike ? 1 : 0
            });
            Taro.showToast({
                title: !buyerShowDetailData.isLike ? t("点赞成功") : t("取消点赞"),
                icon: "none"
            });
            setBuyerShowDetailData((prev) => {
                const isLike = !prev.isLike;
                const currentLikeCount = prev.likeCount || 0;
                return {
                    ...prev,
                    isLike,
                    likeCount: currentLikeCount + (isLike ? 1 : -1)
                };
            });
            hasLikeToggledRef.current = true;

            // getBuyerShowDetail();
        } catch (error: any) {
            Taro.showToast({
                title: error?.message
            });
        }
    };

    // 点击回复
    const showReplyInput = (data: any) => {
        setReplyData(data);
        inputFocus();
        if (process.env.TARO_ENV !== "h5") {
            setTimeout(() => {
                setIsFocus(true);
            }, 100);
        }
    };

    const handleShare = () => {
        if (!ensureShareLogin()) {
            return;
        }
        setShowShare(true);
    };

    const toProductDetail = (item: any) => {
        redirect({
            url: "/pages/product/index",
            param: {
                id: item.productId
            }
        });
    };

    useLoad((options: any) => {
        const id = options?.buyerShowId;
        setBuyerShowId(id);
        // 每次进入详情重置对比基准
        initialIsLikeRef.current = null;
        hasLikeToggledRef.current = false;
        setMediaReadyBoth(false);
        if (id) {
            // 直接以入参 id 请求，避免等待 state 更新
            getBuyerShowDetail(id);
        }
    });

    // 数据更新后测量首屏媒体尺寸（等价旧 getBuyerShowDetail 内的 getFirstImageSize 调用）
    useEffect(() => {
        if (!pendingMeasureRef.current) return;
        pendingMeasureRef.current = false;
        void getFirstImageSize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buyerShowDetailData]);

    useUnload(() => {
        if (autoPlayTimerRef.current) {
            clearTimeout(autoPlayTimerRef.current);
            autoPlayTimerRef.current = null;
        }
        // 仅当用户在详情中确实操作过点赞，且最终状态与进入时不同，返回列表才刷新
        const isLikeDirty = initialIsLikeRef.current !== null && Boolean(detailDataRef.current?.isLike) !== initialIsLikeRef.current;
        if (hasLikeToggledRef.current && isLikeDirty) {
            Taro.setStorageSync(BUYER_SHOW_LIST_NEED_REFRESH_KEY, 1);
        }
    });

    // 页面隐藏时暂停所有视频
    useDidHide(() => {
        if (autoPlayTimerRef.current) {
            clearTimeout(autoPlayTimerRef.current);
            autoPlayTimerRef.current = null;
        }
        pauseAllVideos();
    });

    if (buyerShowEnabled !== 1) {
        return (
            <TigLayout title={t("详情")}>
                <BuyerShowCloseTip buyerShowEnabled={buyerShowEnabled} onBuyerShowEnabledChange={setBuyerShowEnabled} />
            </TigLayout>
        );
    }

    return (
        <TigLayout title={t("详情")}>
            {/* 图片/视频加载前的占位骨架（首张媒体就绪前避免空白 video 壳闪烁） */}
            {(!swiperList.length || isLoading || !mediaReady) && (
                <View className="swiper-skeleton" style={{ height: swiperHeight, minHeight: `${MIN_IMAGE_HEIGHT}px` }}>
                    <View className="skeleton-loading">
                        <View className="skeleton-icon">
                            <Text className="iconfont-h5 icon-tupian" />
                        </View>
                    </View>
                </View>
            )}
            {!isLoading && swiperList.length > 0 && mediaReady && (
                <View className="swiper-wrapper">
                    <Swiper
                        className="swiperBox"
                        style={{ height: swiperHeight, minHeight: `${MIN_IMAGE_HEIGHT}px` }}
                        circular={false}
                        current={current}
                        autoplay={false}
                        duration={300}
                        onChange={onSwiperChange}
                    >
                        {swiperList.map((item: any, index: number) => (
                            // 小程序端：slot 根节点可能拿不到 swiper 内部高度，这里显式给每一项定高兜底
                            <SwiperItem key={index}>
                                <View className="swiper-item-root" style={{ height: swiperHeight, minHeight: `${MIN_IMAGE_HEIGHT}px` }}>
                                    {item.type === "image" ? (
                                        <View className="media-preview-wrapper" onTouchStart={onTouchStart} onClick={() => handleImageClick(item)}>
                                            <TigImage src={item.image} className="media-preview-image" mode="aspectFit" />
                                        </View>
                                    ) : (
                                        <Video
                                            id={`video-${index}`}
                                            className="media-preview-video"
                                            src={current === index ? item.image : ""}
                                            poster={item.poster}
                                            controls
                                            autoplay={false}
                                            muted={false}
                                            showCenterPlayBtn
                                            enableProgressGesture={false}
                                            objectFit="contain"
                                            onPlay={() => onVideoPlay(index)}
                                        />
                                    )}
                                </View>
                            </SwiperItem>
                        ))}
                    </Swiper>
                    {swiperList.length > 1 && (
                        <View className="indicator">
                            {swiperList.map((_item: any, index: number) => (
                                <View key={index} className={`indicator__dot${index === current ? " indicator__dot--active" : ""}`} />
                            ))}
                        </View>
                    )}
                </View>
            )}
            <View className="container">
                <View className="userBox">
                    <View className="photo">
                        <TigImage src={buyerShowDetailData.buyerPhoto || ""} className="content-image" mode="wid" />
                    </View>
                    <View className="userName">{buyerShowDetailData.buyerName || ""}</View>
                </View>
                <View className="content">{buyerShowDetailData.content || ""}</View>
                <View className="addTime">
                    {t("发布于")}
                    {buyerShowDetailData.addTime}
                </View>
                <ScrollView scrollX>
                    <View className="productListBox">
                        {(buyerShowDetailData.productList || []).map((item: any, index: number) => (
                            <View className="productList" key={index} onClick={() => toProductDetail(item)}>
                                <View className="productListInfo">
                                    <View className="productImg">
                                        <Image
                                            src={imageFormat(item.picUrl)}
                                            style={{ width: "200rpx", height: "200rpx" }}
                                            mode="aspectFit"
                                        />
                                        {buyerShowProductStyleMap[item.productId]?.borderImage && (
                                            <Image
                                                className="product-style-border"
                                                src={buyerShowProductStyleMap[item.productId].borderImage}
                                                mode="scaleToFill"
                                            />
                                        )}
                                        {shouldShowSoldOut(item, { stockField: "storeProductStock" }) && (
                                            <View className="outsale">{t("已售罄")}</View>
                                        )}
                                    </View>
                                    <View className="productRight">
                                        <View className="title">{t(item.productName)}</View>
                                        {item.productPrice && <View className="price">¥{item.productPrice}</View>}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
                {/* 旧 up-divider text="" */}
                <View className="divider" />
                <View className="comments">
                    <Comments ref={commentsRef} buyerShowId={buyerShowId ?? ""} onShowReplyInput={showReplyInput} />
                </View>
            </View>
            <FixedPlaceholder height={isFocus ? "200rpx" : "100rpx"} backgroundColor="#fff">
                <View className="footer">
                    <View className="input">
                        <Input
                            className="footer-input-inner"
                            value={content}
                            placeholder={t(configStore.buyerShowGuidanceContent || "说点什么吧~")}
                            placeholderStyle="font-size: 26rpx;"
                            focus={isFocus}
                            cursorSpacing={60}
                            holdKeyboard
                            confirmType="send"
                            onInput={(event) => setContent(event.detail.value)}
                            onFocus={inputFocus}
                            onConfirm={confirm}
                            onBlur={inputBlur}
                        />
                    </View>
                    <View className="countBox">
                        <View className="LikeBox" onClick={() => void likeComment()}>
                            <View className={`iconfont-h5 ${buyerShowDetailData.isLike ? "icon-yiguanzhu" : "icon-guanzhu"}`} />
                            <View className={`likes${buyerShowDetailData.isLike ? " liked" : ""}`}>
                                {Number(buyerShowDetailData.likeCount) > 0 ? buyerShowDetailData.likeCount : 0}
                            </View>
                        </View>
                        <View className="LikeBox">
                            <View className="iconfont-h5 icon-pinglun" />
                            <View className="numberOfMessages">{buyerShowDetailData.commentCount || 0}</View>
                        </View>
                        <View className="LikeBox shareBox" onClick={handleShare}>
                            <View className="iconfont-h5 icon-af" />
                        </View>
                    </View>
                </View>
                {isFocus && <EmojiPicker onInsertEmoji={insertEmoji} />}
            </FixedPlaceholder>
            <BuyerShowShare
                modelValue={showShare}
                buyerShowId={buyerShowId ?? ""}
                content={buyerShowDetailData.content}
                buyerName={buyerShowDetailData.buyerName}
                buyerPhoto={buyerShowDetailData.buyerPhoto}
                cover={shareCover}
                onModelValueChange={setShowShare}
            />
            <TigLoadingPage modelValue={isLoading} />
        </TigLayout>
    );
}
