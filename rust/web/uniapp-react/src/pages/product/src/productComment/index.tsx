import { useEffect, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";

import { imageFormat } from "@/utils/format";
import { getComment, getCommentList, getProductConsultationList } from "@/api/product/product";
import type { CommentDetail, CommentItem, ProductConsultationItem } from "@/types/product/product";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productId: number;
    shopId?: number;
}

/**
 * 商品评论/咨询Tab组件（自旧 pages/product/src/productComment.vue 移植）
 * - Tab切换展示评论和咨询
 * - 评论显示用户头像、内容、图片、星级
 * - 咨询显示问答内容
 * - 旧 uni-rate → NutUI Rate 只读态（自定义 icon 保持原颜色）
 */
export default function ProductComment({ productId, shopId }: Props) {
    const [loading, setLoading] = useState(false);
    const [comment, setComment] = useState<CommentDetail>({});
    const [commentList, setCommentList] = useState<CommentItem[]>([]);
    const [page, setPage] = useState<number>(1);
    const [size] = useState<number>(10);

    const toComment = () => {
        if (comment.total && comment.total > 0) {
            Taro.navigateTo({
                url: `/pages/product/comment?id=${productId}`
            });
        }
    };
    const toPage = (url: string) => {
        Taro.navigateTo({
            url: url
        });
    };
    const toConsultation = () => {
        if (productId <= 0 || shopId === undefined) return;
        toPage(`/pages/product/consult?id=${productId}&shopId=${shopId}`);
    };
    const imagePreview = (url: string) => {
        Taro.previewImage({
            urls: [url]
        });
    };
    const _getComment = async (id: any) => {
        setLoading(true);
        try {
            const result = await getComment(id);
            setComment(result);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };
    const _getCommentList = async (id: any) => {
        setLoading(true);
        try {
            const result = await getCommentList(id, {
                type: 1,
                page: page
            });
            setCommentList(result.records);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            setLoading(false);
        }
    };
    const [consultationList] = useState<ProductConsultationItem[]>([]);
    const [consultationTotal, setConsultationTotal] = useState(0);
    const fetchConsultation = async (productId: number, shopId: number) => {
        try {
            const result = await getProductConsultationList({ productId, shopId, page: page, size: size });
            setConsultationTotal(result.total);
        } catch (error: any) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    // 旧 onLoad((option) => { ... })：从页面路由参数取 id 后拉取评论（useLoad 在组件内注册页面 onLoad）
    useLoad((option: Record<string, any> | undefined) => {
        if (option) {
            const { id } = option;
            if (id) {
                void _getComment(id);
                void _getCommentList(id);
            }
        }
    });

    // 旧 watch([productId, shopId], ..., { immediate: true })
    useEffect(() => {
        if (productId > 0 && shopId !== undefined) {
            void fetchConsultation(productId, shopId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, shopId]);

    /* 原 uni-rate（readonly）→ NutUI Rate 只读态（value=commentRank、size 14px、灰色未选中/橙色选中） */
    const renderRate = (value: number) => (
        <Text
            className="uni-rate-inline"
            style={{ fontSize: "14px", lineHeight: 1, color: "#bfbfbf" }}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ color: star <= Math.round(value) ? "#ffa800" : "#bfbfbf" }}>
                    ★
                </Text>
            ))}
        </Text>
    );

    return (
        <View className="product-comment-card" onClick={toComment}>
            <View className="comment-title flex justify-between align-center">
                <View className="txt">
                    {t("评价")}
                    <Text>({comment.total ?? 0})</Text>
                </View>
                <View
                    className="more"
                    onClick={(e) => {
                        e.stopPropagation();
                        toPage(`/pages/product/comment?id=${productId}`);
                    }}
                >
                    {t("好评")}
                    <Text>{comment.goodPercent ?? 0}%</Text>
                    <View className="more-arrows">
                        <Text className="iconfont-h5 icon-gengduo1" style={{ fontSize: "12px", color: "#bfbfbf" }} />
                    </View>
                </View>
            </View>
            {commentList.length > 0 ? (
                <>
                    {commentList.slice(0, 2).map((item, index) => (
                        <View key={index} className="comment-item">
                            <View className="user-info flex justify-between align-center">
                                <View className="user-name flex align-center">
                                    <View className="head_logo">
                                        <Image className="head-logo-img" src={imageFormat(item?.avatar || "")} mode="aspectFill" />
                                    </View>
                                    <View>
                                        <Text>{item.username}</Text>
                                        {renderRate(item.commentRank)}
                                    </View>
                                </View>
                                <View className="time">{item.addTime}</View>
                            </View>
                            <View className="user-content">{item.content}</View>
                            <View className="user-imgs flex-wrap align-center">
                                {item.showPics?.map((pic, index) => (
                                    <Image
                                        key={index}
                                        className="user-imgs-img"
                                        src={imageFormat(pic.picThumb)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            imagePreview(imageFormat(pic?.picUrl || ""));
                                        }}
                                    />
                                ))}
                            </View>
                        </View>
                    ))}
                </>
            ) : (
                <>
                    <View className="no-data"> {t("暂无评价")}~ </View>
                </>
            )}

            <View className="comment-btn-box flex align-center justify-around">
                <View
                    className="btn flex align-center"
                    onClick={(e) => {
                        e.stopPropagation();
                        toPage(`/pages/product/comment?id=${productId}`);
                    }}
                >
                    <Text className="iconfont-h5 icon-chat" style={{ fontSize: "36rpx", height: "26rpx", color: "#333" }} />
                    <Text>
                        {t("全部评价")}({comment.total ?? 0})
                    </Text>
                </View>
                <View
                    className="btn flex align-center"
                    onClick={(e) => {
                        e.stopPropagation();
                        toConsultation();
                    }}
                >
                    <Text className="iconfont-h5 icon-chatboxes" style={{ fontSize: "36rpx", height: "26rpx", color: "#333" }} />
                    <Text>
                        {t("购买咨询")}({consultationTotal ?? 0})
                    </Text>
                </View>
            </View>
        </View>
    );
}
