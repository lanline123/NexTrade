import { useMemo } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatFrame } from "@/components/modules";
import { imageFormat, pickPic } from "@/utils/format";
import type { ModuleFrameType } from "@/types/decorate/decorate.d";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

interface LiveProductItem {
    coverImg?: string;
    picThumb?: string;
    picUrl?: string;
    productThumb?: string;
    productImage?: string;
    image?: string;
}

interface LiveRoomState {
    wechatLiveId?: number;
    roomId?: number | string;
    roomIdStr?: string;
    name?: string;
    wechatLiveTitle?: string;
    coverImg?: string;
    feedsImg?: string;
    shareImg?: string;
    thumbImg?: string;
    liveCardCover?: string;
    backgroundWall?: string;
    anchorName?: string;
    anchorOpenid?: string;
    anchorWechat?: string;
    liveStatus?: number | string;
    liveStatusText?: string;
    productData?: LiveProductItem[];
}

interface LiveDecorateModule {
    titleText?: string;
    displayMode?: "list" | "bigImage";
    sourceType?: "auto" | "manual";
    autoLiveNum?: number;
    selectedLiveList?: LiveRoomState[];
    frame?: ModuleFrameType;
}

const defaultFrame: ModuleFrameType = {
    backgroundColor: "#ffffff",
    innerPadding: 12,
    boxRadius: 8,
    boxPadding: 10,
    boxPaddingTop: 5,
    boxPaddingBottom: 5
};

export default function Live({ module }: Props) {
    const liveModule = module as LiveDecorateModule;

    // 旧 setup 时构建一次（liveStatusTextMap 内含 t() 调用）
    const liveStatusTextMap: Record<number, string> = {
        101: "直播中",
        102: t("未开始"),
        103: t("已结束"),
        104: t("禁播"),
        105: t("暂停"),
        106: t("异常"),
        107: t("已过期")
    };

    const frameFormat = useMemo(() => formatFrame(liveModule.frame ?? defaultFrame), [liveModule.frame]);
    const cardRadiusStyle = useMemo(
        () => `border-radius:${designPxToRpx(Number(liveModule.frame?.boxRadius ?? defaultFrame.boxRadius))};`,
        [liveModule.frame]
    );
    const cardStyle = useMemo(() => {
        const backgroundColor = liveModule.frame?.backgroundColor || defaultFrame.backgroundColor;
        return `${cardRadiusStyle}background-color:${backgroundColor};`;
    }, [cardRadiusStyle, liveModule.frame]);
    const isBigImageMode = useMemo(() => (liveModule.displayMode || "list") === "bigImage", [liveModule.displayMode]);

    const getLiveTitle = (item: LiveRoomState) => item.name || item.wechatLiveTitle;
    const getAnchorName = (item: LiveRoomState) => item.anchorName || item.anchorOpenid || item.anchorWechat;
    const getLiveStatusText = (item: LiveRoomState) => item.liveStatusText || liveStatusTextMap[Number(item.liveStatus)];

    const getLiveStatusClass = (item: LiveRoomState) => {
        const status = Number(item.liveStatus);
        if (status === 101) return "live-card__status-tag--live";
        if (status === 102) return "live-card__status-tag--pending";
        return "live-card__status-tag--ended";
    };

    const normalizeLiveItem = (item: LiveRoomState): LiveRoomState => ({
        ...item,
        roomId: Number(item.roomId || 0),
        roomIdStr: String(item.roomIdStr || item.roomId || ""),
        name: getLiveTitle(item),
        anchorName: getAnchorName(item),
        coverImg: item.coverImg || item.thumbImg || item.shareImg || item.feedsImg || item.liveCardCover || item.backgroundWall || "",
        liveStatusText: getLiveStatusText(item)
    });

    const liveList = useMemo(() => {
        const selectedLiveList = liveModule.selectedLiveList || [];
        return selectedLiveList.map(normalizeLiveItem).slice(0, 10);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveModule.selectedLiveList]);

    const getCover = (item: LiveRoomState) => {
        return imageFormat(item.feedsImg || "");
    };

    const getLiveGoodsImages = (item: LiveRoomState) => {
        return (item.productData || [])
            .map((goods) => imageFormat(goods.coverImg || pickPic(goods) || goods.productThumb || goods.productImage || goods.image || ""))
            .filter((img): img is string => Boolean(img))
            .slice(0, 3);
    };

    const handleOpenLive = (item: LiveRoomState) => {
        const roomId = Number(item.roomId || 0);
        if (!roomId) {
            Taro.showToast({
                title: t("直播间信息不完整"),
                icon: "none"
            });
            return;
        }

        // 旧 wx.navigateTo（直播小插件 live-player-plugin）→ Taro.navigateTo，仅微信小程序端可用
        Taro.navigateTo({
            url: `plugin-private://wx2b03c6e691cd7370/pages/live-player-plugin?room_id=${roomId}`,
            fail: (error: any) => {
                Taro.showToast({
                    title: error?.errMsg || t("打开直播间失败"),
                    icon: "none"
                });
            }
        });
    };

    // 旧工程本模块整体包在 #ifdef MP-WEIXIN 条件编译中（小程序直播插件为微信专属），非 weapp 端不渲染
    if (process.env.TARO_ENV !== "weapp") {
        return null;
    }

    // TODO(MIGRATION)：旧 Vue defineOptions({ options: { virtualHost: true } })，Taro React 侧如需去除自定义组件宿主节点，需在编译配置/页面配置中开启 virtualHost
    return (
        <View
            className="module-ad-con module-live"
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + frameFormat.boxRadius}>
                <View className="live-container" style={frameFormat.innerPadding}>
                    {liveList.length > 0 ? (
                        isBigImageMode ? (
                            <View className="live-list live-list--bigImage">
                                {liveList.map((item) => (
                                    <View
                                        key={item.wechatLiveId || item.roomId}
                                        className="live-card live-card--bigImage"
                                        style={cardStyle}
                                        onClick={() => handleOpenLive(item)}
                                    >
                                        <View
                                            className="live-card__cover live-card__cover--full"
                                            style={cardRadiusStyle + (getCover(item) ? "background:none;" : "")}
                                        >
                                            {getCover(item) ? (
                                                <Image className="live-card__cover-image" src={getCover(item)} mode="aspectFill" />
                                            ) : (
                                                <View className="live-card__cover-placeholder">
                                                    <Text className="live-card__cover-placeholder-text">{t("直播预告")}</Text>
                                                </View>
                                            )}
                                            <View className={"live-card__status-tag " + getLiveStatusClass(item)}>
                                                {t(getLiveStatusText(item) || t("直播中"))}
                                            </View>
                                            <View className="live-card__mask">
                                                <View className="live-card__mask-title">{t(item.name || item.wechatLiveTitle || "")}</View>
                                                <View className="live-card__mask-meta">
                                                    <Text>
                                                        {t("主播")}：{item.anchorName || item.anchorOpenid}
                                                    </Text>
                                                    <View className="live-card__action">{t("进入直播间")}</View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View className="live-list live-list--list">
                                {liveList.map((item) => (
                                    <View
                                        key={item.wechatLiveId || item.roomId}
                                        className="live-card live-card--list"
                                        style={cardStyle}
                                        onClick={() => handleOpenLive(item)}
                                    >
                                        <View
                                            className="live-card__cover live-card__cover--list"
                                            style={cardRadiusStyle + (getCover(item) ? "background:none;" : "")}
                                        >
                                            {getCover(item) ? (
                                                <Image className="live-card__cover-image" src={getCover(item)} mode="aspectFill" />
                                            ) : (
                                                <View className="live-card__cover-placeholder">
                                                    <Text className="live-card__cover-placeholder-text">{t("直播预告")}</Text>
                                                </View>
                                            )}
                                            <View className="live-card__badge">{t("小程序直播")}</View>
                                            <View className="live-card__status">{t(item.liveStatusText || "直播中")}</View>
                                        </View>

                                        <View className="live-card__content">
                                            <View className="live-card__title">{t(item.name || item.wechatLiveTitle || "")}</View>
                                            <View className="live-card__goods">
                                                {getLiveGoodsImages(item).length > 0 &&
                                                    getLiveGoodsImages(item).map((goodsImg, goodsIndex) => (
                                                        <Image
                                                            key={`${item.roomId}-${goodsIndex}`}
                                                            className="live-card__goods-item"
                                                            src={goodsImg}
                                                            mode="aspectFill"
                                                        />
                                                    ))}
                                            </View>
                                            <View className="live-card__footer">
                                                <View className="live-card__meta">
                                                    {t("主播")}：{t(item.anchorName || item.anchorOpenid || "官方直播间")}
                                                </View>
                                                <View className="live-card__action">{t("进入直播间")}</View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )
                    ) : (
                        <View className="live-empty" style={cardRadiusStyle}>
                            <View className="live-empty__title">{t("暂无可展示直播间")}</View>
                            <View className="live-empty__desc">{t("请在后台先配置小程序直播内容")}</View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
