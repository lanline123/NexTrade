import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter, useUnload } from "@tarojs/taro";
import dayjs from "dayjs";

import EmptyBox from "@/components/empty-box/EmptyBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import LoadingBox from "@/components/loading-box";
import Specification from "@/components/product/specification";
import type { SpecificationRef } from "@/components/product/specification";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import CancelOrderReasonPopup from "@/components/order/CancelOrderReasonPopup";
import type { CancelOrderReasonPopupRef } from "@/components/order/CancelOrderReasonPopup";
import MainHeader from "@/components/mainHeader";
import { delOrder, getOrderList, orderBuyAgain, confirmReceipt } from "@/api/user/order";
import { getJoiningActivityDetail } from "@/api/groupon/groupon";
import type { OrderListFilterParams, OrderListFilterResult } from "@/types/user/order";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import useList from "@/hooks/useList";
import { getSkuText, hasSkuText, isOverseas, redirect } from "@/utils";
import { pickSkuPic } from "@/utils/format";
import { canShowOrderPayment } from "@/utils/orderPayment";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./list.scss";

interface MenuType {
    type: string;
    value: string;
    badge: any;
}

/**
 * 订单列表页（自旧 pages/user/order/list.vue 移植）
 * - 支持按状态筛选：全部/待支付/待发货/待收货/待评价
 * - 支持订单操作：取消/删除/付款/再次购买/评价/确认收货
 * - 支持查看提货凭证（到店自提订单）
 * - 根据订单类型跳转不同详情页（普通/自提/预约）
 */
export default function OrderList() {
    usePageGuards();

    const router = useRouter();
    const langCode = useI18nStore((s) => s.langCode);
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);

    // D1146：商品评价总开关
    const commentEnabled = productCommentEnabled === 1;
    const isOverseasSkin = isOverseas();

    const isOfflineOrder = (item: OrderListFilterResult) => Number(item.payTypeId) === 3;
    /** 认款被驳回且订单未取消时才允许修改申请 */
    const isOfflineClaimRejected = (item: OrderListFilterResult) =>
        isOfflineOrder(item) && Number(item.offlinePaymentClaimStatus) === 2 && Number(item.orderStatus) !== 3;
    /** 已取消订单不再提供认款详情和修改申请入口 */
    const canViewOfflineClaim = (item: OrderListFilterResult) =>
        Number(item.orderStatus) !== 3 && !!item.availableActions?.offlinePaymentClaimDetail && !isOfflineClaimRejected(item);
    const canEditOfflineClaim = (item: OrderListFilterResult) =>
        Number(item.orderStatus) !== 3 && (isOfflineClaimRejected(item) || !!item.availableActions?.editOfflinePaymentClaim);
    const canShowToPay = canShowOrderPayment;
    const handleOfflineClaim = (id: number, mode: "edit" | "detail") =>
        Taro.navigateTo({ url: `/pages/order/offlinePayment?orderId=${id}&mode=${mode}` });

    const [buyAgainProductId, setBuyAgainProductId] = useState(0);
    const [buyAgainSkuId, setBuyAgainSkuId] = useState(0);
    const buyAgainSpecificationRef = useRef<SpecificationRef>(null);
    const resetBuyAgainPopup = () => {
        setBuyAgainProductId(0);
        setBuyAgainSkuId(0);
    };
    const openBuyAgainSpecification = () => buyAgainSpecificationRef.current?.handleShowPopup();
    const openSingleProductBuyAgain = (item: OrderListFilterResult) => {
        setBuyAgainSkuId(Number(item.items[0]?.skuId || 0));
        setBuyAgainProductId(Number(item.items[0]?.productId || 0));
    };
    const isNormalSingleProductOrder = (item: OrderListFilterResult) =>
        item.items.length === 1 && !item.isPresale && Number(item.items[0]?.productType) === 1;

    const menuTypeList: MenuType[] = [
        { type: "all", value: t("全部订单"), badge: { value: 0 } },
        { type: "awaitPay", value: t("待支付"), badge: { value: 0 } },
        { type: "awaitShipping", value: t("待发货"), badge: { value: 0 } },
        { type: "awaitReceived", value: t("待收货"), badge: { value: 0 } },
        { type: "awaitComment", value: t("待评价"), badge: { value: 0 } }
    ];
    const visibleMenuTypeList = menuTypeList.filter((item) => item.type !== "awaitComment" || commentEnabled);

    const [currentType, setCurrentType] = useState<string>("all");
    // 旧 reactive filterParams：useList 会原地改写分页字段
    const filterParamsRef = useRef<OrderListFilterParams>({
        page: 1,
        size: 10,
        orderStatus: -1,
        commentStatus: -1,
        sortField: "addTime",
        sortOrder: "desc"
    });
    const filterParams = filterParamsRef.current;

    const [currentIndex, setCurrentIndex] = useState(0);
    const isFirstShowRef = useRef(true);

    const windowWidth = Taro.getSystemInfoSync().windowWidth || 375;
    // 非中文语种标签更长，需要开启横向滚动避免挤压
    const isNonChinese = !String(langCode || "zh")
        .toLowerCase()
        .includes("zh");
    const shouldTabsScrollable = isNonChinese || windowWidth <= 390;
    const tabTextStyle = {
        padding: windowWidth <= 375 ? "0 4rpx" : windowWidth <= 390 ? "0 8rpx" : "0 12rpx"
    };

    // 次卡子订单
    const isSubCard = (item: OrderListFilterResult) => {
        void item;
        const result = false;
        return result;
    };
    // 次卡主订单
    const isSubCardMainOrder = (item: OrderListFilterResult) => {
        void item;
        const result = false;
        return result;
    };

    /** 定金预售待付尾款阶段（saleMode=2 且 presaleStatus=1）但后端未放行支付 */
    const isFinalPaymentBlocked = (item: OrderListFilterResult): boolean => {
        const presale = item.presaleInfo;
        return presale?.saleMode === 2 && presale?.presaleStatus === 1 && presale?.canPayFinalPayment === false;
    };

    const {
        getList,
        data: orderList,
        isLoadMore,
        isLoading,
        total
    } = useList<OrderListFilterResult>(getOrderList as any, {
        params: filterParams,
        path: {
            dataKey: "records"
        }
    });

    /**
     * 切换订单状态筛选
     * - 待评价状态使用 commentStatus 筛选
     * - 其他状态使用 orderStatus 筛选
     */
    const changeMenu = (data: MenuType, index: number) => {
        if (currentType === data.type) return;
        setCurrentIndex(index);
        setCurrentType(data.type);
        filterParams.page = 1;
        // 待评价状态需要单独用 commentStatus 字段筛选
        if (data.type === "awaitComment") {
            filterParams.commentStatus = 0;
            filterParams.orderStatus = -1;
        } else {
            filterParams.orderStatus = formatOrderStatus(data.type);
            filterParams.commentStatus = -1;
        }
        void getList();
    };

    const cancelOrderReasonPopupRef = useRef<CancelOrderReasonPopupRef>(null);
    const handleCancelOrder = (id: number) => {
        cancelOrderReasonPopupRef.current?.open(id);
    };
    const refreshAfterCancel = () => {
        filterParams.page = 1;
        void getList();
    };

    const handleDelOrder = async (id: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认要删除该订单吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        await delOrder({ id });
                        Taro.showToast({
                            title: t("订单已删除成功"),
                            icon: "none"
                        });
                        filterParams.page = 1;
                        void getList();
                    } catch (error: any) {
                        Taro.showToast({
                            title: error.message,
                            icon: "none"
                        });
                    }
                }
            }
        });
    };

    /**
     * @description 再次购买，将订单商品重新加入购物车
     * 拼团订单特殊处理：如果活动未结束则跳转商品详情页重新参团，否则加入普通购物车
     * @param item 订单数据
     */
    const handleBuyAgain = async (item: OrderListFilterResult) => {
        try {
            // 如果是拼团订单
            if (item.grouponPromotionRecordId) {
                // 获取可用的拼团活动
                const result = await getJoiningActivityDetail({
                    productId: item.items[0].productId
                });
                // 拼团活动没结束
                if (result && result.endTime > dayjs().format("YYYY-MM-DD HH:mm:ss")) {
                    let url = "/pages/product/index?id=" + result.productId;
                    // 如果有skuId,就传skuId过去
                    if (item.items[0].skuId) {
                        url = url + "&skuId=" + item.items[0].skuId;
                    }
                    redirect({ url });
                } else {
                    await orderBuyAgain({ id: item.orderId });
                    redirect({ url: "/pages/cart/index" });
                }
            } else {
                if (isNormalSingleProductOrder(item)) {
                    openSingleProductBuyAgain(item);
                } else {
                    await orderBuyAgain({ id: item.orderId });
                    redirect({ url: "/pages/cart/index" });
                }
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const handleLink = (id: number) => {
        Taro.navigateTo({
            url: `/pages/product/index?id=${id}`
        });
    };

    const handlePay = (id: number, payTypeId: number) => {
        Taro.navigateTo({
            url: Number(payTypeId) === 3 ? `/pages/order/pay?orderId=${id}` : `/pages/order/cashier?orderId=${id}&from=orderList`
        });
    };

    /**
     * 解析订单详情页地址
     * 根据订单类型跳转不同页面：
     * - 周期购次卡 -> 门店订单详情页
     * - productType=8 电子礼品卡 -> 礼品卡订单详情页
     * - orderType=9 预约到店服务 -> 预约详情页
     * - orderType=10 预约上门服务 -> 预约详情页
     * - orderType=2 且 isPickup 无提货信息 -> 预约详情页
     * - isPickup 有提货信息 -> 自提订单详情页
     * - 其他 -> 普通订单详情页
     */
    const resolveOrderDetailUrl = (item: OrderListFilterResult): string => {
        if (item.items[0].productType === 8) {
            return `/pages/giftCard/order/info?id=${item.orderId}`;
        }

        const url = `/pages/user/order/info?id=${item.orderId}`;

        return url;
    };

    /** 商品区 navigator 用的详情地址 */
    const getOrderDetailUrl = (item: OrderListFilterResult) => resolveOrderDetailUrl(item);

    const handleOrederDetail = (item: OrderListFilterResult) => {
        redirect({
            url: resolveOrderDetailUrl(item)
        });
    };

    const handleEvaluate = (id: number) => {
        redirect({
            url: `/pages/user/comment/info?id=${id}`
        });
    };

    const handleConfirmReceipt = (id: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认收货吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        await confirmReceipt({ id });
                        Taro.redirectTo({
                            url: commentEnabled ? "/pages/user/order/list?type=awaitComment" : "/pages/user/order/list"
                        });
                    } catch (error: any) {
                        Taro.showToast({
                            title: error.message,
                            icon: "none"
                        });
                    }
                }
            }
        });
    };

    /**
     * 将状态类型转换为接口需要的 orderStatus 值
     * -1=全部, 0=待付款, 1=待发货, 2=待收货
     */
    const formatOrderStatus = (status: string) => {
        switch (status) {
            case "all":
                return -1;
            case "awaitPay":
                return 0;
            case "awaitShipping":
                return 1;
            case "awaitReceived":
                return 2;
            default:
                return -1;
        }
    };

    // 处理评论完成事件
    const handleCommentFinished = () => {
        void getList();
    };

    // 旧 onLoad：等待配置初始化后再计算可见标签，并注册全局事件
    useEffect(() => {
        const init = async () => {
            // 等待配置初始化后再计算可见标签
            await useConfigStore.getState().whenConfigReady();
            const readyCommentEnabled = useConfigStore.getState().productCommentEnabled === 1;
            const visibleMenus = menuTypeList.filter((item) => item.type !== "awaitComment" || readyCommentEnabled);
            const options = (router.params || {}) as Record<string, any>;
            if (options && options.type) {
                // 兼容下划线形式的历史链接；不可见标签回到全部订单
                const requestedType = options.type === "await_comment" ? "awaitComment" : options.type;
                const type = requestedType === "awaitComment" && !readyCommentEnabled ? "all" : requestedType;
                const menuIndex = visibleMenus.findIndex((item) => item.type === type);
                setCurrentIndex(menuIndex >= 0 ? menuIndex : 0);

                const currentMenuType = menuIndex >= 0 ? type : "all";
                if (currentMenuType === "awaitComment") {
                    filterParams.commentStatus = 0;
                    filterParams.orderStatus = -1;
                } else {
                    filterParams.commentStatus = -1;
                    filterParams.orderStatus = formatOrderStatus(currentMenuType);
                }
                setCurrentType(currentMenuType);
            }
            void getList();
            // 监听评论完成事件
            Taro.eventCenter.on("commentFinished", handleCommentFinished);
        };
        void init();

        // 旧 onUnload：页面卸载时移除事件监听
        return () => {
            Taro.eventCenter.off("commentFinished", handleCommentFinished);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useDidShow(() => {
        if (isFirstShowRef.current) {
            isFirstShowRef.current = false;
            return;
        }
        filterParams.page = 1;
        void getList();
    });

    useUnload(() => {
        Taro.eventCenter.off("commentFinished", handleCommentFinished);
    });

    return (
        /* overflow=false：tig-layout 默认给内容区加 overflow:hidden，会使其成为 sticky 的滚动容器导致吸顶失效 */
        /* 标题栏放进 sticky 流内（对齐 vortmall）：下拉时头部+tabs 一起动，避免 tig-layout fixed 导航栏与 tabs 脱节 */
        <TigLayout overflow={false}>
            <View className="order">
                <View className="order-sticky-header">
                    {isOverseasSkin && <MainHeader position="static" title={t("我的订单")} />}
                    {!isOverseasSkin && <TigNavbar title={t("我的订单")} fixed={false} needPlaceholder={false} />}
                    <View className={`order-menu badgecolor${!shouldTabsScrollable ? " tabs-equal" : ""}`}>
                        {/* TODO(MIGRATION)：旧 up-tabs 的 item.badge 未渲染（当前后端数据 badge.value 均为 0，视觉无差异） */}
                        {shouldTabsScrollable ? (
                            <ScrollView scrollX enableFlex className="order-menu-scroll">
                                <View className="order-menu-nav">
                                    {visibleMenuTypeList.map((item, index) => (
                                        <View
                                            key={item.type}
                                            className={`order-menu-tab${currentIndex === index ? " active" : ""}`}
                                            style={tabTextStyle}
                                            onClick={() => changeMenu(item, index)}
                                        >
                                            <Text>{item.value}</Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        ) : (
                            <View className="order-menu-nav">
                                {visibleMenuTypeList.map((item, index) => (
                                    <View
                                        key={item.type}
                                        className={`order-menu-tab${currentIndex === index ? " active" : ""}`}
                                        style={tabTextStyle}
                                        onClick={() => changeMenu(item, index)}
                                    >
                                        <Text>{item.value}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
                <View className="order-list" data-list-rev="eGprMjI4Mng">
                    {orderList.map((item) => (
                        <View className="order-list-item" key={item.orderId}>
                            <View className="order-list-item-top">
                                <View className="status-name">{item.orderStatusName}</View>
                                {item.cancelRemark?.trim() ? (
                                    <View className="cancel-reason">
                                        {t("取消原因")}：{item.cancelRemark}
                                    </View>
                                ) : null}
                                <View className="right-wrap" onClick={() => handleOrederDetail(item)}>
                                    <View className="more">
                                        <FormatPrice
                                            fontStyle={{ fontWeight: "600", fontSize: "24rpx" }}
                                            showText={false}
                                            isBottom={false}
                                            priceData={item.totalAmount}
                                        />
                                        <View className="icon iconfont icon-xiangyou" />
                                    </View>
                                </View>
                            </View>
                            <View className="order-list-item-content">
                                {item.items.length === 1 ? (
                                    <View className="item-content-product">
                                        {item.items.map((subItem) => (
                                            <View
                                                key={subItem.itemId}
                                                className="navigator-hover"
                                                onClick={() => Taro.navigateTo({ url: getOrderDetailUrl(item) })}
                                            >
                                                <View className="item-content-product-item-one">
                                                    <View className="item-content-product-img">
                                                        <TigImage src={pickSkuPic(subItem)} />
                                                        {subItem.isGift === 1 ? <View className="gift-text">{t("赠品")}</View> : null}
                                                    </View>
                                                    <View className="item-content-product-info">
                                                        <View className="product-item-title">
                                                            {item.isPresale ? (
                                                                <Text className="presale-tag">
                                                                    <Text className="presale-tag-text">{t("预售")}</Text>
                                                                </Text>
                                                            ) : null}
                                                            {item.joinStatus ? (
                                                                <Text className="groupon-tag">
                                                                    <Text className="groupon-tag-text">{t("拼团")}</Text>
                                                                </Text>
                                                            ) : null}
                                                            {subItem.productName}
                                                        </View>
                                                        <View className="product-item-detail">
                                                            <View className={`sku-wrap${!hasSkuText(subItem.skuData) ? " nodata" : ""}`}>
                                                                {hasSkuText(subItem.skuData) ? (
                                                                    <Text className="sku-item">{getSkuText(subItem.skuData)}</Text>
                                                                ) : null}
                                                            </View>
                                                            <View className="product-item-quantity">× {subItem.quantity}</View>
                                                        </View>
                                                        {subItem.extraSkuData && subItem.extraSkuData.length ? (
                                                            <View className="extraskudata-box">
                                                                <View className="extraskudata">
                                                                    {subItem.extraSkuData.map((attr: any, attrIndex: number) => (
                                                                        <View className="extraskudata-item" key={attrIndex}>
                                                                            <View className="title">{attr.attrName}</View>
                                                                            <View className="line-box">
                                                                                <View className="line" />
                                                                            </View>
                                                                            <View className="content">
                                                                                <Text className="content-text">{attr.attrValue}</Text>
                                                                                <View className="price">
                                                                                    <FormatPrice showText={false} priceData={attr.attrPrice} />
                                                                                </View>
                                                                                <View className="num">x{subItem.quantity}</View>
                                                                            </View>
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                                {item.items.length > 1 ? (
                                    <View className="item-content-product">
                                        <ScrollView scrollX enableFlex style={{ display: "flex" }}>
                                            {item.items.map((subItem) => (
                                                <View
                                                    className="item-content-product-nav navigator-hover"
                                                    key={subItem.itemId}
                                                    onClick={() => Taro.navigateTo({ url: getOrderDetailUrl(item) })}
                                                >
                                                    <View className="item-content-product-item">
                                                        <View className="item-content-product-img">
                                                            <TigImage src={subItem.picThumb} />
                                                            {subItem.isGift === 1 ? (
                                                                <View className="gift-text">{t("赠品")}</View>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </View>
                                ) : null}

                                {item.payStatus !== 0 &&
                                item.orderReservation &&
                                !((item as any).isCycleOrder === 1 && !item.parentOrderId) ? (
                                    <View className="item-content-reservation">
                                        <Text className="iconfont-h5 icon-riqi" /> {item.orderReservation.reservationDate}{" "}
                                        {item.orderReservation.startTime}～{item.orderReservation.endTime}
                                    </View>
                                ) : null}
                            </View>
                            <View className="order-list-item-btn">
                                <View className="autodeliverydays">
                                    {item.autoDeliveryDays && !item.isCardOrder ? (
                                        <View className="autodeliverydays-text line1">
                                            {t("订单将在{0}天后自动收货", { 0: item.autoDeliveryDays })}
                                        </View>
                                    ) : null}
                                </View>
                                <View className="item-btn-box">
                                    {item.availableActions?.cancelOrder ? (
                                        <TigButton2
                                            className="btn-margin"
                                            style={{ borderColor: "#505259" }}
                                            onClick={() => handleCancelOrder(item.orderId)}
                                        >
                                            {t("取消订单")}
                                        </TigButton2>
                                    ) : null}
                                    {item.availableActions?.delOrder ? (
                                        <TigButton2
                                            className="btn-margin"
                                            style={{ borderColor: "#505259" }}
                                            onClick={() => handleDelOrder(item.orderId)}
                                        >
                                            {t("删除订单")}
                                        </TigButton2>
                                    ) : null}
                                    {item.availableActions?.toComment && commentEnabled ? (
                                        <TigButton2
                                            className="btn-margin"
                                            style={{ borderColor: "#505259" }}
                                            onClick={() => handleEvaluate(item.orderId)}
                                        >
                                            {t("去评价")}
                                        </TigButton2>
                                    ) : null}
                                    {/* 周期购、预约 */}
                                    {(item as any).isCycleOrder === 1 || isSubCardMainOrder(item) || [9, 10].includes(item.orderType) ? (
                                        <TigButton2
                                            className="btn-margin"
                                            theme
                                            onClick={() => handleLink(item?.items?.[0]?.productId)}
                                        >
                                            {[9, 10].includes(item.orderType) ? t("再次预约") : t("再次购买")}
                                        </TigButton2>
                                    ) : (item.availableActions?.rebuy || item.orderType === 2) && !isSubCard(item) ? (
                                        /* 次卡子订单不允许再次购买 */
                                        <TigButton2 className="btn-margin" theme onClick={() => handleBuyAgain(item)}>
                                            {t("再次购买")}
                                        </TigButton2>
                                    ) : null}
                                    {canViewOfflineClaim(item) ? (
                                        <TigButton2
                                            className="btn-margin"
                                            style={{ borderColor: "#505259" }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOfflineClaim(item.orderId, "detail");
                                            }}
                                        >
                                            {t("认款详情")}
                                        </TigButton2>
                                    ) : null}
                                    {canEditOfflineClaim(item) ? (
                                        <TigButton2
                                            className="btn-margin"
                                            style={{ borderColor: "#505259" }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOfflineClaim(item.orderId, "edit");
                                            }}
                                        >
                                            {t("修改申请")}
                                        </TigButton2>
                                    ) : null}
                                    {item.availableActions?.toPay && canShowToPay(item) ? (
                                        <TigButton2
                                            className="btn-margin"
                                            theme
                                            disabled={isFinalPaymentBlocked(item)}
                                            onClick={() => handlePay(item.orderId, item.payTypeId)}
                                        >
                                            {isFinalPaymentBlocked(item) ? t("尾款未到支付时间") : t("去付款")}
                                        </TigButton2>
                                    ) : null}
                                    {item.availableActions?.confirmReceipt && !item.isPickup && !item.isCardOrder ? (
                                        <TigButton2
                                            className="btn-margin"
                                            theme
                                            onClick={() => handleConfirmReceipt(item.orderId)}
                                        >
                                            {t("确认收货")}
                                        </TigButton2>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
                <LoadingBox modelValue={isLoadMore} page={filterParams.page} length={orderList.length} />

                {!isLoading && total === 0 ? (
                    <View className="order-empty">
                        <EmptyBox centerContent height="100%" mode="list" background="#f5f5f5" text={t("暂无订单")} />
                    </View>
                ) : null}
            </View>
            {isLoading ? <TigLoadingPage modelValue={isLoading} bgColor="#f4f4f4" /> : null}
            <CancelOrderReasonPopup ref={cancelOrderReasonPopupRef} onSuccess={refreshAfterCancel} />
            <Specification
                ref={buyAgainSpecificationRef}
                productId={buyAgainProductId}
                skuId={buyAgainSkuId}
                grouponEnable={false}
                onSkuIdChange={setBuyAgainSkuId}
                onLoadEnd={openBuyAgainSpecification}
                onClose={resetBuyAgainPopup}
            />
        </TigLayout>
    );
}