import { useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Swipe } from "@nutui/nutui-react-taro";

import LoadingBox from "@/components/loading-box";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { addMessageAllRead, addMessageRead, delMessage, getMessageList } from "@/api/user/messageLog";
import useList from "@/hooks/useList";
import { useI18nStore } from "@/store/i18n";
import type { UserMsgFilterParams, UserMsgFilterState } from "@/types/user/messageLog";
import { redirect, staticResource } from "@/utils";
import { urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 站内信列表页（自旧 pages/user/messageLog/index.vue 逐行移植）
 * - 全部消息 / 只看未读 Tab 切换
 * - 支持一键已读
 * - 左滑删除消息
 * - 点击消息标记已读并跳转链接
 */
export default function MessageLog() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    // 旧 reactive filterParams：与 useList 共享同一份对象并原地改写
    const filterParams = useRef<UserMsgFilterParams>({
        // 初始化用于查询的参数
        page: 1,
        size: 10,
        unread: 0
    }).current;

    const {
        data: messageList,
        isLoading,
        isLoadMore,
        total,
        resetState,
        getList
    } = useList<UserMsgFilterState>(getMessageList as any, {
        params: filterParams,
        path: {
            dataKey: "records"
        },
        immediate: true
    });

    // 旧实现直接改 data.isRead（Vue 响应式），React 用覆盖表保持同样的未读点显隐
    const [readIds, setReadIds] = useState<Record<number, number>>({});

    const __delMessage = (id: number, index: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确定删除此条站内信吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    void deleteMsg(id, index);
                }
            }
        });
    };

    const deleteMsg = async (id: number, index: number) => {
        void index;
        try {
            await delMessage({ id: id });
            resetState();
            await getList();
            Taro.showToast({
                title: t("删除成功"),
                icon: "none"
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const __addMessageRead = async (data: UserMsgFilterState) => {
        try {
            if (data.isRead !== 1) {
                await addMessageRead(data.messageId);
                setReadIds((prev) => ({ ...prev, [data.messageId]: 1 }));
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

    const addMessageAllReadFn = async () => {
        if (isLoading || isLoadMore) return;
        try {
            await addMessageAllRead();
            filterParams.unread = 0;
            resetState();
            await getList();
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const readReadFn = async (type: number) => {
        if (isLoading || isLoadMore) return;
        filterParams.unread = type;
        try {
            resetState();
            await getList();
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    return (
        <TigLayout title={t("站内信")}>
            <View className="message-main" data-panel-rev="bHcyMjgyc2E">
                <View className="head-tabs-box">
                    <View className="tabs flex align-center justify-between">
                        <View className="flex align-end">
                            <View className={`tab${filterParams.unread === 0 ? " active" : ""}`} onClick={() => readReadFn(0)}>
                                {t("全部消息")}
                            </View>
                            <View className={`tab${filterParams.unread === 1 ? " active" : ""}`} onClick={() => readReadFn(1)}>
                                {t("只看未读")}
                            </View>
                        </View>
                        <View className="clear-unread flex align-end" onClick={addMessageAllReadFn}>
                            <Text>{t("一键已读")}</Text>
                            <Text className="iconfont-h5 icon-auth" style="font-size: 36rpx; color: #999" />
                        </View>
                    </View>
                </View>
                {messageList.length > 0 && (
                    <View className="messages-list">
                        {messageList.map((item, index) => (
                            <View className="move-item" key={item.messageId}>
                                <Swipe
                                    name={item.messageId}
                                    rightAction={
                                        <View className="message-move-box">
                                            <View className="btn-del" onClick={() => __delMessage(item.messageId, index)}>
                                                <Text>{t("删除")}</Text>
                                            </View>
                                        </View>
                                    }
                                >
                                    <View className="mitem" onClick={() => __addMessageRead(item)}>
                                        <View className="message">
                                            <View className="title">
                                                {item.isRead === 0 && !readIds[item.messageId] && <Text className="dot" />}
                                                <Text>{item.title}</Text>
                                            </View>
                                            <View className="txt">{item.content}</View>
                                            <View className="time">{item.addTime}</View>
                                        </View>
                                    </View>
                                </Swipe>
                            </View>
                        ))}
                    </View>
                )}
                {!isLoading && total === 0 && (
                    <View className="empty-box">
                        <View className="pictrue">
                            <Image src={staticResource("common/data_empty.png")} />
                        </View>
                        <View className="txt">{t("暂无站内消息！")}</View>
                    </View>
                )}
                <LoadingBox modelValue={!isLoading} page={filterParams.page} length={messageList.length} />
            </View>
        </TigLayout>
    );
}