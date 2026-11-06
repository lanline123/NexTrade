import { useCallback, useEffect, useRef, useState } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import HorizontalTabs from "./buyerShowCompnents/HorizontalTabs";
import WaterfallLayout from "./buyerShowCompnents/WaterfallLayout";
import BuyerShowItem from "./src/BuyerShowItem";
import BuyerShowCloseTip from "./src/BuyerShowCloseTip";
import { buyerShowList, getBuyerShowGroupList, getHistoryProduct } from "@/api/buyerShow/buyerShow";
import type { BuyerShowFilterState, BuyerShowListParams } from "@/types/buyerShow/buyerShow";
import { useConfigStore } from "@/store/config";
import { useTabbarDerived } from "@/store/tabbar";
import { useUserStore } from "@/store/user";
import useList from "@/hooks/useList";
import { redirect } from "@/utils";
import { handleLogin } from "@/utils/handleLogin";
import { decodeGroupQuery } from "@/utils/shopGroup";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { prefetchVideoFeedEntry } from "./composables/videoFeedPrefetch";
import { isVideoBuyerShow } from "./utils/videoFeed";

import "./index.scss";

const BUYER_SHOW_LIST_NEED_REFRESH_KEY = "buyerShow:listNeedRefresh";

/**
 * 买家秀列表页（自旧 index.vue 移植）
 * - 瀑布流展示买家秀内容
 * - 支持分类筛选
 * - 点击进入买家秀详情
 */
export default function BuyerShowIndex() {
    usePageGuards();
    const configStore = useConfigStore();
    const userToken = useUserStore((s) => s.token);
    const { currentActiveValue, tabbarHeightNum } = useTabbarDerived();
    const safeBottom = useConfigStore((s) => s.safeAreaInsets.bottom);

    const [buyerShowEnabled, setBuyerShowEnabled] = useState<number | undefined>(1);
    useEffect(() => {
        if (configStore.initLoading) {
            setBuyerShowEnabled(configStore.buyerShowEnabled);
        }
    }, [configStore.initLoading, configStore.buyerShowEnabled]);

    // 旧 setup 顶部 + onShow 都会隐藏原生 tabbar（页面自绘 CustomTabbar）
    useEffect(() => {
        Taro.hideTabBar({}).catch(() => {});
    }, []);

    const filterParamsRef = useRef<BuyerShowListParams>({
        page: 1,
        size: 10,
        sortField: "addTime",
        sortOrder: "desc",
        keyword: ""
    });

    const {
        getList,
        data: buyerShowListData,
        isLoading,
        isLoadMore,
        total
    } = useList<any, BuyerShowListParams>(buyerShowList as any, {
        params: filterParamsRef.current,
        path: {
            dataKey: "records"
        },
        immediate: false
    });

    // 已购商品（仅用于判断是否展示「发布」按钮）
    const historyParamsRef = useRef({ page: 1, size: 1 });
    const { total: getHistoryProductTotal, getList: getHistoryProductList } = useList(getHistoryProduct, {
        params: historyParamsRef.current,
        path: {
            dataKey: "records"
        },
        needReachBottom: false
    });

    const hasToken = userToken || Taro.getStorageSync("token");

    // 旧版 hasToken 计算属性内部会触发一次已购商品查询，这里改为挂载时执行一次
    useEffect(() => {
        void getHistoryProductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow：仅当详情页发生「点赞状态变化」时，返回列表才刷新
    useDidShow(() => {
        Taro.hideTabBar({}).catch(() => {});
        const needRefresh = Boolean(Taro.getStorageSync(BUYER_SHOW_LIST_NEED_REFRESH_KEY));
        if (needRefresh) {
            Taro.removeStorageSync(BUYER_SHOW_LIST_NEED_REFRESH_KEY);
            // 如果已有数据，说明不是首次加载；此时刷新列表即可
            if (buyerShowListData.length > 0) {
                filterParamsRef.current.page = 1;
                void getList({ ...filterParamsRef.current });
            }
        }
    });

    /**
     * 发布按钮距底部的偏移，避开 tabbar 与底部安全区。
     * 小程序对 scoped 样式里的 calc(var(--x) + rpx) 支持不稳定，这里直接算出 px。
     */
    const gapPx = (20 * Taro.getSystemInfoSync().windowWidth) / 750;
    const bottomPx = currentActiveValue > -1 ? tabbarHeightNum + safeBottom + gapPx : safeBottom + gapPx;
    const publishFabStyle = { bottom: `${bottomPx}px` };

    // 旧 #ifdef H5 / APP-PLUS / MP-WEIXIN 三端不同的容器上边距
    const containerStyle =
        process.env.TARO_ENV === "h5"
            ? { marginTop: "calc(var(--nav-height) + 80rpx)" }
            : process.env.TARO_ENV === "rn"
              ? { marginTop: "calc(var(--nav-height) + 20rpx)" }
              : { marginTop: "calc(var(--nav-height))" };

    const [tabList, setTabList] = useState<any[]>([{ title: t("全部") }]);
    const [currentTab, setCurrentTab] = useState(0);

    // 监听分组切换（跳过首次，首次由 onLoad 触发）
    const skipTabWatchRef = useRef(true);
    useEffect(() => {
        if (skipTabWatchRef.current) {
            skipTabWatchRef.current = false;
            return;
        }
        filterParamsRef.current.goodsId = tabList[currentTab]?.buyerShowGroupId;
        void getList({ ...filterParamsRef.current });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTab]);

    // 获取买家秀分组列表
    const getGroupList = () => {
        getBuyerShowGroupList().then((res: any) => {
            const next = (res || []).map((item: any) => {
                return {
                    ...item,
                    title: item.groupName
                };
            });
            next.unshift({ title: t("全部") });
            setTabList(next);
        });
    };

    useLoad((options: any) => {
        if (options?.keyWords) {
            filterParamsRef.current.keyword = decodeGroupQuery(options.keyWords);
            void getList({ ...filterParamsRef.current });
        } else {
            void getList();
        }
        getGroupList();
    });

    const toSearch = () => {
        redirect({
            url: "/pages/search/index",
            param: {
                redirectPath: "/pages/buyerShow/index",
                searchHistoryKey: "buyerShowSearchList",
                navbarTitle: t("搜索买家秀"),
                placeholder: t("点击搜索"),
                isSwitchTab: true
            }
        });
    };

    const addBuyerShow = () => {
        redirect({ url: "/pages/buyerShow/addBuyerShow" });
    };

    const hasMore = true;
    const loading = false;
    const loadMoreData = useCallback(async () => {
        console.log("loadMoreData");
    }, []);

    /**
     * 点击列表项：视频类进视频流并定位到该条，图文类进图文详情
     */
    const onProductClick = (item: BuyerShowFilterState) => {
        if (isVideoBuyerShow(item)) {
            // 进页前备好首屏并预取 feed，缩短打开时的等待
            prefetchVideoFeedEntry(item);
            redirect({ url: "/pages/buyerShow/videoFeed", param: { buyerShowId: item.buyerShowId } });
            return;
        }
        redirect({ url: "/pages/buyerShow/buyerShowDetail", param: { buyerShowId: item.buyerShowId } });
    };

    const handleLink = (type: string) => {
        if (type === "home") {
            redirect({ url: "/pages/index/index" });
        } else if (process.env.TARO_ENV === "h5") {
            history.back();
        } else {
            Taro.navigateBack();
        }
    };
    void handleLink;

    if (buyerShowEnabled === 1) {
        return (
            <TigLayout title={configStore.buyerShowMobileShowName || t("买家秀")}>
                <View className="buyerShowBox">
                    <View className="header acea-row row-center-wrapper">
                        <View className="acea-row row-between-wrapper input" onClick={toSearch}>
                            <Text className="iconfont-h5 icon-sousuo" />
                            <Input
                                className="txt"
                                disabled
                                type="text"
                                value=""
                                placeholder={t("点击搜索")}
                                placeholderStyle="color: #999; font-size: 26rpx;"
                            />
                        </View>
                    </View>
                    <View className="tabs">
                        <HorizontalTabs tabs={tabList} currentTab={currentTab} onCurrentTabChange={setCurrentTab} />
                    </View>
                    <View className="container" style={containerStyle}>
                        <WaterfallLayout
                            list={buyerShowListData}
                            hasMore={hasMore}
                            loading={loading}
                            layout={configStore.buyerShowTemplateStyle ? "single" : "double"}
                            onLoadMore={loadMoreData}
                            onItemClick={(item) => onProductClick(item)}
                            renderItem={(item, index) => (
                                <BuyerShowItem buyerShowItem={item} buyerShowIndex={index} buyerShowListData={buyerShowListData} />
                            )}
                            renderItemRight={(item, index) => (
                                <BuyerShowItem buyerShowItem={item} buyerShowIndex={index} buyerShowListData={buyerShowListData} />
                            )}
                        />
                    </View>
                    {/* 判断是否已登录 */}
                    {!hasToken ? (
                        <View className="publish" style={publishFabStyle} onClick={handleLogin}>
                            <View className="iconfont-h5 icon-xiangji1" />
                            <View className="text">{t("发布")}</View>
                        </View>
                    ) : getHistoryProductTotal ? (
                        <View className="publish" style={publishFabStyle} onClick={addBuyerShow}>
                            <View className="iconfont-h5 icon-xiangji1" />
                            <View className="text">{t("发布")}</View>
                        </View>
                    ) : null}
                    <LoadingBox modelValue={isLoadMore} page={filterParamsRef.current.page} length={buyerShowListData.length} />
                </View>
                {!isLoading && total === 0 && (
                    <View className="empty-box">
                        <EmptyBox icon="salesman/no_order.png" text={t("暂无数据")} />
                    </View>
                )}
            </TigLayout>
        );
    }

    return (
        <TigLayout title={t("买家秀")}>
            <BuyerShowCloseTip buyerShowEnabled={buyerShowEnabled} onBuyerShowEnabledChange={setBuyerShowEnabled} />
        </TigLayout>
    );
}