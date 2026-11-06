import { useEffect } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import { redirect } from "@/utils";
import { pickPic, productImage, urlFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./index.scss";

interface EntryItem {
    picUrl?: string;
    picTitle?: string;
    picLink?: { link?: string; [key: string]: unknown };
}

interface OrderEntryData extends ModuleDataWithFrame {
    title?: string;
    showTitle?: boolean;
    showAllOrders?: boolean;
    layoutStyle?: number;
    entryList?: EntryItem[];
    badgeBgColor?: string;
    badgeTextColor?: string;
}

const STYLE1_ORDER_LINKS = [
    "/pages/user/order/list?type=awaitPay",
    "/pages/user/order/list?type=awaitShipping",
    "/pages/user/order/list?type=awaitReceived",
    "/pages/user/order/list?type=awaitComment",
    "/pages/user/afterSale/list"
];

const STYLE2_ORDER_LINKS = [
    "/pages/user/order/list?type=awaitPay",
    "/pages/user/order/list?type=awaitShipping",
    "/pages/user/order/list?type=awaitReceived",
    "/pages/user/afterSale/list",
    "/pages/user/order/list"
];

const ICON_CLASSES = ["icon-daifukuan", "icon-daifahuo", "icon-daishouhuo", "icon-daipingjia", "icon-tuikuan"];

const STYLE1_BADGE_KEYS = ["awaitPay", "awaitShipping", "awaitReceived", "awaitComment", "awaitAftersalesCollect"] as const;
const STYLE2_BADGE_KEYS = ["awaitPay", "awaitShipping", "awaitReceived", "awaitAftersalesCollect", ""] as const;

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

/** 我的订单入口（自旧 pages/member/components/decorate/orderEntry/index.vue 移植） */
export default function OrderEntry({ data = {} }: { data: OrderEntryData }) {
    const token = useUserStore((s) => s.token);
    const orderNum = useUserStore((s) => s.orderNum) || {};
    const getOrderNum = useUserStore((s) => s.getOrderNum);
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));
    const currentLayoutStyle = data?.layoutStyle ?? 1;
    const showHeader = currentLayoutStyle === 2 ? false : data?.showTitle !== false;

    const getDefaultBadgeBgColor = (layoutStyle?: number) => (layoutStyle === 1 ? "#4d9be4" : "#ff4d4f");
    const badgeStyle = {
        backgroundColor: data?.badgeBgColor || getDefaultBadgeBgColor(currentLayoutStyle),
        color: data?.badgeTextColor || "#fff"
    };

    const entryList = data?.entryList || [];

    const cssVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 12,
        innerPadding: 16,
        boxPadding: 5,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

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

    const handleAllOrdersClick = () => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        redirect({ url: "/pages/user/order/list" });
    };

    const handleEntryClick = (item: EntryItem, index: number) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        const customLink = (item.picLink?.link as string | undefined)?.trim() || "";
        if (customLink) {
            redirect({ url: urlFormat(item.picLink as any) });
        } else {
            const links = currentLayoutStyle === 1 ? STYLE1_ORDER_LINKS : STYLE2_ORDER_LINKS;
            redirect({ url: links[index] || "/pages/user/order/list" });
        }
    };

    /**
     * D1146：评价关闭时隐藏指向评价的入口。
     * 按解析后的目标链接判断而非写死下标，装修自定义链接也能命中；
     * 装修链接经 urlFormat 解析出的是 await_comment 下划线形式，故两种写法都要匹配。
     */
    const isEntryVisible = (item: EntryItem, index: number): boolean => {
        if (productCommentEnabled === 1) return true;
        const customLink = (item.picLink?.link as string | undefined)?.trim() || "";
        const links = currentLayoutStyle === 1 ? STYLE1_ORDER_LINKS : STYLE2_ORDER_LINKS;
        const target = customLink ? urlFormat(item.picLink as any) : links[index] || "";
        return !/type=await_?comment/i.test(target) && !target.includes("/pages/user/comment/");
    };

    const getBadgeCount = (index: number): number => {
        if (!isLoggedIn) return 0;
        const keys = currentLayoutStyle === 1 ? STYLE1_BADGE_KEYS : STYLE2_BADGE_KEYS;
        const key = keys[index];
        if (!key) return 0;
        return Number(orderNum[key] ?? 0);
    };

    const formatBadge = (count: number): string => (count > 99 ? "99+" : String(count));

    const getDefaultIconClass = (index: number): string => ICON_CLASSES[index] || ICON_CLASSES[0];

    return (
        <View className="dec-order-entry" style={cssVars}>
            <View className="dec-order-entry__container">
                {showHeader ? (
                    <View className="dec-order-entry__header">
                        <View className="dec-order-entry__title">{safeT(data.title, t("我的订单"))}</View>
                        {data.showAllOrders !== false ? (
                            <View className="dec-order-entry__more" onClick={handleAllOrdersClick}>
                                <Text>{t("全部订单")}</Text>
                                <View className="dec-order-entry__arrow iconfont-h5 icon-a-gengduo20" />
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <View className={`dec-order-entry__list${currentLayoutStyle === 1 ? " dec-order-entry__list--style1" : ""}`}>
                    {entryList.map((item, index) => {
                        // D1146：评价关闭时跳过评价入口，但不重排下标，图标 / 角标的下标映射保持不变
                        if (!isEntryVisible(item, index)) return null;
                        return (
                            <View key={index}>
                                {currentLayoutStyle === 2 && index === entryList.length - 1 ? <View className="dec-order-entry__divider" /> : null}
                                <View className="dec-order-entry__item" onClick={() => handleEntryClick(item, index)}>
                                    <View className="dec-order-entry__icon-wrapper">
                                        {pickPic(item) ? (
                                            <TigImage className="dec-order-entry__icon-img" src={productImage(item)} mode="aspectFit" />
                                        ) : (
                                            <View className={`dec-order-entry__icon-default iconfont-h5 ${getDefaultIconClass(index)}`} />
                                        )}
                                        {getBadgeCount(index) > 0 ? (
                                            <View className="dec-order-entry__badge" style={badgeStyle}>
                                                {formatBadge(getBadgeCount(index))}
                                            </View>
                                        ) : null}
                                    </View>
                                    <View className="dec-order-entry__label">{safeT(item.picTitle)}</View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}