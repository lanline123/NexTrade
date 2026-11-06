import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import TigUpload from "@/components/tig/tig-upload/TigUpload";
import { staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";

import "./index.scss";

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

/** 用户信息 V2（自旧 pages/member/components/decorate/userInfoV2/index.vue 移植） */
export default function UserInfoV2({ data = {} }: { data: ModuleDataWithFrame }) {
    const token = useUserStore((s) => s.token);
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const getUserInfo = useUserStore((s) => s.getUserInfo);

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));

    const cssVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 0,
        innerPadding: 16,
        boxPadding: 0,
        boxPaddingTop: 0,
        boxPaddingBottom: 0
    });

    const handleNavigate = (url: string) => {
        Taro.navigateTo({ url });
    };

    return (
        <View className="dec-user-info-v2" style={cssVars}>
            <View className="dec-user-info-v2__container">
                <View className="dec-user-info-v2__profile">
                    {!isLoggedIn ? (
                        <>
                            <View className="dec-user-info-v2__avatar" onClick={handleLogin}>
                                <View className="dec-user-info-v2__avatar-img">
                                    <TigImage src={staticResource("common/default-user.png")} mode="aspectFill" />
                                </View>
                            </View>
                            <View className="dec-user-info-v2__info" onClick={handleLogin}>
                                <View className="dec-user-info-v2__name">{t("登录")}</View>
                                <View className="dec-user-info-v2__desc">{t("为了获得最佳体验")}</View>
                            </View>
                        </>
                    ) : (
                        <>
                            <View className="dec-user-info-v2__avatar">
                                <TigUpload requestUrl="user/user/modifyAvatar" onChange={() => void getUserInfo()}>
                                    <TigImage className="dec-user-info-v2__avatar-img" src={imageFormat(userInfo.avatar)} mode="aspectFill" />
                                </TigUpload>
                            </View>
                            <View className="dec-user-info-v2__info">
                                <View className="dec-user-info-v2__name">{userInfo.nickname || userInfo.username}</View>
                                {userInfo.rankName ? (
                                    <View className="dec-user-info-v2__level" onClick={() => handleNavigate("/pages/user/levelCenter/index")}>
                                        {userInfo.rankLogo ? (
                                            <View className="dec-user-info-v2__level-icon">
                                                <TigImage src={userInfo.rankLogo} mode="scaleToFill" />
                                            </View>
                                        ) : null}
                                        <Text className="dec-user-info-v2__level-text">{safeT(userInfo.rankName)}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
}