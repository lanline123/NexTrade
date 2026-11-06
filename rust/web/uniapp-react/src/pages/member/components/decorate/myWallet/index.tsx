import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";

import { redirect } from "@/utils";
import { imageFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./index.scss";

const DEFAULT_WALLET_ICON = "https://oss.tigshop.com/official/img/pc/202605/1779873859zO64yVrNvp2y0lUsOz.png";

const STAT_URL_MAP: Record<string, string> = {
    balance: "/pages/user/account/index",
    coupon: "/pages/coupon/index?type=2",
    point: "/pages/user/point/detail"
};

interface MyWalletData extends ModuleDataWithFrame {
    layoutStyle?: number;
    walletIcon?: { picUrl?: string };
}

const formatMoney = (value: number | string): string => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
};

/** 我的钱包（自旧 pages/member/components/decorate/myWallet/index.vue 移植） */
export default function MyWallet({ data = {} }: { data: MyWalletData }) {
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const token = useUserStore((s) => s.token);
    const integralName = useConfigStore((s) => s.integralName);

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));
    const currentLayoutStyle = data?.layoutStyle ?? 1;

    const walletIconUrl = data?.walletIcon?.picUrl ? imageFormat(data.walletIcon.picUrl) : DEFAULT_WALLET_ICON;

    const walletStats = {
        balance: userInfo.totalBalance || userInfo.balance || 0,
        couponCount: userInfo.coupon || 0,
        points: userInfo.points || 0
    };

    const cssVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 12,
        innerPadding: currentLayoutStyle === 1 ? 16 : 12,
        boxPadding: 5,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

    const handleWalletClick = () => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        redirect({ url: "/pages/user/account/index" });
    };

    const handleStatClick = (type: string) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        if (STAT_URL_MAP[type]) {
            redirect({ url: STAT_URL_MAP[type] });
        }
    };

    return (
        <View className={`dec-my-wallet dec-my-wallet--style${currentLayoutStyle}`} style={cssVars}>
            <View className="dec-my-wallet__container">
                {currentLayoutStyle === 1 ? (
                    <>
                        <View className="dec-my-wallet__header">
                            <View className="dec-my-wallet__title">{t("我的钱包")}</View>
                            <View className="dec-my-wallet__link" onClick={handleWalletClick}>
                                <Text>{t("进入钱包")}</Text>
                                <View className="dec-my-wallet__arrow iconfont icon-xiangyou" />
                            </View>
                        </View>
                        <View className="dec-my-wallet__stats dec-my-wallet__stats--block">
                            <View className="dec-my-wallet__stat-item" onClick={() => handleStatClick("balance")}>
                                <View className="dec-my-wallet__stat-value">{formatMoney(walletStats.balance)}</View>
                                <View className="dec-my-wallet__stat-label">{t("余额")}</View>
                            </View>
                            <View className="dec-my-wallet__stat-item" onClick={() => handleStatClick("coupon")}>
                                <View className="dec-my-wallet__stat-value">{walletStats.couponCount || 0}</View>
                                <View className="dec-my-wallet__stat-label">{t("优惠券")}</View>
                            </View>
                            <View className="dec-my-wallet__stat-item" onClick={() => handleStatClick("point")}>
                                <View className="dec-my-wallet__stat-value">{walletStats.points || 0}</View>
                                <View className="dec-my-wallet__stat-label">{t(integralName || "积分")}</View>
                            </View>
                        </View>
                    </>
                ) : (
                    <>
                        <View className="dec-my-wallet__icon-section" onClick={handleWalletClick}>
                            <View className="dec-my-wallet__icon">
                                <TigImage src={walletIconUrl} mode="aspectFit" />
                            </View>
                            <Text className="dec-my-wallet__icon-label">{t("我的钱包")}</Text>
                        </View>
                        <View className="dec-my-wallet__divider" />
                        <View className="dec-my-wallet__stats">
                            <View className="dec-my-wallet__stat" onClick={() => handleStatClick("balance")}>
                                <Text className="dec-my-wallet__value">{formatMoney(walletStats.balance)}</Text>
                                <Text className="dec-my-wallet__label">{t("余额")}</Text>
                            </View>
                            <View className="dec-my-wallet__stat" onClick={() => handleStatClick("coupon")}>
                                <Text className="dec-my-wallet__value">{walletStats.couponCount || 0}</Text>
                                <Text className="dec-my-wallet__label">{t("优惠券")}</Text>
                            </View>
                            <View className="dec-my-wallet__stat" onClick={() => handleStatClick("point")}>
                                <Text className="dec-my-wallet__value">{walletStats.points || 0}</Text>
                                <Text className="dec-my-wallet__label">{t(integralName || "积分")}</Text>
                            </View>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}