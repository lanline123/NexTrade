import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import { redirect } from "@/utils";
import { imageFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";

import "./index.scss";

interface WalletV2Item {
    key: string;
    label: string;
    icon?: { picUrl?: string };
}

interface MyWalletV2Data extends ModuleDataWithFrame {
    items?: WalletV2Item[];
}

const DEFAULT_ITEMS: WalletV2Item[] = [
    { key: "balance", label: "余额", icon: { picUrl: "" } },
    { key: "coupon", label: "优惠券", icon: { picUrl: "" } },
    { key: "collect", label: "商品收藏", icon: { picUrl: "" } },
    { key: "history", label: "浏览记录", icon: { picUrl: "" } }
];

const URL_MAP: Record<string, string> = {
    balance: "/pages/user/account/index",
    coupon: "/pages/coupon/index?type=2",
    collect: "/pages/user/collectProduct/index",
    history: "/pages/user/historyProduct/index"
};

const safeT = (val: unknown, fallback = "") => {
    if (typeof val === "string") {
        const key = val.trim();
        if (!key) return fallback;
        return t(key);
    }
    return fallback;
};

const formatMoney = (value: number | string): string => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
};

/** 我的钱包 V2（自旧 pages/member/components/decorate/myWalletV2/index.vue 移植） */
export default function MyWalletV2({ data = {} }: { data: MyWalletV2Data }) {
    const token = useUserStore((s) => s.token);
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const orderNum = (useUserStore((s) => s.orderNum) || {}) as Record<string, any>;

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));

    const displayItems = data?.items && data.items.length > 0 ? data.items : DEFAULT_ITEMS;

    const cssVars = useFrameVars(data, {
        backgroundColor: "#ffffff",
        boxRadius: 12,
        innerPadding: 12,
        boxPadding: 5,
        boxPaddingTop: 10,
        boxPaddingBottom: 0
    });

    const getItemValue = (key: string): string | number => {
        if (!isLoggedIn) return "";
        switch (key) {
            case "balance":
                return formatMoney(userInfo.totalBalance || userInfo.balance || 0);
            case "coupon":
                return userInfo.coupon || 0;
            case "collect":
                return orderNum.productCollect || 0;
            case "history":
                return "";
            default:
                return "";
        }
    };

    const handleCellClick = (key: string) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        if (URL_MAP[key]) {
            redirect({ url: URL_MAP[key] });
        }
    };

    return (
        <View className="dec-wallet-v2" style={cssVars}>
            <View className="dec-wallet-v2__container">
                <View className="dec-wallet-v2__grid">
                    {displayItems.map((item, index) => (
                        <View
                            className={[
                                "dec-wallet-v2__cell",
                                index < 2 ? "dec-wallet-v2__cell--border-bottom" : "",
                                index % 2 === 0 ? "dec-wallet-v2__cell--border-right" : ""
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            key={item.key}
                            onClick={() => handleCellClick(item.key)}
                        >
                            {item.icon?.picUrl ? (
                                <View className="dec-wallet-v2__icon">
                                    <TigImage src={imageFormat(item.icon.picUrl)} mode="aspectFit" />
                                </View>
                            ) : null}
                            <Text className="dec-wallet-v2__label">{safeT(item.label)}</Text>
                            <Text className="dec-wallet-v2__value">{getItemValue(item.key)}</Text>
                            <View className="dec-wallet-v2__arrow iconfont-h5 icon-a-gengduo20" />
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}