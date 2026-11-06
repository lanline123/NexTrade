import { useReducer, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigLazyImage from "@/components/tig/tig-lazy-image/TigLazyImage";
import { buyerShowLike } from "@/api/buyerShow/buyerShow";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./BuyerShowItem.scss";

interface Props {
    buyerShowItem: any;
    buyerShowIndex: number;
    /** 旧 v-model:buyer-show-list-data：列表数据（点赞后原地改写） */
    buyerShowListData: any[];
}

/**
 * 买家秀列表项组件（自旧 src/buyerShowItem.vue 移植）
 * - 展示买家秀缩略图和基本信息
 * - 支持点赞交互
 *
 * 说明：旧实现直接改写 buyerShowListData[index] 字段（Vue 深层响应式）；
 * React 下数据由页面共享，这里改写后用本地 reducer 刷新本卡片。
 */
export default function BuyerShowItem({ buyerShowItem, buyerShowIndex, buyerShowListData }: Props) {
    const [, forceRender] = useReducer((x: number) => x + 1, 0);
    const [playImg] = useState(() => `url("${staticResource("product/video-playing.png")}")`);

    const getImg = (item: any) => {
        const list = [...(item.videoList || []), ...(item.imgList || [])].filter(Boolean);
        return list[0]?.videoCover || list[0]?.picUrl;
    };

    const likeComment = async (item: any, index: number) => {
        // 处理评论点赞
        try {
            await buyerShowLike({
                buyerShowId: item.buyerShowId,
                isLike: !item.isLike ? 1 : 0
            });
            Taro.showToast({
                title: !item.isLike ? t("点赞成功") : t("取消点赞"),
                icon: "none"
            });
            buyerShowListData[index].isLike = !item.isLike;
            buyerShowListData[index].likeCount = !item.isLike ? item.likeCount - 1 : item.likeCount + 1;
            forceRender();
        } catch (error: any) {
            Taro.showToast({
                title: error?.message
            });
        }
    };

    const img = getImg(buyerShowItem);

    return (
        // 旧样式以 .buyerShow-item 作为视频角标的定位父级，这里补挂该类名保证命中原样式
        <View className="buyerShow-buyerShowItem buyerShow-item">
            <View
                className={buyerShowItem.videoList && buyerShowItem.videoList.length > 0 ? "video-icon" : ""}
                style={{ backgroundImage: playImg }}
            />
            {/* 迁移修正：旧模板 v-if 无 else，避免空 src 的懒加载图占位 */}
            {img ? <TigLazyImage src={img} mode="widthFix" /> : null}
            <View className="buyerShow-info">
                <View className="content">{buyerShowItem.content}</View>
                <View className="buyerUser">
                    <View className="imgBox">
                        <View className="user-image">
                            <TigLazyImage src={buyerShowItem.buyerPhoto} mode="aspectFill" />
                        </View>
                        <Text className="userName">{buyerShowItem.buyerName}</Text>
                    </View>
                    <View className="likeBox">
                        <View className="action-buyerShowItem" onClick={() => likeComment(buyerShowItem, buyerShowIndex)}>
                            <Text className={`iconfont-h5 ${buyerShowItem.isLike ? "icon-yiguanzhu" : "icon-guanzhu"}`} />
                            <Text className={`like-count${buyerShowItem.isLike ? " liked" : ""}`}>
                                {(buyerShowItem.likeCount || 0) > 0 ? buyerShowItem.likeCount : ""}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}