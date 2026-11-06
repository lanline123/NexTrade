import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigImage from "@/components/tig/tig-image/TigImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import GrouponNav from "./src/GrouponNav";
import GrouponShare from "./src/GrouponShare";
import { useUserStore } from "@/store/user";
import type { GrouponRecordItem, GrouponRecordListParams } from "@/types/groupon/groupon";
import type { ProductItem } from "@/types/product/product";
import { getGrouponRecordList, getGrouponRecordDetail } from "@/api/groupon/groupon";
import { getProductDetail } from "@/api/product/product";
import { productImage } from "@/utils/format";
import { decodeGroupQuery } from "@/utils/shopGroup";
import { redirect } from "@/utils";
import useList from "@/hooks/useList";
import { t } from "@/utils/i18n";

import "./mylist.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 我的拼团列表页（自旧 pages/groupon/mylist.vue 移植）
 * - 展示用户参与的拼团记录
 * - 按状态筛选（全部/进行中/成功/失败）
 * - 提供分享邀请好友参团功能
 */
export default function GrouponMyList() {
    usePageGuards();
    const router = useRouter();
    const userToken = useUserStore((s) => s.token);

    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const currentTypeRef = useRef<number>(1);
    const [showShare, setShowShare] = useState(false);

    const menuList = [
        { type: 1, value: t("我发起的团"), num: 0 },
        { type: 2, value: t("我参与的团"), num: 0 }
    ];

    const filterParamsRef = useRef<GrouponRecordListParams>({
        page: 1,
        size: 10,
        joinType: 1,
        isMine: true,
        dateType: 0,
        keyword: ""
    });
    const filterParams = filterParamsRef.current;

    const [productId, setProductId] = useState(0);
    const [product, setProduct] = useState<ProductItem>({
        productId: 0,
        productStock: 0
    });
    const [productPrice, setProductPrice] = useState<string>("0");
    const [grouponPromotionId, setGrouponPromotionId] = useState(0);
    const [grouponPromotionRecordId, setGrouponPromotionRecordId] = useState(0);

    const {
        data: grouponRecordList,
        getList,
        isLoadMore,
        isLoading,
        total
    } = useList<GrouponRecordItem>(getGrouponRecordList, {
        params: filterParams,
        path: {
            dataKey: "records"
        },
        needReachBottom: true
        // immediate: true
    });

    /**
     * 处理分享
     */
    const handleShare = async (item: GrouponRecordItem) => {
        if (!userToken) {
            Taro.navigateTo({
                url: "/pages/login/index"
            });
            return;
        }
        try {
            // 拿到记录详情
            const grouponRecord = await getGrouponRecordDetail(item.grouponPromotionRecordId);
            if (!grouponRecord) {
                return;
            }
            // 拿到商品详情
            const productResult: any = await getProductDetail((grouponRecord as any).productId);
            setGrouponPromotionId((grouponRecord as any).grouponPromotionId);
            setGrouponPromotionRecordId(item.grouponPromotionRecordId);
            setProductId(productResult.item.productId);
            setProduct(productResult.item);
            setProductPrice(item.grouponPrice.toString());
            setShowShare(true);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const handleToDetail = (id: number) => {
        redirect({
            url: `/pages/product/groupBuying?grouponPromotionRecordId=${id}`
        });
    };

    const handleMenuType = (data: { type: number; value: string; num: number }) => {
        currentTypeRef.current = data.type;
        filterParams.page = 1;
        filterParams.joinType = currentTypeRef.current;
        setCurrentIndex(menuList.findIndex((menu) => menu.type === data.type));
        void getList();
    };

    // 对应旧 onLoad
    const didLoadRef = useRef(false);
    useEffect(() => {
        if (didLoadRef.current) return;
        didLoadRef.current = true;
        const option = (router.params || {}) as Record<string, any>;
        if (option?.keyWords) {
            filterParams.keyword = decodeGroupQuery(option.keyWords);
            void getList();
        } else {
            void getList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout>
            <GrouponNav />
            <View className="groupon">
                <View className="groupon-menu">
                    {/* 旧 up-tabs（v-model:current + line-color/line-width/line-height + active/inactive-style）以基础组件自绘 */}
                    <View className="order-menu badgecolor">
                        {menuList.map((item, index) => (
                            <View
                                key={item.value}
                                className={`tab-item ${currentIndex === index ? "active" : ""}`}
                                onClick={() => handleMenuType(item)}
                            >
                                <Text>{item.value}</Text>
                                <View className="tab-line" />
                            </View>
                        ))}
                    </View>
                </View>
                <View className="placeholder" />
                <View className="groupon-list">
                    {grouponRecordList.map((item, index) => (
                        <View
                            key={index}
                            className="groupon-item"
                            onClick={() => handleToDetail(item.grouponPromotionRecordId)}
                        >
                            <View className="groupon-item__wrap">
                                <View className="groupon-content">
                                    <View className="groupon-img-box">
                                        <TigImage className="groupon-img" src={productImage(item)} mode="aspectFill" />
                                    </View>
                                    <View className="groupon-info">
                                        <View className="flex flex-column main-info">
                                            <View className="groupon-tit line2">{item.productName}</View>
                                            <View className="detail-group">
                                                <Text className="btn">
                                                    {item.minGroupNum}
                                                    {t("人团")}
                                                </Text>
                                                <Text className="num">
                                                    {t("已有")}
                                                    {item.joinNumCount}
                                                    {t("人参团")}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="flex align-end">
                                            <View className="group-price">
                                                <Text className="price-text">{t("拼团价")}:</Text>
                                                <FormatPrice
                                                    currencyStyle={{
                                                        fontSize: "23rpx"
                                                    }}
                                                    priceData={item.grouponPrice}
                                                />
                                            </View>
                                            <View className="original-price">
                                                <FormatPrice
                                                    fontStyle={{ textDecoration: "line-through" }}
                                                    currencyStyle={{
                                                        fontSize: "23rpx"
                                                    }}
                                                    priceData={item.productPrice}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                                <View className="groupon-footer">
                                    <View className="groupon-desc">
                                        {item.joinStatus === 1 && (
                                            <View className="text">
                                                <Text>{t("拼团中")}</Text> ，<Text>{t("还差")}</Text>
                                                <Text className="num">{item.minGroupNum - item.joinNumCount}</Text>
                                                <Text>{t("人")}</Text>
                                            </View>
                                        )}
                                        {item.joinStatus === 2 && (
                                            <View>
                                                <Text className="text">{t("拼团成功")}</Text>
                                            </View>
                                        )}
                                        {item.joinStatus === 3 && (
                                            <View>
                                                <Text className="text">{t("拼团失败")}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View className="btns" onClick={(e) => e.stopPropagation()}>
                                        {item.joinStatus === 1 && (
                                            <TigButton2
                                                plain
                                                className="groupon-share-btn"
                                                style={{ height: "58rpx", borderColor: "var(--main-bg)" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault?.();
                                                    void handleShare(item);
                                                }}
                                            >
                                                {t("邀请好友")}
                                            </TigButton2>
                                        )}
                                        {(item.joinStatus === 2 || item.joinStatus === 3) && (
                                            <TigButton2
                                                plain
                                                className="groupon-detail-btn"
                                                style={{ height: "58rpx", borderColor: "#9A9A9A", color: "#9A9A9A" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault?.();
                                                    handleToDetail(item.grouponPromotionRecordId);
                                                }}
                                            >
                                                {t("查看详情")}
                                            </TigButton2>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
                {!isLoading && total === 0 && (
                    <View className="empty-box">
                        <EmptyBox icon="salesman/no_order.png" text={t("暂无数据")} />
                    </View>
                )}
                <GrouponShare
                    modelValue={showShare}
                    onChange={setShowShare}
                    productId={Number(productId)}
                    productInfo={product}
                    grouponPromotionId={grouponPromotionId}
                    grouponPromotionRecordId={grouponPromotionRecordId}
                    productPrice={productPrice}
                />
                <LoadingBox modelValue={isLoadMore} page={filterParams.page} length={grouponRecordList.length} />
            </View>
            <TigLoadingPage modelValue={isLoading} />
        </TigLayout>
    );
}