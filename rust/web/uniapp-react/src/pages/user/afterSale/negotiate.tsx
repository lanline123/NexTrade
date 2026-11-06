import { useEffect, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { viewRecordLog } from "@/api/user/afterSale";
import type { NegotiateItem } from "@/types/user/afterSale";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./negotiate.scss";

/**
 * 售后协商记录页（自旧 pages/user/afterSale/negotiate.vue 移植）
 * - 展示用户与客服的沟通记录（类聊天界面）
 * - 用户消息显示绿色背景，客服消息显示白色背景
 * - 支持发表新留言
 */
export default function AfterSaleNegotiate() {
    usePageGuards();
    const router = useRouter();

    const idRef = useRef<number | null>(null);
    const [infoData, setInfoData] = useState<NegotiateItem[]>([]);

    const getViewRecordLog = async (id: number) => {
        try {
            const result = await viewRecordLog(id);
            setInfoData(result);
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 onLoad：取路由 id 并拉取协商记录
    useEffect(() => {
        const id = Number((router.params || {}).id);
        if (id) {
            idRef.current = id;
            void getViewRecordLog(id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow 注册 / onUnload 注销 refreshNegotiate
    useEffect(() => {
        const handler = (data: number) => {
            idRef.current = data;
            void getViewRecordLog(data);
        };
        Taro.eventCenter.on("refreshNegotiate", handler);
        return () => {
            Taro.eventCenter.off("refreshNegotiate", handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLeaveMessage = () => {
        void Taro.navigateTo({
            url: `/pages/user/afterSale/leaveMessage?id=${idRef.current}`
        });
    };

    return (
        <View className="negotiate">
            <TigLayout title={t("协商记录")} safeTopBgColor="#f5f5f5">
                {infoData.length > 0 && (
                    <>
                        {infoData.map((item) => (
                            <View
                                key={item.logId}
                                className={`negotiate-item${item.userName ? " user" : ""}${item.adminName ? " store" : ""}`}
                            >
                                <View className="negotiate-item-title">
                                    <View className="negotiate-title-text">{item.adminName ? item.adminName : item.userName}</View>
                                    <View className="negotiate-title-time">{item.addTime}</View>
                                </View>
                                <View className="negotiate-item-content">
                                    <View className="negotiate-content-text"> {item.logInfo}</View>
                                    {item.returnPic && item.returnPic.length > 0 && (
                                        <View className="negotiate-pics">
                                            {item.returnPic.map((sunItem, index) => (
                                                <View key={index} className="pics-item">
                                                    <TigImage src={sunItem.picThumb} mode="aspectFill" />
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                                <View className="triangle" />
                            </View>
                        ))}
                        <View className="btn-fixed-placeholder">
                            <View className="btn-box" onClick={handleLeaveMessage}>
                                <Text className="iconfont-h5 icon-chat" style="font-size: 36rpx; color: #e9544d" />
                                <View className="btn-box-text">{t("发表留言")}</View>
                            </View>
                        </View>
                        <View className="btn-placeholder" />
                    </>
                )}
            </TigLayout>
        </View>
    );
}