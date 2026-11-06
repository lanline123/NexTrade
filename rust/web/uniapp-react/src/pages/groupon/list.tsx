import { useEffect, useRef, useState } from "react";
import { Image, Input, ScrollView, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import LoadingBox from "@/components/loading-box";
import EmptyBox from "@/components/empty-box/EmptyBox";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import Specification from "@/components/product/specification";
import type { SpecificationRef } from "@/components/product/specification";
import Recommend from "@/components/recommend";
import CommonCountdown from "@/pages/customPage/modules/commonCountdown";
import GrouponItem from "./src/GrouponItem";
import GrouponListLayout from "./src/GrouponListLayout";
import GrouponError from "./src/Error";
import { imageFormat } from "@/utils/format";
import { setPageMeta } from "@/utils/seo";
import { decodeGroupQuery } from "@/utils/shopGroup";
import { useConfigStore } from "@/store/config";
import { redirect, staticResource } from "@/utils";
import { getGrouponPromotionDetail, getGrouponItemList } from "@/api/groupon/groupon";
import type { GrouponItem as GrouponItemData } from "@/types/home/home";
import type { GrouponPromotionDetail, GrouponItemListParams } from "@/types/groupon/groupon";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks/useProductStyle";
import { getIndex } from "@/api/home/home";
import { t } from "@/utils/i18n";

import "./list.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 拼团商品列表页（自旧 pages/groupon/list.vue 移植）
 * - 展示拼团活动商品列表
 * - 支持列表和瀑布流两种布局
 * - 显示拼团价格和成团人数
 */
export default function GrouponList() {
    usePageGuards();
    const router = useRouter();
    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);
    const specificationRef = useRef<SpecificationRef>(null);

    const [grouponPromotionId, setGrouponPromotionId] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [failLoad, setFailLoad] = useState(false);
    const [grouponEnable, setGrouponEnable] = useState(true); // 默认开启拼团
    const filterParamsRef = useRef<GrouponItemListParams>({
        //初始化用于查询的参数
        page: 1,
        size: 20,
        sortField: "",
        keyword: "",
        sortOrder: "",
        grouponPromotionId: 0
    });
    const [grouponPromotion, setGrouponPromotion] = useState<GrouponPromotionDetail>({
        endTime: "",
        grouponExplain: "",
        grouponImage: "",
        startTime: "",
        shopId: 0,
        shopTitle: ""
    });

    const [tabIndex, setTabIndex] = useState("default");
    const [tabList, setTabList] = useState([
        {
            label: t("综合"),
            value: "default",
            order: "desc"
        },
        {
            label: t("销量"),
            value: "sale",
            order: "desc"
        },
        {
            label: t("价格"),
            value: "price",
            order: "desc"
        }
    ]);

    const [specificationId, setSpecificationId] = useState(0);
    const [showProductDesc, setShowProductDesc] = useState(false);
    const [layoutMode, setLayoutMode] = useState<"list" | "waterfall">("list");
    // 旧 filterParams 为 reactive，关键字回填后模板即时显示；React 需单独持有 state 驱动渲染
    const [keyword, setKeyword] = useState("");

    const filterParams = filterParamsRef.current;

    // 对应旧 onMounted（#ifdef H5）
    useEffect(() => {
        setPageMeta({
            title: `${t("团购活动")} - ${shopTitle}`,
            description: `${shopTitle}${t("团购优惠活动")}`
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopTitle]);

    const toSearch = () => {
        redirect({
            url: "/pages/search/index",
            param: {
                redirectPath: "/pages/groupon/list?id=4",
                searchHistoryKey: "grouponSerchHistory",
                navbarTitle: t("搜索拼团商品"),
                placeholder: t("点击搜索"),
                isSwitchTab: true
            }
        });
    };

    /*时间字符串转时间戳 */
    const dateStringToTimestamp = (dateString: any) => {
        const dateParts = dateString.split(" ");
        const [year, month, day] = dateParts[0].split("-");
        const [hour, minute, second] = dateParts[1].split(":");
        const date = new Date(year, month - 1, day, hour, minute, second);
        return date.getTime();
    };

    /**
     * 是否活动开始
     */
    const isActivityStart = (() => {
        if (!grouponPromotion.startTime) {
            return false;
        }
        const startTime = dateStringToTimestamp(grouponPromotion.startTime);
        return startTime < new Date().getTime();
    })();

    /**
     * 是否活动结束
     */
    const isActivityEnd = (() => {
        if (!grouponPromotion.endTime) {
            return true;
        }
        const endTime = dateStringToTimestamp(grouponPromotion.endTime);
        return endTime < new Date().getTime();
    })();
    /**
     * 活动时间文本
     */
    const grouponPromotionTimeText = isActivityStart ? t("距拼团结束") : t("距拼团开始");

    const handleIcon = () => {
        // #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            history.back();
        }
        // #endif
        // #ifndef H5
        if (process.env.TARO_ENV !== "h5") {
            Taro.navigateBack();
        }
        // #endif
    };

    const formatTime = (time: string): string => {
        return time?.toString().padStart(2, "0") || "00";
    };

    const showGrouponPromotionPlain = () => {
        setShowProductDesc(true);
    };

    /**
     * 开团
     * @param item 商品ID
     */
    const startGroup = (item: GrouponItemData) => {
        setSpecificationId(item.productId);
        setGrouponEnable(true);
        specificationRef.current?.handleShowPopup();
    };

    /**
     * 原价购买
     * @param item
     */
    const buy = (item: GrouponItemData) => {
        setSpecificationId(item.productId);
        setGrouponEnable(false);
        specificationRef.current?.handleShowPopup();
    };

    const {
        isLoadMore,
        getList,
        data: grouponItemList,
        total
    } = useList<GrouponItemData>(getGrouponItemList, {
        params: filterParams,
        path: {
            dataKey: "records"
        },
        needReachBottom: false
    });

    const { styleMap } = useProductStyle(grouponItemList);

    // 拿到拼团活动详情
    const getDetail = async (promotionId: number = grouponPromotionId) => {
        try {
            // 接口层泛型沿用旧类型声明（实际已被 request 解包为 data），此处按业务对象取值
            const result = (await getGrouponPromotionDetail(promotionId)) as unknown as GrouponPromotionDetail;
            setGrouponPromotion(result);
            filterParams.grouponPromotionId = result.grouponPromotionId as number;
            await getList();
        } catch (error: any) {
            setFailLoad(true);
        } finally {
            setIsLoading(false);
        }
    };

    const resetList = () => {
        filterParams.page = 1;
        filterParams.sortOrder = "desc";
    };

    const onChangeTab = (item: { label: string; value: string; order: string }) => {
        let nextOrder = item.order;
        if (tabIndex !== item.value) {
            nextOrder = "desc";
        } else {
            if (item.value == "price") {
                nextOrder = item.order === "desc" ? "asc" : "desc";
            }
        }
        resetList();
        setTabIndex(item.value);
        setTabList((prev) => prev.map((tab) => (tab.value === item.value ? { ...tab, order: nextOrder } : tab)));
        filterParams.sortField = item.value;
        filterParams.sortOrder = nextOrder;
        void getList();
    };

    const changeLayout = async () => {
        setLayoutMode((prev) => (prev === "list" ? "waterfall" : "list"));
    };

    const initPage = async () => {
        try {
            const res = await getIndex();
            if (res.moduleList?.length) {
                // 找到拼团的配置
                const grouponModule = res.moduleList.find((item: any) => item.type === "groupon");
                const grouponActivityItem = (grouponModule?.module as any)?.grouponActivityItem;
                if (grouponModule && grouponModule.module && grouponActivityItem) {
                    setGrouponPromotionId(Number(grouponActivityItem.grouponPromotionId));
                }
                // 对应旧实现：ref 赋值后立即读取，React state 异步，故显式传参
                await getDetail(grouponActivityItem ? Number(grouponActivityItem.grouponPromotionId) : grouponPromotionId);
                return;
            }
        } catch (error: any) {
            setFailLoad(true);
        } finally {
            setIsLoading(false);
        }
    };

    // 对应旧 onLoad（只在首挂载执行一次）
    const didLoadRef = useRef(false);
    useEffect(() => {
        if (didLoadRef.current) return;
        didLoadRef.current = true;
        const option = (router.params || {}) as Record<string, any>;
        if (option && option.keyWords) {
            filterParams.keyword = decodeGroupQuery(option.keyWords);
            setKeyword(filterParams.keyword);
        }
        void initPage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // scroll-view 的 @scrolltolower（旧 useList 的 reachBottom 语义）
    const reachBottom = () => {
        if (isLoading || isLoadMore) return;
        if (filterParams.page < Math.ceil(total / Number(filterParams.size))) {
            filterParams.page++;
            void getList();
        }
    };

    return (
        <TigLayout>
            {!failLoad ? (
                <>
                    {!isLoading && (
                        <View className="groupon-container">
                            <View className="groupon-header">
                                <View className="header acea-row row-center-wrapper">
                                    <View className="left">
                                        <View className="iconfont icon-houtui" onClick={handleIcon} />
                                    </View>
                                    <View className="acea-row row-between-wrapper input" onClick={toSearch}>
                                        <Text className="iconfont-h5 icon-sousuo" />
                                        <Input
                                            className="txt"
                                            type="text"
                                            value={keyword}
                                            placeholder={t("商品名称搜索")}
                                            disabled
                                        />
                                    </View>
                                </View>
                                <View className="groupon-title">
                                    <Image
                                        className="groupon-img"
                                        src={imageFormat(grouponPromotion.grouponImage)}
                                        mode="heightFix"
                                    />
                                    {grouponPromotion.endTime && (
                                        <View className="group-timeinfo flex align-center">
                                            {!isActivityEnd ? (
                                                <View className="flex" style={{ alignItems: "baseline" }}>
                                                    <View className="countdown-title">{grouponPromotionTimeText}</View>
                                                    <View className="countdown">
                                                        <CommonCountdown
                                                            countdownType="specifyTime"
                                                            specifyTime={dateStringToTimestamp(
                                                                isActivityStart ? grouponPromotion.endTime : grouponPromotion.startTime
                                                            )}
                                                        >
                                                            {({ days, hours, minutes, seconds }) => (
                                                                <View className="countdown-text">
                                                                    {!!days && <Text>{days}</Text>}
                                                                    {!!days && <Text>{t("天")}&nbsp;</Text>}
                                                                    <Text className="countdown-bg">{formatTime(String(hours))}</Text>
                                                                    <Text>&nbsp;:&nbsp;</Text>
                                                                    <Text className="countdown-bg">{formatTime(String(minutes))}</Text>
                                                                    <Text>&nbsp;:&nbsp;</Text>
                                                                    <Text className="countdown-bg">{formatTime(String(seconds))}</Text>
                                                                </View>
                                                            )}
                                                        </CommonCountdown>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View>{t("活动已结束")}</View>
                                            )}
                                            <View
                                                className="flex group-desc"
                                                style={{ alignItems: "baseline" }}
                                                onClick={showGrouponPromotionPlain}
                                            >
                                                <View className="group-timeinfo-text" style={{ wordBreak: "break-all" }}>
                                                    {t("活动规则")}
                                                </View>
                                                <Text
                                                    className="iconfont-h5 icon-gengduo1"
                                                    style={{ fontSize: "22rpx", color: "#bfbfbf" }}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View className="placeholder" />
                            <View className="tab-box">
                                {/* <View className="gap" /> */}
                                <View className="item-list flex align-center justify-between">
                                    {tabList.map((item) => (
                                        <View
                                            key={item.value}
                                            className={`item flex align-center ${tabIndex === item.value ? "active" : ""}`}
                                            onClick={() => onChangeTab(item)}
                                        >
                                            <Text>{t(item.label)}</Text>
                                            {item.value === "price" && (
                                                <View className="price-ico-box flex flex-column">
                                                    <Text
                                                        className={`iconfont-h5 icon-up ${item.order === "asc" ? "order" : ""}`}
                                                        style={{ fontSize: "14rpx" }}
                                                    />
                                                    <Text
                                                        className={`iconfont-h5 icon-arrowdown ${
                                                            item.order === "desc" ? "order" : ""
                                                        }`}
                                                        style={{ fontSize: "14rpx" }}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                    <View className="layout-change-icon" onClick={changeLayout}>
                                        {layoutMode === "list" && (
                                            <Image className="icon" src={staticResource("groupon/list.png")} />
                                        )}
                                        {layoutMode === "waterfall" && (
                                            <Image className="icon" src={staticResource("groupon/waterfall.png")} />
                                        )}
                                    </View>
                                </View>
                            </View>
                            <View className="list-box">
                                <ScrollView scrollY className="list-scroll" onScrollToLower={reachBottom}>
                                    {grouponItemList.length > 0 && (
                                        <View>
                                            <GrouponListLayout layoutMode={layoutMode} grouponItemList={grouponItemList}>
                                                {(item) => (
                                                    <GrouponItem
                                                        mode={layoutMode}
                                                        item={item}
                                                        isActivityStart={isActivityStart}
                                                        isActivityEnd={isActivityEnd}
                                                        productStyle={styleMap[item.productId]}
                                                        onStartGroup={startGroup}
                                                        onBuy={buy}
                                                    />
                                                )}
                                            </GrouponListLayout>
                                        </View>
                                    )}
                                    <LoadingBox
                                        modelValue={isLoadMore}
                                        color="#fff"
                                        page={filterParams.page}
                                        length={grouponItemList.length}
                                    />
                                    {!isLoading && total === 0 && (
                                        <View className="empty-box">
                                            <EmptyBox icon="salesman/no_order.png" text={t("暂无数据")} />
                                        </View>
                                    )}
                                </ScrollView>
                            </View>
                        </View>
                    )}
                </>
            ) : (
                <>
                    <GrouponError />
                    <Recommend titleBg="#fff" />
                </>
            )}
            <TigLoadingPage modelValue={isLoading} />
            <Popup
                visible={showProductDesc}
                position="bottom"
                round
                closeable
                onClose={() => setShowProductDesc(false)}
            >
                <ScrollView scrollY className="grouponpromotion-plain">
                    <View className="popup-title title">{t("活动说明")}</View>
                    <View className="popup-content">{grouponPromotion.grouponExplain}</View>
                </ScrollView>
            </Popup>
            <Specification ref={specificationRef} productId={specificationId} grouponEnable={grouponEnable} />
        </TigLayout>
    );
}