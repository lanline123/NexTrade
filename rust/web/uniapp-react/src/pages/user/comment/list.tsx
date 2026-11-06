import { useEffect, useRef, useState } from "react";
import { Image, Navigator, Text, View } from "@tarojs/components";
import Taro, { useReachBottom, useRouter, useUnload } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import LoadingBox from "@/components/loading-box";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getCommentList, getCommentSubNum, getShowedList } from "@/api/user/comment";
import { getOrderList } from "@/api/user/order";
import type { CommentFilterParams, CommentFilterState } from "@/types/user/comment";
import { useConfigStore } from "@/store/config";
import { getSkuText, hasSkuText, redirect, staticResource } from "@/utils";
import { imageFormat, pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import Rate from "./src/Rate";

import "./list.scss";

interface MenuType {
    type: number;
    value: string;
    num: number;
}

/**
 * 评价管理列表页（自旧 pages/user/comment/list.vue 逐行移植）
 * - 三个Tab切换：待评价/待晒单/已评价
 * - 待评价：已完成订单未评价的商品
 * - 待晒单：已评价但未上传图片的订单
 * - 已评价：展示已发表的评价和商家回复
 */
export default function CommentList() {
    usePageGuards();

    const router = useRouter();
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);
    const commentEnabled = productCommentEnabled === 1;

    const [menuList, setMenuList] = useState<MenuType[]>([
        { type: 0, value: t("待评价"), num: 0 },
        { type: 1, value: t("待晒单"), num: 0 },
        { type: 2, value: t("已评价"), num: 0 }
    ]);

    const [currentType, setCurrentType] = useState<number>(0);
    const [loaded, setLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [filterState, setFilterState] = useState<CommentFilterState[]>([]);
    const [total, setTotal] = useState(0);

    const filterParamsRef = useRef<CommentFilterParams>({ page: 1, size: 10 });
    const filterStateRef = useRef<CommentFilterState[]>([]);
    filterStateRef.current = filterState;
    const totalRef = useRef(0);
    const currentTypeRef = useRef(0);
    currentTypeRef.current = currentType;

    const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
    const [overflowReplies, setOverflowReplies] = useState<Set<number>>(new Set());
    const overflowRepliesRef = useRef<Set<number>>(new Set());
    overflowRepliesRef.current = overflowReplies;

    const imagePreview = (url: string) => {
        Taro.previewImage({
            urls: [url]
        });
    };

    const getSubNum = async () => {
        try {
            const result: any = await getCommentSubNum();
            setMenuList((prev) => {
                const next = prev.map((item) => ({ ...item }));
                // 旧实现写入 size 字段（模板读取 num），逐行保留原行为
                // TODO(MIGRATION)：待产品确认后改为 num，恢复待评价/待晒单/已评价角标
                (next[0] as any).size = result.awaitComment;
                (next[1] as any).size = result.showPics;
                (next[2] as any).size = result.commented;
                return next;
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const toggleReplies = (commentId: number) => {
        const next = new Set(expandedReplies);
        if (next.has(commentId)) {
            next.delete(commentId);
        } else {
            next.add(commentId);
        }
        setExpandedReplies(next);
    };

    const checkReplyOverflow = () => {
        setTimeout(() => {
            const items = filterStateRef.current.filter((item) => item.replies?.length && item.commentId);
            if (items.length === 0) return;
            const newSet = new Set<number>(overflowRepliesRef.current);
            let count = 0;
            items.forEach((item) => {
                const id = item.commentId!;
                const query = Taro.createSelectorQuery();
                query.select(`#reply-m-${id}`).boundingClientRect();
                query.select(`#reply-b-${id}`).boundingClientRect();
                query.exec((res: any[]) => {
                    const measureRect = res[0];
                    const bodyRect = res[1];
                    if (measureRect && bodyRect && measureRect.height > bodyRect.height + 1) {
                        newSet.add(id);
                    }
                    count++;
                    if (count === items.length) {
                        setOverflowReplies(newSet);
                    }
                });
            });
        }, 200);
    };

    const handleToDetail = (id: number) => {
        redirect({
            url: `/pages/product/index?id=${id}`
        });
    };

    const handleMenuType = (type: number) => {
        console.log("type", type);
        setCurrentType(type);
        currentTypeRef.current = type;
        filterStateRef.current = [];
        setFilterState([]);
        filterParamsRef.current.page = 1;
        void loadFilter(type);
    };

    /**
     * 加载列表数据
     * - type=0 调用订单接口获取待评价订单
     * - type=1 调用晒单接口获取待晒单订单
     * - type=2 调用评论接口获取已评价记录
     */
    const loadFilter = async (type: number = currentTypeRef.current) => {
        if (filterParamsRef.current.page > 1) {
            setLoaded(true);
        } else {
            setIsLoading(true);
            Taro.showLoading({
                title: t("加载中")
            });
        }
        try {
            let result: any = [];
            // 三种类型对应不同的接口
            if (type === 0) {
                result = await getOrderList({ ...filterParamsRef.current, commentStatus: 0 });
            }
            if (type === 1) {
                result = await getShowedList({ ...filterParamsRef.current });
            }
            if (type === 2) {
                result = await getCommentList({ ...filterParamsRef.current });
            }
            const next = [...filterStateRef.current, ...(result.records || [])];
            filterStateRef.current = next;
            setFilterState(next);
            setTotal(result.total ?? 0);
            totalRef.current = result.total ?? 0;
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        } finally {
            Taro.hideLoading();
            setIsLoading(false);
            setLoaded(false);
            if (type === 2) {
                checkReplyOverflow();
            }
        }
    };

    const handleEvaluate = (id: number) => {
        Taro.navigateTo({
            url: `/pages/user/comment/info?id=${id}`
        });
    };

    const handleBack = () => {
        redirect({
            url: "/pages/member/index"
        });
    };

    useEffect(() => {
        let active = true;
        (async () => {
            // 读取初始化后的配置后再请求评价数据
            await useConfigStore.getState().whenConfigReady();
            if (!active) return;
            if (useConfigStore.getState().productCommentEnabled !== 1) {
                setIsLoading(false);
                return;
            }
            const currentTypeParam = router.params?.currentType;
            if (currentTypeParam) {
                const nextType = Number(currentTypeParam);
                setCurrentType(nextType);
                currentTypeRef.current = nextType;
            }
            Taro.eventCenter.on("commentFinished", (data: any) => {
                if (data) {
                    setCurrentType(2);
                    currentTypeRef.current = 2;
                    filterStateRef.current = [];
                    setFilterState([]);
                    filterParamsRef.current.page = 1;
                    void loadFilter(2);
                }
            });
            void getSubNum();
            void loadFilter(currentTypeParam ? Number(currentTypeParam) : 0);
        })();
        return () => {
            active = false;
        };
        // 仅挂载执行一次（对应旧 onLoad）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useReachBottom(() => {
        if (filterParamsRef.current.page < Math.ceil(totalRef.current / filterParamsRef.current.size)) {
            filterParamsRef.current.page++;
            void loadFilter(currentTypeRef.current);
        }
    });

    // 关闭预览图片
    useUnload(() => {
        // #ifdef H5 || APP
        if (process.env.TARO_ENV === "h5") {
            // TODO(MIGRATION)：Taro 未提供 closePreviewImage 类型，按旧 H5/APP 条件编译保留可选调用
            (Taro as any).closePreviewImage?.();
        }
        // #endif
        // 页面卸载时移除监听器
        Taro.eventCenter.off("commentFinished");
    });

    return (
        <TigLayout title={t("订单评价")} customBack onBack={handleBack}>
            {commentEnabled ? (
                <View className="order">
                    <View className="order-menu">
                        {menuList.map((item) => (
                            <View
                                key={item.type}
                                className={`order-menu-item${currentType === item.type ? " active" : ""}`}
                                onClick={() => handleMenuType(item.type)}
                            >
                                {item.num > 0 ? (
                                    <View className="badgecolor">
                                        <View className="uni-badge--error uni-badge">
                                            <Text className="uni-badge-text">{item.num}</Text>
                                        </View>
                                        <Text className="order-menu-item-text">{item.value}</Text>
                                    </View>
                                ) : (
                                    <Text className="order-menu-item-text">{item.value}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                    <View className="placeholder" />
                    {currentType < 2 ? (
                        <View className="order-list">
                            {filterState.map((item) => (
                                <View className="order-list-item" key={item.orderId}>
                                    <View className="order-list-item-header">
                                        <Text className="special-text">
                                            {t("订单编号")}：<Text className="special-color">{item.orderSn}</Text>
                                        </Text>
                                    </View>
                                    <View className="order-list-item-content">
                                        <View className="item-content-product">
                                            {(item.items || []).map((subItem) => (
                                                <Navigator
                                                    key={subItem.productId}
                                                    url={`/pages/product/index?id=${subItem.productId}`}
                                                    hoverClass="navigator-hover"
                                                >
                                                    <View className="item-content-product-item">
                                                        <View className="item-content-product-img">
                                                            {pickPic(subItem) && <TigImage src={pickPic(subItem)} mode="aspectFill" />}
                                                        </View>
                                                        <View className="item-content-product-detail">
                                                            <View className="item-content-product-info">
                                                                <View className="product-item-title">{subItem.productName}</View>

                                                                <View className="product-item-price">
                                                                    {/* 旧 format-price 支持 class 透传；新组件无 className prop，改由外层容器承载 .product-item-pricenum */}
                                                                    <View className="product-item-pricenum">
                                                                        <FormatPrice
                                                                            showText={false}
                                                                            decimalsStyle={{ fontSize: "25rpx" }}
                                                                            currencyStyle={{ fontSize: "23rpx" }}
                                                                            priceData={subItem.price}
                                                                        />
                                                                    </View>
                                                                    <View className="product-item-quantity">x {subItem.quantity} </View>
                                                                </View>
                                                            </View>
                                                            <View className={`sku-card${!hasSkuText(subItem.skuData) ? " nodata" : ""}`}>
                                                                {hasSkuText(subItem.skuData) && (
                                                                    <View className="sku-item line1">{getSkuText(subItem.skuData)}</View>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                </Navigator>
                                            ))}
                                        </View>
                                    </View>
                                    <View className="order-list-item-btn">
                                        <View className="item-btn-box">
                                            <TigButton2
                                                plain
                                                className="evaluate-btn"
                                                style={{ height: "55rpx" }}
                                                onClick={() => handleEvaluate(item.orderId)}
                                            >
                                                {currentType == 0 ? t("去评价") : t("待晒单")}
                                            </TigButton2>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="comment-list">
                            {filterState.map((item) => (
                                <View className="comment-item flex" key={item.orderId}>
                                    <View className="comment-header">
                                        {pickPic(item) && <TigImage className="head" src={pickPic(item)} mode="aspectFill" />}
                                    </View>
                                    <View className="comment-info">
                                        <View className="comment-label flex align-center">
                                            <View className="name">{t("评价")}:</View>
                                            <View className="content flex align-center justify-between">
                                                <Rate value={item.commentRank} color="#bfbfbf" readonly activeColor="#ffa800" size={18} />
                                                <View className="time">{item.addTime}</View>
                                            </View>
                                        </View>
                                        <View className="comment-label flex" onClick={() => handleToDetail(item.productId!)}>
                                            <View className="name">{t("商品名称")}:</View>
                                            <View className="content">
                                                <View className="product-name line1">{item.productName || "--"}</View>
                                            </View>
                                        </View>
                                        {item.skuData && item.skuData.length > 0 && (
                                            <View className="comment-label flex">
                                                <View className="name">{t("商品规格")}:</View>
                                                <View className="content flex-wrap">
                                                    {item.skuData.map((skuItem: any) => (
                                                        <View className="product-tag" key={skuItem.value}>
                                                            {skuItem.value}
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                        <View className="comment-label flex">
                                            <View className="name">{t("评价标签")}:</View>
                                            <View className="content flex-wrap">
                                                {(item.commentTag || []).map((tag: string) => (
                                                    <View className="product-tag" key={tag}>
                                                        {tag}
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                        <View className="comment-label flex">
                                            <View className="name">{t("评价内容")}:</View>
                                            <View className="content">
                                                <View className="cont">{item.content}</View>
                                            </View>
                                        </View>
                                        {item.replies && item.replies.length > 0 && (
                                            <View className="reply-section">
                                                <View className="reply-card">
                                                    <View id={`reply-m-${item.commentId}`} className="reply-measure">
                                                        <Text>
                                                            {t("客服回复")}：{item.replies[0]?.content}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        id={`reply-b-${item.commentId}`}
                                                        className={`reply-body${!expandedReplies.has(item.commentId!) ? " is-collapsed" : ""}`}
                                                    >
                                                        <Text className="reply-label">{t("客服回复")}：</Text>
                                                        <Text className="reply-text">{item.replies[0]?.content}</Text>
                                                        {overflowReplies.has(item.commentId!) && expandedReplies.has(item.commentId!) && (
                                                            <Text
                                                                className="reply-toggle"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleReplies(item.commentId!);
                                                                }}
                                                            >
                                                                {t("收起")}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    {overflowReplies.has(item.commentId!) && !expandedReplies.has(item.commentId!) && (
                                                        <View
                                                            className="reply-expand"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleReplies(item.commentId!);
                                                            }}
                                                        >
                                                            <Text className="reply-expand-text">...</Text> {t("展开")}
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        )}
                                        <View className="comment-label flex">
                                            <View className="name">{t("晒单")}:</View>
                                            {item.showPics?.length > 0 && (
                                                <View className="content flex-wrap">
                                                    {item.showPics.map((product: any) => (
                                                        <View
                                                            className="product-pic"
                                                            key={product.picUrl}
                                                            onClick={() => imagePreview(imageFormat(product.picUrl))}
                                                        >
                                                            <TigImage src={pickPic(product)} mode="aspectFill" />
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                    {!isLoading && filterState.length == 0 && (
                        <View className="empty-box">
                            <View className="pictrue">
                                <Image src={staticResource("common/data_empty.png")} />
                            </View>
                            <View className="txt">{t("暂无评价")}</View>
                        </View>
                    )}
                    <LoadingBox modelValue={loaded} page={filterParamsRef.current.page} length={filterState.length} />
                </View>
            ) : (
                <EmptyBox centerContent height="calc(100vh - var(--nav-height) - var(--safe-bottom, 0px))" mode="list" text={t("评价功能已关闭")} />
            )}
        </TigLayout>
    );
}