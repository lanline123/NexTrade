import { useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useReachBottom } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getConversation, setRead } from "@/api/im/im";
import { getUnreadCount } from "@/api/user/user";
import { setAllMessageRead, updateOrderMessageRead } from "@/api/user/messageLog";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import ImNav from "./src/ImNav";

import "./page.scss";

/**
 * 消息页面（自旧 pages/im/page.vue 逐行移植）
 * - 消息中心展示
 * - 系统通知入口 + 会话列表和未读数
 */
export default function ImPage() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);

    const baseInfo = useConfigStore((s) => s.baseInfo);
    const token = Taro.getStorageSync("token");

    // 旧 reactive filterParams：原地维护分页字段
    const filterParamsRef = useRef({
        page: 1,
        size: 15
    });
    const filterParams = filterParamsRef.current;

    const [total, setTotal] = useState(0);
    const [isLoadEnd, setIsLoadEnd] = useState(false);
    const [msgList, setMsgList] = useState<any[]>([]);
    const [titleText, setTitleText] = useState<string>("");
    // 旧 systemMessages 上的 badge / dot 由未读数接口回填，这里拆成状态，等价于原地改写
    const [unread, setUnread] = useState({ orderMessageCount: 0, userMessageCount: 0 });

    // 镜像 total，供触底闭包读取（避免 React 陈旧闭包）
    const totalRef = useRef(0);

    const systemMessages = useMemo(
        () => [
            {
                title: t("订单通知"),
                icon: "im/order-notification.png",
                badge: unread.orderMessageCount > 999 ? 999 : unread.orderMessageCount,
                dot: false,
                path: "/pages/user/ordermessage/index",
                type: 1
            },
            {
                title: t("站内消息"),
                icon: "im/in-site-message.png",
                badge: 0,
                dot: unread.userMessageCount > 0,
                path: "/pages/user/messageLog/index",
                type: 2
            },
            { title: t("资讯中心"), icon: "im/consult.png", badge: 0, dot: false, path: "/pages/article/news/list?id=bzgg", type: 3 }
        ],
        [langCode, unread]
    );

    const _getConversation = async () => {
        try {
            const result: any = await getConversation(filterParams);
            setMsgList(result.records);
            setTotal(result.total);
            totalRef.current = result.total;
        } catch (error: any) {
            console.error(error);
        } finally {
            setIsLoadEnd(true);
        }
    };

    const handleLink = (item: any) => {
        if (item.unreadServantMessageCount && item.unreadServantMessageCount > 0) {
            void _setRead(item.shopId, item.lastServantId);
        }
        Taro.navigateTo({
            url: `/pages/im/index?token=${token}&shopId=${item.shopId}&conversationId=${item.conversationId}`
        });
    };

    const handleSystemClick = async (item: any) => {
        if (item.type == 1) {
            await updateOrderMessageRead();
        }
        Taro.navigateTo({
            url: item.path
        });
    };

    const handleReadAll = async () => {
        try {
            await setAllMessageRead();
            void _getUnreadCount();
            void _getConversation();
        } catch (error: any) {
            console.error(error);
        }
    };

    const getMessagePreview = (item: any) => {
        if (!item.lastMessage || item.lastMessage.length === 0) return "";
        const msg = item.lastMessage[0];
        if (msg.messageType == "text") {
            return msg.content.content.replace(/<[^>]+>/g, "");
        }
        return `[${msg.messageTypeText}]`;
    };

    const isOfficial = (item: any) => {
        return item.shopId == 0;
    };

    const formatTime = (timeStr: string) => {
        if (!timeStr) return "";
        const date = new Date(timeStr);
        const now = new Date();
        if (isNaN(date.getTime())) return timeStr;

        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

        if (isToday) {
            return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        } else {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
                return `${t("昨天")} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
            }
            return `${date.getMonth() + 1}-${date.getDate()}`;
        }
    };

    const _getUnreadCount = async () => {
        const result: any = await getUnreadCount();
        setUnread({ orderMessageCount: result.orderMessageCount, userMessageCount: result.userMessageCount });
        setTitleText(result.imMessageCount > 0 ? `${t("消息")}(${result.imMessageCount})` : t("消息"));
    };

    const _setRead = async (shopId: number, servantId: number) => {
        try {
            await setRead({
                shopId: shopId,
                servantId: servantId
            });
        } catch (error: any) {
            console.error(error);
        }
    };

    // 旧 onShow
    useDidShow(() => {
        void _getUnreadCount();
        void _getConversation();
    });

    // 旧 onReachBottom
    useReachBottom(() => {
        if (filterParams.page < Math.ceil(totalRef.current / filterParams.size)) {
            filterParams.page++;
            void _getConversation();
        }
    });

    // total 仅用于分页判断，保持与旧 state 一致的对外可读
    void total;

    return (
        <View className="page-content">
            <TigLayout background="#f6f6f6">
                <ImNav title={titleText} background="#f6f6f6" borderBottom={false} onReadAll={handleReadAll} />
                <View className="content-wrapper">
                    <View className="card system-card">
                        {systemMessages.map((sys, index) => (
                            <View className="system-item" key={index} onClick={() => handleSystemClick(sys)}>
                                <View className="icon-box">
                                    <Image className="icon-image" src={staticResource(sys.icon)} mode="aspectFit" />
                                    {(sys.badge > 0 || sys.dot) && (
                                        <View className={`sys-badge ${sys.dot ? "sys-badge--dot" : ""}`}>
                                            {!sys.dot && (sys.badge > 99 ? "99+" : sys.badge)}
                                        </View>
                                    )}
                                </View>
                                <View className="sys-content">
                                    <Text className="sys-title">{sys.title}</Text>
                                </View>
                                <View className="arrow-right" />
                            </View>
                        ))}
                    </View>
                    <View className="card chat-card">
                        {msgList.length > 0 &&
                            msgList.map((item: any, index: number) => (
                                <View className="chat-item" key={index} onClick={() => handleLink(item)}>
                                    <View className="avatar-box">
                                        <Image
                                            className="avatar"
                                            src={
                                                item.shop
                                                    ? staticResource(item.shop.shopLogo)
                                                    : imageFormat(baseInfo.icoImg) || staticResource("im/default_shop.png")
                                            }
                                            mode="aspectFit"
                                        />
                                        {(item.unreadServantMessageCount || 0) > 0 && (
                                            <View className="avatar-badge">
                                                {item.unreadServantMessageCount > 99 ? "99+" : item.unreadServantMessageCount}
                                            </View>
                                        )}
                                    </View>

                                    <View className="chat-content">
                                        <View className="top-row">
                                            <View className="name-box">
                                                <Text className="name">
                                                    {item.shop ? item.shop.shopTitle : baseInfo.shopTitle || t("平台自营")}
                                                </Text>
                                                {isOfficial(item) && <View className="official-tag">{t("官方")}</View>}
                                            </View>
                                            <Text className="time">{formatTime(item.lastUpdateTime)}</Text>
                                        </View>
                                        <View className="bottom-row">
                                            <Text className="msg-preview">{getMessagePreview(item)}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        {msgList.length === 0 && isLoadEnd && (
                            <View className="empty-box">
                                <EmptyBox mode="message" text={t("暂无消息")} />
                            </View>
                        )}
                    </View>
                </View>
            </TigLayout>
        </View>
    );
}