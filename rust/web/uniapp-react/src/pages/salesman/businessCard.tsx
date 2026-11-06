import { useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./businessCard.scss";

/**
 * 分销员名片页（自旧 pages/salesman/businessCard.vue 逐行移植）
 * - 展示分销员电子名片
 * - 显示用户信息
 */
export default function SalesmanBusinessCard() {
    usePageGuards();

    const [userInfo, setUserInfo] = useState<any>({});

    // 旧 onShow
    useDidShow(() => {
        setUserInfo(Taro.getStorageSync("userInfo") || {});
    });

    const handleLink = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    return (
        <View>
            <TigLayout title={t("我的名片")} safeTopBgColor="#f5f5f5">
                <View className="my-card">
                    <View className="my-card--info-wrap">
                        <View className="user-info-card">
                            <View className="user-info-card--info-wrap van-hairline--bottom">
                                <View className="user-info-card--avatar-wrap">
                                    <View
                                        className="avatar avatar--type-image avatar--size-default avatar--shape-circle"
                                        style={{ width: "96px", height: "96px" }}
                                    >
                                        <TigImage src={userInfo.avatar} className="avatar-image" />
                                    </View>
                                </View>
                                <View className="user-info-card--info-intr">
                                    <View className="user-info-card--section">
                                        <View className="user-info-card--info-intr-name">
                                            <Text>{userInfo.mobile}</Text>
                                        </View>
                                        <View className="user-info-card--info-intr-office">
                                            <Text>{userInfo.nickname}</Text>
                                        </View>
                                    </View>
                                    {/* 旧模板中「微信」行已注释 */}
                                </View>
                            </View>
                            <View
                                className="van-cell van-cell--clickable user-info-card--cell-wrap"
                                role="button"
                                {...({ tabIndex: 0 } as any)}
                                onClick={() => handleLink("/pages/salesman/businessCardExternal")}
                            >
                                <View className="van-cell__title gray-color">
                                    <Text>{t("对外名片")}</Text>
                                </View>
                                <View className="van-cell__value qr-icon">
                                    <View className="iconfont-h5 icon-erweima" />
                                    <Text className="iconfont-h5 icon-xiangyou qr-arrow" />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </TigLayout>
        </View>
    );
}