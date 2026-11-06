import { useRef } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import { addMessageRead, getMessageList } from "@/api/user/messageLog";
import type { UserMsgFilterState } from "@/types/user/messageLog";
import useList from "@/hooks/useList";
import { redirect, staticResource } from "@/utils";
import { productImage, urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 订单通知消息列表页（自旧 pages/user/ordermessage/index.vue 移植）
 * - 展示与订单相关的通知消息
 * - 显示店铺信息、订单状态、商品图片
 * - 点击查看详情跳转对应链接
 */
export default function OrderMessageIndex() {
    usePageGuards();

    // 格式化时间显示：今天、昨天或原始时间
    const formatTime = (dateStr: string): string => {
        if (!dateStr) return "";

        const inputDate = new Date(dateStr.replace(/-/g, "/"));
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // 获取日期部分进行比较（去掉时分秒）
        const inputDateStr = inputDate.toDateString();
        const todayStr = today.toDateString();
        const yesterdayStr = yesterday.toDateString();

        if (inputDateStr === todayStr) {
            return t("今天");
        } else if (inputDateStr === yesterdayStr) {
            return t("昨天");
        }
        return dateStr;
    };

    const filterParams = useRef({
        // 初使化用于查询的参数
        page: 1,
        size: 10,
        unread: 0,
        type: 1
    });

    const { data: messageList, isLoading } = useList<UserMsgFilterState>(getMessageList as any, {
        params: filterParams.current,
        path: {
            dataKey: "records"
        },
        immediate: true
    });

    const __addMessageRead = async (data: UserMsgFilterState) => {
        try {
            if (data.isRead !== 1) {
                await addMessageRead(data.messageId);
                data.isRead = 1;
            }

            redirect({
                url: urlFormat(data.link as any)
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    return (
        <View className="page-content">
            {/* 旧 tig-layout title="" 时内部不渲染 navbar（v-if="title"），此处等价省略页头，保留内部 tig-navbar */}
            <TigLayout>
                <TigNavbar title={t("订单通知")} />
                <View className="msg-list">
                    {messageList.map((item, index) => (
                        <View key={index} className="msg-item" onClick={() => void __addMessageRead(item)}>
                            <View className="header">
                                <View className="store-info">
                                    {(item.orderInfo as any)?.shop ? (
                                        <Image
                                            className="avatar"
                                            src={(item.orderInfo as any)?.shop.shopLogo || staticResource("im/self_shop.png")}
                                            mode="aspectFill"
                                        />
                                    ) : (
                                        <Image className="avatar" src={staticResource("im/default_shop.png")} mode="aspectFill" />
                                    )}
                                    {(item.orderInfo as any)?.shop ? (
                                        <Text className="name">{t((item.orderInfo as any)?.shop.shopTitle)}</Text>
                                    ) : (
                                        <Text className="name">{t(item.orderInfo?.shopName || "平台自营")}</Text>
                                    )}
                                </View>
                                {item.addTime && <Text className="time">{formatTime(item.addTime)}</Text>}
                            </View>

                            <View className="content">
                                <View className="info">
                                    <View className="msg-title">{item.title}</View>
                                    <View className="row">
                                        <Text className="label">{t("店铺名称")}</Text>
                                        {(item.orderInfo as any)?.shop ? (
                                            <Text className="name">{t((item.orderInfo as any)?.shop.shopTitle)}</Text>
                                        ) : (
                                            <Text className="name">{t(item.orderInfo?.shopName || "平台自营")}</Text>
                                        )}
                                    </View>
                                    <View className="row">
                                        <Text className="label">{t("订单状态")}</Text>
                                        <Text className="value">{item.orderInfo?.orderStatusName}</Text>
                                    </View>
                                </View>
                                <Image className="product-img" src={productImage(item?.orderInfo?.items?.[0])} mode="aspectFill" />
                            </View>

                            <View className="footer">
                                <View className="btn" onClick={() => void __addMessageRead(item)}>
                                    {t("查看详情")}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {messageList.length === 0 && !isLoading && (
                    <View className="empty-box">
                        <EmptyBox mode="message" text={t("暂无消息")} />
                    </View>
                )}
            </TigLayout>
        </View>
    );
}