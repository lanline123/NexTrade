import { useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useReachBottom } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getConversation } from "@/api/im/im";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import EmojiHtml from "./src/EmojiHtml";

import "./list.scss";

/**
 * 消息列表页（自旧 pages/im/list.vue 逐行移植）
 * - 展示所有聊天会话列表
 * - 显示未读消息数和最新消息
 */
export default function ImList() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const baseInfo = useConfigStore((s) => s.baseInfo);

    // 旧 reactive filterParams：原地维护分页字段
    const filterParamsRef = useRef({
        page: 1,
        size: 15
    });
    const filterParams = filterParamsRef.current;

    const [total, setTotal] = useState(0);
    const [isLoadEnd, setIsLoadEnd] = useState(false);
    const [msgList, setMsgList] = useState<any[]>([]);

    // 镜像 total，供触底闭包读取（避免 React 陈旧闭包）
    const totalRef = useRef(0);

    const _getConversation = async () => {
        try {
            const result: any = await getConversation(filterParams);
            setMsgList(result.records);
            setTotal(result.total);
            totalRef.current = result.total;
        } catch (error: any) {
            // 旧实现吞掉异常，保持一致
        } finally {
            setIsLoadEnd(true);
        }
    };

    const handleLink = (url: string) => {
        Taro.navigateTo({
            url: url
        });
    };

    // 旧 onShow
    useDidShow(() => {
        void _getConversation();
    });

    // 旧 onReachBottom
    useReachBottom(() => {
        if (filterParams.page < Math.ceil(totalRef.current / filterParams.size)) {
            filterParams.page++;
            void _getConversation();
        }
    });

    return (
        <View className="page-content">
            <TigLayout title={t("消息列表")}>
                <View className="thanos-layout conversation-list-layout">
                    <View className="thanos-layout-main-content">
                        <View className="thanos-waterfall conversation-list-wrap">
                            {msgList.length > 0 &&
                                msgList.map((item: any, index: number) => (
                                    <View className="main-list" key={index}>
                                        <View
                                            className="wapim-conversation-item"
                                            onClick={() =>
                                                handleLink(`/pages/im/index?shopId=${item.shopId}&conversationId=${item.conversationId}`)
                                            }
                                        >
                                            <View className="bg-pic circle-bg-pic thanos-figure thanos-hairline--surround conversation-figure">
                                                <View
                                                    className="bg-pic-content"
                                                    style={{
                                                        backgroundImage: `url(${
                                                            item.shop ? imageFormat(item.shop.shopLogo) : imageFormat(baseInfo.icoImg)
                                                        })`
                                                    }}
                                                />
                                            </View>
                                            <View className="wapim-conversation-item-content thanos-hairline--bottom">
                                                <View className="shop-name thanos-ellipsis">
                                                    {item.shop ? item.shop.shopTitle : baseInfo.shopTitle}
                                                </View>
                                                {item.lastMessage[0].messageType == "text" ? (
                                                    <View className="last-message thanos-ellipsis">
                                                        <EmojiHtml className="ellipsis" content={item.lastMessage[0].content.content} />
                                                    </View>
                                                ) : (
                                                    <View className="last-message thanos-ellipsis">[{item.lastMessage[0].messageTypeText}]</View>
                                                )}
                                            </View>
                                            <View className="wapim-conversation-item-right">
                                                <Text className="last-time">{item.lastUpdateTime}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            {msgList.length === 0 && isLoadEnd && (
                                <View className="thanos-waterfall-finish-desc">{t("已经没有更多消息了")}</View>
                            )}
                        </View>
                    </View>
                </View>
            </TigLayout>
        </View>
    );
}