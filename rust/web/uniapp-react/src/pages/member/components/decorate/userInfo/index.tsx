import { useEffect } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigAuthBadge from "@/components/tig/tig-auth-badge/TigAuthBadge";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigUpload from "@/components/tig/tig-upload/TigUpload";
import { isMerchant, isO2o, isPro, redirect, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrame, useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./index.scss";

interface ShortcutItem {
    show?: boolean;
    icon?: { picUrl?: string };
    title?: string;
}

interface GradientConfig {
    colorA?: string;
    colorB?: string;
}

interface UserInfoData extends ModuleDataWithFrame {
    signIn?: ShortcutItem;
    settings?: ShortcutItem;
    gradient?: GradientConfig;
}

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

const FRAME_DEFAULTS = {
    backgroundColor: "",
    boxRadius: 0,
    innerPadding: 16,
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0
};

const DEFAULT_GRADIENT = { colorA: "#fcf6fc", colorB: "#f3f3fe" };

/** 用户信息（自旧 pages/member/components/decorate/userInfo/index.vue 移植） */
export default function UserInfo({ data = {} }: { data: UserInfoData }) {
    const token = useUserStore((s) => s.token);
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const orderNum = (useUserStore((s) => s.orderNum) || {}) as Record<string, any>;
    const getUserInfo = useUserStore((s) => s.getUserInfo);
    const getOrderNum = useUserStore((s) => s.getOrderNum);
    const closeAuth = useConfigStore((s) => s.closeAuth);
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));

    const userStats = {
        collectProduct: orderNum.productCollect || 0,
        collectShop: orderNum.shopCollect || 0,
        awaitComment: orderNum.awaitComment || 0,
        history: orderNum.historyProductCount || 0
    };

    const showCollectShop = isMerchant() || isO2o();
    const showSignIn = data?.signIn?.show === false ? false : Boolean(userInfo?.showSign);

    const baseVars = useFrameVars(data, FRAME_DEFAULTS);
    const gradient = data?.gradient || {};
    const cssVars = {
        ...baseVars,
        "--dec-gradient-a": gradient.colorA || DEFAULT_GRADIENT.colorA,
        "--dec-gradient-b": gradient.colorB || DEFAULT_GRADIENT.colorB
    };
    const frame = useFrame(data, FRAME_DEFAULTS);
    const hasCustomBg = Boolean(frame.backgroundColor);

    // 对应旧 watch(isLoggedIn, { immediate: true })
    useEffect(() => {
        if (isLoggedIn) {
            void getOrderNum();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    const handleShortcutClick = (kind: "signIn" | "settings") => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        if (kind === "signIn") {
            redirect({ url: "/pages/user/sign/index" });
            return;
        }
        if (kind === "settings") {
            redirect({ url: "/pages/user/profile/index" });
        }
    };

    const handleStatClick = (type: string) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        const urlMap: Record<string, string> = {
            collectProduct: "/pages/user/collectProduct/index",
            collectShop: "/pages/user/collectionShop/index",
            awaitComment: "/pages/user/comment/list",
            history: "/pages/user/historyProduct/index"
        };
        if (urlMap[type]) {
            redirect({ url: urlMap[type] });
        }
    };

    const goPages = (url: string) => {
        Taro.navigateTo({ url });
    };

    return (
        <View className={`dec-user-info${hasCustomBg ? " dec-user-info--has-bg" : ""}`} style={cssVars as any}>
            <View className="dec-user-info__container">
                <View className="dec-user-info__header">
                    <View className="dec-user-info__profile">
                        {!isLoggedIn ? (
                            <>
                                <View className="dec-user-info__avatar" onClick={handleLogin}>
                                    <View className="dec-user-info__avatar-img">
                                        <TigImage src={staticResource("common/empty-img-bg3.png")} mode="aspectFill" />
                                    </View>
                                </View>
                                <View className="dec-user-info__info" onClick={handleLogin}>
                                    <View className="dec-user-info__name">{t("登录/注册")}</View>
                                </View>
                            </>
                        ) : (
                            <>
                                <View className="dec-user-info__avatar">
                                    <TigUpload requestUrl="user/user/modifyAvatar" onChange={() => void getUserInfo()}>
                                        <TigImage className="dec-user-info__avatar-img" src={imageFormat(userInfo.avatar || "")} mode="aspectFill" />
                                    </TigUpload>
                                </View>
                                <View className="dec-user-info__info">
                                    <View className="dec-user-info__name-row">
                                        {closeAuth === 1 ? (
                                            <View className="dec-user-info__auth" onClick={() => goPages("/pages/user/userCertification/index")}>
                                                <TigAuthBadge verified={!!userInfo.isCompanyAuth} />
                                            </View>
                                        ) : null}
                                        <Text className="dec-user-info__name">{userInfo.nickname || userInfo.username}</Text>
                                    </View>
                                    <View className="dec-user-info__level" onClick={() => isPro() && goPages("/pages/user/levelCenter/index")}>
                                        {isPro() && userInfo.rankLogo ? (
                                            <View className="dec-user-info__level-icon">
                                                <TigImage src={userInfo.rankLogo} mode="scaleToFill" />
                                            </View>
                                        ) : null}
                                        <Text className="dec-user-info__level-text">{safeT(userInfo.rankName)}</Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>

                    {isLoggedIn ? (
                        <View className="dec-user-info__shortcuts">
                            {showSignIn ? (
                                <View className="dec-user-info__shortcut-item" onClick={() => handleShortcutClick("signIn")}>
                                    {data.signIn?.icon?.picUrl ? (
                                        <TigImage className="dec-user-info__shortcut-icon" src={imageFormat(data.signIn.icon.picUrl)} />
                                    ) : (
                                        <View className="dec-user-info__shortcut-iconfont iconfont icon-qiandao" />
                                    )}
                                    <Text className="dec-user-info__shortcut-text">{safeT(data.signIn?.title, t("签到有礼"))}</Text>
                                </View>
                            ) : null}

                            {data.settings?.show !== false ? (
                                <View className="dec-user-info__shortcut-item dec-user-info__settings" onClick={() => handleShortcutClick("settings")}>
                                    {data.settings?.icon?.picUrl ? (
                                        <TigImage className="dec-user-info__shortcut-icon" src={imageFormat(data.settings.icon.picUrl)} />
                                    ) : (
                                        <View className="dec-user-info__shortcut-iconfont iconfont-h5 icon-shezhi" />
                                    )}
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </View>

                {isLoggedIn ? (
                    <View className="dec-user-info__stats" data-panel-rev="MjI4MmlnZGU">
                        <View className="dec-user-info__stat-item" onClick={() => handleStatClick("collectProduct")}>
                            <Text className="dec-user-info__stat-label">{t("商品收藏")}</Text>
                            <Text className="dec-user-info__stat-value">{userStats.collectProduct || 0}</Text>
                        </View>
                        {showCollectShop ? (
                            <>
                                <View className="dec-user-info__stat-divider" />
                                <View className="dec-user-info__stat-item" onClick={() => handleStatClick("collectShop")}>
                                    <Text className="dec-user-info__stat-label">{t(isO2o() ? "门店关注" : "店铺收藏")}</Text>
                                    <Text className="dec-user-info__stat-value">{userStats.collectShop || 0}</Text>
                                </View>
                            </>
                        ) : null}
                        {productCommentEnabled === 1 ? (
                            <>
                                <View className="dec-user-info__stat-divider" />
                                <View className="dec-user-info__stat-item" onClick={() => handleStatClick("awaitComment")}>
                                    <Text className="dec-user-info__stat-label">{t("待评价")}</Text>
                                    <Text className="dec-user-info__stat-value">{userStats.awaitComment || 0}</Text>
                                </View>
                            </>
                        ) : null}
                        <View className="dec-user-info__stat-divider" />
                        <View className="dec-user-info__stat-item" onClick={() => handleStatClick("history")}>
                            <Text className="dec-user-info__stat-label">{t("浏览记录")}</Text>
                            <Text className="dec-user-info__stat-value">{userStats.history || 0}</Text>
                        </View>
                    </View>
                ) : null}
            </View>
        </View>
    );
}