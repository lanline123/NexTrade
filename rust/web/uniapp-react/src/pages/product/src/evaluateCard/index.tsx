import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import CommentItem from "../commentItem";
import { getComment, getCommentList } from "@/api/product/product";
import type { CommentDetail, CommentItem as CommentItemType } from "@/types/product/product";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productId: number;
    overseas?: boolean;
}

/**
 * 评价卡（自旧 pages/product/src/evaluateCard.vue 移植）
 * - 评分星级 + 好评率 + 最新两条评价
 * - 旧 uni-rate → 星形字符只读渲染（保持原颜色 #e0e1e5 / #ffb21c）
 * - 原 :deep(.comment-con .con-text) 选择器去 deep 平铺
 */
export default function EvaluateCard({ productId, overseas = false }: Props) {
    const [commentInfo, setCommentInfo] = useState<CommentDetail>({ total: 0 });
    const [commentList, setCommentList] = useState<CommentItemType[]>([]);

    const hasComment = Number(commentInfo.total) > 0;
    const score = useMemo(() => {
        const value = Math.max(0, Math.min(100, Number(commentInfo.goodPercent) || 0)) / 20;
        return Number(value.toFixed(1));
    }, [commentInfo.goodPercent]);

    const fetchComment = async () => {
        try {
            const result = await getComment(productId);
            setCommentInfo(result);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCommentList = async () => {
        try {
            const result = await getCommentList(productId, { type: 1, page: 1 });
            setCommentList(result.records.slice(0, 2));
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 watchEffect(() => { if (props.productId) { fetchComment(); fetchCommentList(); } })
    useEffect(() => {
        if (productId) {
            void fetchComment();
            void fetchCommentList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    const handleToComment = (isHasComment: boolean) => {
        if (isHasComment) {
            Taro.navigateTo({ url: `/pages/product/comment?id=${productId}` });
        }
    };

    /* 原 <uni-rate :readonly="true" :value="score" size="16" color="#e0e1e5" active-color="#ffb21c" /> → 星形字符只读渲染 */
    const renderRate = (value: number) => (
        <View className="uni-rate-inline" style={{ fontSize: "16px", lineHeight: 1, color: "#e0e1e5" }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} style={{ color: star <= Math.round(value) ? "#ffb21c" : "#e0e1e5" }}>
                    ★
                </Text>
            ))}
        </View>
    );

    return (
        <View className={`evaluate-card-box ${overseas ? "evaluate-card-box--overseas" : ""}`} onClick={() => handleToComment(hasComment)}>
            <View className="evaluate-card">
                <View className={`evaluate-card-header ${!hasComment ? "empty" : ""}`}>
                    <View className="evaluate-title">
                        <View className="title-left">
                            <View className="title-text">{t("评价")}</View>
                            <View className="title-desc">
                                <Image className="title-desc-img" src={staticResource("common/safety.png")} />
                                <Text className="title-desc-text line1">{t("真实用户评价")}</Text>
                            </View>
                        </View>
                        <View
                            className="evaluate-title-right"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToComment(hasComment);
                            }}
                        >
                            <Text className="title-right-text">{t(hasComment ? "全部" : "暂时无评论")}</Text>
                            {hasComment ? <Text className="iconfont-h5 icon-a-gengduo20" /> : null}
                        </View>
                    </View>
                    {hasComment ? (
                        <View className="evaluate-score-box">
                            <View className="evaluate-score">
                                {renderRate(score)}
                                <View className="score-num">{score}</View>
                                <View className="comment-total">({Number(commentInfo.total) || 0} {t("条评价")})</View>
                            </View>
                        </View>
                    ) : null}
                </View>
                {hasComment && commentList.length > 0 ? (
                    <View className="evaluate-items">
                        {commentList.map((item, index) => (
                            <CommentItem key={index} className="evaluate-item" item={item} />
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}
