import { useEffect } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";

import { t } from "@/utils/i18n";

import "./index.scss";

interface EntryItem {
    picUrl?: string;
    picTitle?: string;
    picLink?: { link?: string; [key: string]: unknown };
}

interface OrderEntryV2Data extends ModuleDataWithFrame {
    title?: string;
    showTitle?: boolean;
    showMore?: boolean;
    cardList?: EntryItem[];
    listItems?: EntryItem[];
    cardBackgroundColor?: string;
    badgeBgColor?: string;
    badgeTextColor?: string;
}

const DEFAULT_LIST_LINKS = ["/pages/user/order/list?type=awaitComment", "/pages/user/afterSale/list"];

const DEFAULT_ORDER_LINKS = ["/pages/user/order/list?type=awaitPay", "/pages/user/order/list?type=awaitReceived", "/pages/user/order/list?type=awaitComment"];

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

/** 订单入口 V2（跨境「我的订单2」）（自旧 pages/member/components/decorate/orderEntryV2/index.vue 移植） */
export default function OrderEntryV2({ data = {} }: { data: OrderEntryV2Data }) {
    const token = useUserStore((s) => s.token);
    const orderNum = useUserStore((s) => s.orderNum) || {};
    const getOrderNum = useUserStore((s) => s.getOrderNum);

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));

    const cardList = data?.cardList || [];
    const listItems = data?.listItems || [];

    const baseVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 12,
        innerPadding: 16,
        boxPadding: 0,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });
    const cssVars = {
        ...baseVars,
        "--dec-card-bg-color": data?.cardBackgroundColor || (data?.moduleStyle as any)?.cardBackgroundColor || "#f6f7fb"
    };

    // 对应旧 watch(isLoggedIn, { immediate: true })
    useEffect(() => {
        if (isLoggedIn) {
            void getOrderNum();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    // 对应旧 uni.$on / uni.$off("commentFinished")
    useEffect(() => {
        const handleCommentFinished = () => {
            void getOrderNum(true);
        };
        Taro.eventCenter.on("commentFinished", handleCommentFinished);
        return () => {
            Taro.eventCenter.off("commentFinished", handleCommentFinished);
        };
    }, [getOrderNum]);

    const handleMoreClick = () => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        redirect({ url: "/pages/user/order/list" });
    };

    const handleCardClick = (item: EntryItem, index: number) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        if (item.picLink?.link) {
            redirect({ url: urlFormat(item.picLink as any) });
        } else {
            redirect({ url: DEFAULT_ORDER_LINKS[index] || "/pages/user/order/list" });
        }
    };

    const handleListClick = (_item: EntryItem, index: number) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        redirect({ url: DEFAULT_LIST_LINKS[index] || "/pages/user/order/list" });
    };

    const getCardBadge = (index: number): number => {
        if (!isLoggedIn) return 0;
        const keys = ["awaitPay", "awaitShipping", "awaitReceived"] as const;
        const key = keys[index];
        return Number(orderNum[key] ?? 0);
    };

    const formatBadge = (count: number): string => (count > 99 ? "99+" : String(count));

    const badgeStyle = {
        backgroundColor: data?.badgeBgColor || "#ff4d4f",
        color: data?.badgeTextColor || "#fff"
    };

    const getCardIconClass = (index: number): string => {
        const iconClasses = ["icon-daifukuan", "icon-jinxingzhong", "icon-yiwancheng"];
        return iconClasses[index] || iconClasses[0];
    };

    const getListIconClass = (index: number): string => {
        const iconClasses = ["icon-pingjia", "icon-shouhou"];
        return iconClasses[index] || iconClasses[0];
    };

    return (
        <View className="dec-order-entry-v2" style={cssVars as any}>
            <View className="dec-order-entry-v2__container">
                {data.showTitle !== false ? (
                    <View className="dec-order-entry-v2__header">
                        <View className="dec-order-entry-v2__title">{safeT(data.title, t("订单"))}</View>
                        {data.showMore !== false ? (
                            <View className="dec-order-entry-v2__more" onClick={handleMoreClick}>
                                <Text>{t("查看更多")}</Text>
                                <View className="dec-order-entry-v2__arrow iconfont icon-xiangyou" />
                            </View>
                        ) : null}
                    </View>
                ) : null}

                {cardList.length > 0 ? (
                    <View className="dec-order-entry-v2__cards">
                        {cardList.map((item, index) => (
                            <View className="dec-order-entry-v2__card" key={index} onClick={() => handleCardClick(item, index)}>
                                <View className="dec-order-entry-v2__card-icon">
                                    {item.picUrl ? (
                                        <TigImage className="dec-order-entry-v2__icon-img" src={imageFormat(item.picUrl)} mode="aspectFit" />
                                    ) : (
                                        <View className={`dec-order-entry-v2__icon-default iconfont ${getCardIconClass(index)}`} />
                                    )}
                                    {getCardBadge(index) > 0 ? (
                                        <View className="dec-order-entry-v2__badge" style={badgeStyle}>
                                            {formatBadge(getCardBadge(index))}
                                        </View>
                                    ) : null}
                                </View>
                                <View className="dec-order-entry-v2__card-label">{safeT(item.picTitle)}</View>
                            </View>
                        ))}
                    </View>
                ) : null}

                {listItems.length > 0 ? (
                    <View className="dec-order-entry-v2__list">
                        {listItems.map((item, index) => (
                            <View className="dec-order-entry-v2__list-item" key={index} onClick={() => handleListClick(item, index)}>
                                <View className="dec-order-entry-v2__list-left">
                                    <View className="dec-order-entry-v2__list-icon">
                                        {item.picUrl ? (
                                            <TigImage className="dec-order-entry-v2__list-icon-img" src={imageFormat(item.picUrl)} mode="aspectFit" />
                                        ) : (
                                            <View className={`dec-order-entry-v2__list-icon-default iconfont ${getListIconClass(index)}`} />
                                        )}
                                    </View>
                                    <Text className="dec-order-entry-v2__list-label">{safeT(item.picTitle)}</Text>
                                </View>
                                <View className="dec-order-entry-v2__list-arrow iconfont icon-xiangyou" />
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}