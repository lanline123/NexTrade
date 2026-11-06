import { useEffect, useMemo, useState } from "react";
import { ChannelLive, ChannelVideo, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatFrame } from "@/components/modules";
import { imageFormat, pickPic } from "@/utils/format";
import { getConversation } from "@/api/videoNumber/videoNumber";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

interface ProductImageItem {
    picThumb?: string;
    picUrl?: string;
}

interface VideoNumberModule {
    contentType?: "video" | "live";
    videoNumberId?: string;
    videoId?: string;
    liveTitle?: string;
    titleColorType?: "default" | "theme" | "custom";
    titleColor?: string;
    productImages?: ProductImageItem[];
    frame?: {
        backgroundColor?: string;
        innerPadding?: number;
        boxRadius?: number;
        boxPadding?: number;
        boxPaddingTop?: number;
        boxPaddingBottom?: number;
    };
}

export default function VideoNumber({ module }: Props) {
    const videoNumberModule = module as VideoNumberModule;

    const frameFormat = useMemo(() => {
        return formatFrame(
            videoNumberModule.frame ?? {
                backgroundColor: "#ffffff",
                innerPadding: 12,
                boxRadius: 8,
                boxPadding: 10,
                boxPaddingTop: 5,
                boxPaddingBottom: 5
            }
        );
    }, [videoNumberModule.frame]);

    const [coverName, setCoverName] = useState("");
    const [liveDescription, setLiveDescription] = useState("");

    const finderUserName = useMemo(() => videoNumberModule.videoNumberId?.trim() || "", [videoNumberModule.videoNumberId]);
    const videoFeedId = useMemo(() => videoNumberModule.videoId?.trim() || "", [videoNumberModule.videoId]);
    const isVideoType = useMemo(() => videoNumberModule.contentType !== "live", [videoNumberModule.contentType]);
    const hasVideoInfo = useMemo(() => Boolean(finderUserName && videoFeedId), [finderUserName, videoFeedId]);
    const liveTitle = useMemo(() => videoNumberModule.liveTitle?.trim() || t("这场直播特别有料"), [videoNumberModule.liveTitle]);

    const liveTitleColor = useMemo(() => {
        if (videoNumberModule.titleColorType === "theme") {
            return "var(--general)";
        }
        if (videoNumberModule.titleColorType === "custom" && videoNumberModule.titleColor) {
            return videoNumberModule.titleColor;
        }
        return "#2A2A2A";
    }, [videoNumberModule.titleColorType, videoNumberModule.titleColor]);

    const productImageList = useMemo(() => {
        return (videoNumberModule.productImages || [])
            .map((item) => pickPic(item))
            .filter((item) => Boolean(item))
            .slice(0, 3)
            .map((item) => imageFormat(item));
    }, [videoNumberModule.productImages]);

    const handleBinderror = (e: any) => {
        console.log(e, "视频号报错");
    };

    const cardRadiusStyle = useMemo(() => {
        return `border-radius:${designPxToRpx(Number(videoNumberModule.frame?.boxRadius || 0))};`;
    }, [videoNumberModule.frame]);

    const handleOpenLive = () => {
        if (!finderUserName) {
            Taro.showToast({
                title: "请先配置视频号ID",
                icon: "none"
            });
            return;
        }
        // 旧 wx.openChannelsLive → Taro.openChannelsLive（仅微信小程序端可用）
        Taro.openChannelsLive({
            finderUserName: finderUserName,
            fail: (error: any) => {
                Taro.showToast({
                    title: error?.errMsg || "打开视频号直播失败",
                    icon: "none"
                });
            }
        });
    };

    // 通过视频号id获取直播记录
    const fetchLiveRecord = async (id: string) => {
        if (!id) return;
        try {
            const res = await getConversation(id);
            setCoverName(res?.nickname || "");
            setLiveDescription(res?.description || "");
        } catch (e) {
            console.error("获取直播记录失败", e);
        }
    };

    // 对应旧 watch(() => props.module.videoNumberId, { immediate: true })
    useEffect(() => {
        if (videoNumberModule.videoNumberId) fetchLiveRecord(videoNumberModule.videoNumberId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoNumberModule.videoNumberId]);

    // 旧工程本模块整体包在 #ifdef MP-WEIXIN 条件编译中（channel-video/channel-live/wx API 均为微信专属），非 weapp 端不渲染
    if (process.env.TARO_ENV !== "weapp") {
        return null;
    }

    // TODO(MIGRATION)：旧 Vue defineOptions({ options: { virtualHost: true } })，Taro React 侧如需去除自定义组件宿主节点，需在编译配置/页面配置中开启 virtualHost
    return (
        <View
            className="module-ad-con module-video-number"
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + frameFormat.boxRadius}>
                <View className="video-number-container" style={frameFormat.innerPadding}>
                    {isVideoType ? (
                        <View className="video-card video-card--video" style={cardRadiusStyle}>
                            {hasVideoInfo ? (
                                <ChannelVideo
                                    className="channel-video"
                                    style={cardRadiusStyle}
                                    finderUserName={finderUserName}
                                    feedId={videoFeedId}
                                    objectFit="cover"
                                    autoplay={false}
                                    loop={false}
                                    muted={false}
                                    onError={handleBinderror}
                                />
                            ) : (
                                <View className="video-placeholder" style={cardRadiusStyle}>
                                    <View className="video-placeholder__tag">{t("视频号")}</View>
                                    <View className="video-placeholder__title">请在后台配置视频号视频</View>
                                    <View className="video-placeholder__desc">需填写视频号ID与视频ID</View>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View className="video-card video-card--live" style={cardRadiusStyle} onClick={handleOpenLive}>
                            <View className="live-cover" style={cardRadiusStyle}>
                                <ChannelLive
                                    style={cardRadiusStyle}
                                    finderUserName={finderUserName}
                                    feedId={videoFeedId}
                                />
                            </View>

                            <View className="live-content">
                                <View className="live-title line2" style={{ color: liveTitleColor }}>
                                    {liveTitle}
                                </View>

                                <View className="product-list">
                                    {productImageList.length > 0 ? (
                                        productImageList.map((item, productIndex) => (
                                            <Image key={`${item}-${productIndex}`} className="product-item" src={item} mode="aspectFill" />
                                        ))
                                    ) : (
                                        [1, 2, 3].map((item) => <View key={item} className="product-item product-item--placeholder" />)
                                    )}
                                </View>

                                <View className="live-footer">
                                    <View className="live-author line1">{liveDescription || ""}</View>
                                    <View className="live-button">{t("去观看")}</View>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
