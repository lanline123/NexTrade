import { useEffect, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigAuthBadge from "@/components/tig/tig-auth-badge/TigAuthBadge";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigUpload from "@/components/tig/tig-upload/TigUpload";
import { getUserLevelList } from "@/api/user/levelCenter";
import { isMerchant, isO2o, isOverseas, isPro, redirect, staticResource } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";
import { handleLogin } from "@/utils/handleLogin";
import { useFrameVars, type ModuleDataWithFrame } from "@/utils/decorateFrame";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
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

interface ShortcutItem {
    show?: boolean;
    icon?: { picUrl?: string };
    title?: string;
}

interface GradientConfig {
    colorA?: string;
    colorB?: string;
    gradientType?: string;
}

interface StatsItem {
    key: string;
    label: string;
    show?: boolean;
}

interface MemberBarConfig {
    show?: boolean;
    backgroundColor?: string;
    backgroundColorB?: string;
    borderRadius?: number;
    levelName?: string;
    description?: string;
    buttonText?: string;
    buttonLink?: { link?: string; [key: string]: any };
    waveImage?: { picUrl?: string };
}

interface BottomArcConfig {
    show?: boolean;
    height?: number;
}

interface TextColorsConfig {
    nameColor?: string;
    subColor?: string;
    statValueColor?: string;
    statLabelColor?: string;
}

interface UserInfoData extends ModuleDataWithFrame {
    layoutStyle?: number;
    showEditIcon?: boolean;
    signIn?: ShortcutItem;
    settings?: ShortcutItem;
    notification?: ShortcutItem;
    gradient?: GradientConfig;
    bgColor?: string;
    backgroundImage?: { picUrl?: string };
    backgroundImageShow?: boolean;
    bottomArc?: BottomArcConfig;
    memberBar?: MemberBarConfig;
    stats?: { show?: boolean; items?: StatsItem[] };
    textColors?: TextColorsConfig;
}

const EDIT_ICON = "https://oss.tigshop.com/official/img/pc/202606/1780880709E3AknH2icO6fSZeMly.png";
const DEFAULT_GROWTH_CARD_BG = "https://oss.tigshop.com/official/img/pc/202606/17808830195Hk80LmOeUpDCCCEKW.png";

const STYLE_TEXT_COLOR_DEFAULTS: Record<number, Required<TextColorsConfig>> = {
    1: { nameColor: "#ffffff", subColor: "#ffffff", statValueColor: "#ffffff", statLabelColor: "#ffffff" },
    2: { nameColor: "#333333", subColor: "#666666", statValueColor: "#333333", statLabelColor: "#666666" },
    3: { nameColor: "#333333", subColor: "#666666", statValueColor: "#333333", statLabelColor: "#666666" },
    4: { nameColor: "#333333", subColor: "#666666", statValueColor: "#333333", statLabelColor: "#666666" }
};

const FRAME_DEFAULTS = {
    backgroundColor: "",
    boxRadius: 0,
    innerPadding: 16,
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0
};

const STYLE_GRADIENT_DEFAULTS: Record<number, { colorA: string; colorB: string }> = {
    1: { colorA: "#57D45C", colorB: "#34C759" },
    2: { colorA: "#E0FCED", colorB: "#FDF1F3" },
    3: { colorA: "#F1EFE9", colorB: "#E7F0E6" },
    4: { colorA: "#FBD9E1", colorB: "#FDEDEF" }
};

// 顶部背景渐变方向映射
const GRADIENT_DIR_MAP: Record<string, string> = {
    upDown: "to bottom",
    leftRight: "to right",
    diagonal: "135deg"
};

const STAT_URL_MAP: Record<string, string> = {
    collect: "/pages/user/collectProduct/index",
    follow: "/pages/user/collectionShop/index",
    history: "/pages/user/historyProduct/index"
};

/**
 * 用户信息3（自旧 pages/member/components/decorate/userInfo3/index.vue 移植）
 * 四种布局：1 弧形绿底 / 2 浅色图标 / 3 极简成长 / 4 居中头像 + 成长卡
 */
export default function UserInfo3({ data = {}, immersive = false }: { data: UserInfoData; immersive?: boolean }) {
    const token = useUserStore((s) => s.token);
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const orderNum = (useUserStore((s) => s.orderNum) || {}) as Record<string, any>;
    const getUserInfo = useUserStore((s) => s.getUserInfo);
    const getOrderNum = useUserStore((s) => s.getOrderNum);
    const closeAuth = useConfigStore((s) => s.closeAuth);
    const commonHeaderHeight = useConfigStore((s) => (s as any).commonHeaderHeight);

    const [upgradeText, setUpgradeText] = useState("");

    const isLoggedIn = Boolean(token || Taro.getStorageSync("token"));
    const layoutStyle = data?.layoutStyle ?? 1;
    const layoutClass = [`dec-user-info--style${layoutStyle}`, immersive ? "dec-user-info--immersive" : ""].filter(Boolean).join(" ");

    /** 沉浸式渐变向上延伸的高度：跨境为外贸头实测高度，国内为导航栏 */
    const headerOffsetValue = isOverseas() ? `${commonHeaderHeight || 0}px` : "var(--nav-height, 0px)";

    const defaults = STYLE_TEXT_COLOR_DEFAULTS[layoutStyle] || STYLE_TEXT_COLOR_DEFAULTS[1];
    const tc = data?.textColors;
    const resolvedTextColors = {
        nameColor: tc?.nameColor || defaults.nameColor,
        subColor: tc?.subColor || defaults.subColor,
        statValueColor: tc?.statValueColor || defaults.statValueColor,
        statLabelColor: tc?.statLabelColor || defaults.statLabelColor
    };

    const DEFAULT_STATS: StatsItem[] = [
        { key: "collect", label: "商品收藏", show: true },
        { key: "follow", label: isO2o() ? t("门店关注") : t("店铺收藏"), show: true },
        { key: "history", label: "浏览记录", show: true }
    ];

    const cssVars = useFrameVars(data, FRAME_DEFAULTS);

    const containerPaddingStyle = {
        paddingLeft: `${(data?.frame?.innerPadding ?? 16) * 2}rpx`,
        paddingRight: `${(data?.frame?.innerPadding ?? 16) * 2}rpx`
    };

    const style1WrapStyle = (() => {
        const styles: Record<string, string> = {};
        const g = data?.gradient || {};
        const legacy = data?.bgColor;
        const d = STYLE_GRADIENT_DEFAULTS[1];
        const colorA = legacy || g.colorA || d.colorA;
        const colorB = legacy || g.colorB || d.colorB;
        const dir = GRADIENT_DIR_MAP[g.gradientType || "leftRight"] || "to right";
        const grad = `linear-gradient(${dir}, ${colorA}, ${colorB})`;
        if (data?.backgroundImageShow !== false && data?.backgroundImage?.picUrl) {
            styles.backgroundImage = `url(${data.backgroundImage.picUrl}), ${grad}`;
            styles.backgroundSize = "cover";
            styles.backgroundPosition = "center";
        } else {
            styles.background = grad;
        }
        return styles;
    })();

    const gradientWrapStyle = (() => {
        if (layoutStyle !== 2 && layoutStyle !== 3) return {};
        const d = STYLE_GRADIENT_DEFAULTS[layoutStyle] || STYLE_GRADIENT_DEFAULTS[2];
        // 沉浸式：渐变由页面容器统一绘制并延伸到下方模块，组件自身保持透明，避免双层叠加
        if (immersive) return {};
        const g = data?.gradient || {};
        const colorA = g.colorA || d.colorA;
        const colorB = g.colorB || d.colorB;
        const dir = GRADIENT_DIR_MAP[g.gradientType || "leftRight"] || "to right";
        return { background: `linear-gradient(${dir}, ${colorA}, ${colorB})` };
    })();

    const showMemberBar = data?.memberBar?.show !== false;

    const memberBarStyle = (() => {
        const bar = data?.memberBar;
        const r = bar?.borderRadius ?? 8;
        const styles: Record<string, string> = { borderRadius: `${r * 2}rpx ${r * 2}rpx 0 0` };
        if (layoutStyle === 3) {
            const colorA = bar?.backgroundColor || "#292929";
            const colorB = bar?.backgroundColorB || "#525252";
            styles.background = `linear-gradient(to right, ${colorA}, ${colorB})`;
        } else {
            styles.backgroundColor = bar?.backgroundColor || "#333";
        }
        return styles;
    })();

    // --- Style 4: 居中头像 + 成长值卡 ---
    const showEditIcon = data?.showEditIcon !== false;

    // 样式四背景渐变：独立图层，仅覆盖到成长值卡片的一半高度；无卡片时覆盖头部
    // bottom 值 = 成长值卡 margin-bottom(20rpx) + 卡片高度(156rpx)的一半(78rpx) = 98rpx
    const style4GradStyle = (() => {
        const d = STYLE_GRADIENT_DEFAULTS[4];
        const g = data?.gradient || {};
        const colorA = g.colorA || d.colorA;
        const colorB = g.colorB || d.colorB;
        const dir = GRADIENT_DIR_MAP[g.gradientType || "leftRight"] || "to right";
        const hasCard = isLoggedIn && showMemberBar;
        return {
            position: "absolute" as const,
            left: "0",
            right: "0",
            top: immersive ? `calc(-1 * ${headerOffsetValue})` : "0",
            bottom: hasCard ? "98rpx" : "0",
            background: `linear-gradient(${dir}, ${colorA}, ${colorB})`,
            zIndex: "0"
        };
    })();

    const growthBtnText = data?.memberBar?.buttonText || t("查看");
    const growthWaveUrl = data?.memberBar?.waveImage?.picUrl || DEFAULT_GROWTH_CARD_BG;

    const growthCardStyle = (() => {
        const bar = data?.memberBar;
        const r = bar?.borderRadius ?? 12;
        const colorA = bar?.backgroundColor || "#FF9EB5";
        const colorB = bar?.backgroundColorB || "#FF6E97";
        return { borderRadius: `${r * 2}rpx`, background: `linear-gradient(135deg, ${colorA}, ${colorB})` };
    })();

    const showBottomArc = layoutStyle === 1 && data?.bottomArc?.show !== false;

    const arcHeight = data?.bottomArc?.height ?? 24;
    const arcStyle = { height: `${arcHeight * 2}rpx` };

    const arcDataUrl = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 ${arcHeight}" preserveAspectRatio="none"><path d="M 0 0 Q 187.5 ${arcHeight * 1.4} 375 0 L 375 ${arcHeight} L 0 ${arcHeight} Z" fill="#f5f5f5"/></svg>`
    )}`;

    const showStats = data?.stats?.show !== false;

    const visibleStats = (() => {
        const items = data?.stats?.items || DEFAULT_STATS;
        const followLabel = isO2o() ? "门店关注" : "店铺收藏";
        // 单商户版无「门店关注/店铺收藏」入口，与 userInfo 模块口径一致
        return items
            .filter((item) => item.show !== false && (item.key !== "follow" || isMerchant() || isO2o()))
            .map((item) => {
                // 融合版：默认「门店关注/店铺收藏」文案按 TARO_APP_IS_STORE 覆盖，后台自定义文案保留
                if (item.key === "follow" && (!item.label || item.label === "门店关注" || item.label === "店铺关注" || item.label === "店铺收藏")) {
                    return { ...item, label: followLabel };
                }
                return item;
            });
    })();

    const getStatValue = (key: string): string | number => {
        if (!isLoggedIn) return "—";
        switch (key) {
            case "collect":
                return orderNum.productCollect || 0;
            case "follow":
                return orderNum.shopCollect || 0;
            case "history":
                return orderNum.historyProductCount || 0;
            default:
                return "";
        }
    };

    const handleStatClick = (key: string) => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        if (STAT_URL_MAP[key]) {
            redirect({ url: STAT_URL_MAP[key] });
        }
    };

    const memberBarLevelName = safeT(data?.memberBar?.levelName, "付费会员") || "付费会员";
    const memberBarDescription = data?.memberBar?.description === undefined ? "购买会员，畅享更多专属权益" : safeT(data?.memberBar?.description);
    const memberBarButtonText = safeT(data?.memberBar?.buttonText, "查看") || "查看";

    const handleMemberBarClick = () => {
        const link = data?.memberBar?.buttonLink;
        if (link?.link) {
            redirect({ url: urlFormat(link as any) });
        }
    };

    const fetchUpgradeInfo = async () => {
        if (!isLoggedIn || !isPro()) {
            setUpgradeText("");
            return;
        }
        try {
            const result = await getUserLevelList();
            const list = (result as any)?.item || (result as any)?.data?.item || [];
            const currentLevel = parseInt(userInfo.rankLevel || "0");
            const nextRank = list.find((r: any) => parseInt(r.rankLevel) > currentLevel);
            if (!nextRank) {
                setUpgradeText(t("已达最高等级"));
                return;
            }
            const needed = Math.max(0, nextRank.minGrowthPoints - (userInfo.growthPoints || 0));
            if (userInfo.rankType === 2) {
                setUpgradeText(t("再消费") + needed + t("元升级到") + nextRank.rankName);
            } else {
                setUpgradeText(t("再获取") + needed + t("成长值升级到") + nextRank.rankName);
            }
        } catch {
            setUpgradeText("");
        }
    };

    const hasUnread = Boolean(orderNum && (orderNum.userMessageCount || orderNum.orderMessageCount || orderNum.imMessageCount));

    const handleNotificationClick = () => {
        if (!isLoggedIn) {
            handleLogin();
            return;
        }
        redirect({ url: "/pages/user/message/index" });
    };

    const maskedPhone = (() => {
        const mobile = userInfo.mobile || "";
        if (mobile.length >= 7) {
            return mobile.slice(0, 3) + "****" + mobile.slice(-4);
        }
        return mobile || "";
    })();

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

    const goPages = (url: string) => {
        Taro.navigateTo({ url });
    };

    // 对应旧 watch(isLoggedIn, { immediate: true })
    useEffect(() => {
        if (isLoggedIn) {
            void getOrderNum();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    // 对应旧 onMounted + watch([isLoggedIn, layoutStyle])：样式1且显示会员条时拉取升级信息
    useEffect(() => {
        if (isLoggedIn && layoutStyle === 1 && showMemberBar) {
            void fetchUpgradeInfo();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn, layoutStyle, showMemberBar]);

    return (
        <View className={`dec-user-info ${layoutClass}`} data-panel-rev="MjI4MmRiaGQ" style={cssVars}>
            {/* ===================== Style 1: Arc Bottom ===================== */}
            {layoutStyle === 1 ? (
                <>
                    <View className="dec-user-info__wrap dec-user-info__wrap--style1" style={style1WrapStyle}>
                        <View className="dec-user-info__container" style={containerPaddingStyle}>
                            <View className="dec-user-info__header">
                                <View className="dec-user-info__profile">
                                    {!isLoggedIn ? (
                                        <>
                                            <View className="dec-user-info__avatar dec-user-info__avatar--bordered" onClick={handleLogin}>
                                                <View className="dec-user-info__avatar-img">
                                                    <TigImage src={staticResource("common/empty-img-bg3.png")} mode="aspectFill" />
                                                </View>
                                            </View>
                                            <View className="dec-user-info__info" onClick={handleLogin}>
                                                <View className="dec-user-info__name" style={{ color: resolvedTextColors.nameColor }}>
                                                    {t("登录/注册")}
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <View className="dec-user-info__avatar dec-user-info__avatar--bordered">
                                                <TigUpload requestUrl="user/user/modifyAvatar" onChange={() => void getUserInfo()}>
                                                    <TigImage className="dec-user-info__avatar-img" src={imageFormat(userInfo.avatar || "")} mode="aspectFill" />
                                                </TigUpload>
                                            </View>
                                            <View className="dec-user-info__info">
                                                <View className="dec-user-info__name-row">
                                                    <View className="dec-user-info__name-group">
                                                        {closeAuth === 1 ? (
                                                            <View
                                                                className="dec-user-info__auth"
                                                                onClick={() => goPages("/pages/user/userCertification/index")}
                                                            >
                                                                <TigAuthBadge verified={!!userInfo.isCompanyAuth} />
                                                            </View>
                                                        ) : null}
                                                        <Text className="dec-user-info__name" style={{ color: resolvedTextColors.nameColor }}>
                                                            {userInfo.nickname || userInfo.username}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View
                                                    className="dec-user-info__sub"
                                                    style={{ color: resolvedTextColors.subColor }}
                                                    onClick={() => goPages("/pages/user/profile/index")}
                                                >
                                                    <Text>{t("个人资料")}</Text>
                                                    <View className="iconfont-h5 icon-a-gengduo20" style={{ fontSize: "24rpx" }} />
                                                </View>
                                            </View>
                                        </>
                                    )}
                                </View>
                            </View>

                            {showStats ? (
                                <View className="dec-user-info__stats">
                                    {visibleStats.map((item) => (
                                        <View className="dec-user-info__stat-item" key={item.key} onClick={() => handleStatClick(item.key)}>
                                            <Text className="dec-user-info__stat-value" style={{ color: resolvedTextColors.statValueColor }}>
                                                {getStatValue(item.key)}
                                            </Text>
                                            <Text className="dec-user-info__stat-label" style={{ color: resolvedTextColors.statLabelColor }}>
                                                {safeT(item.label)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {isLoggedIn && showMemberBar ? (
                                <View className="dec-user-info__member-bar dec-user-info__member-bar--level" style={memberBarStyle}>
                                    <View className="dec-user-info__member-bar-info">
                                        <Text className="dec-user-info__member-bar-name">{memberBarLevelName}</Text>
                                        <View className="dec-user-info__member-bar-divider" />
                                        <Text className="dec-user-info__member-bar-upgrade">{upgradeText}</Text>
                                    </View>
                                    <View className="dec-user-info__member-bar-btn" onClick={handleMemberBarClick}>
                                        <Text>{memberBarButtonText}</Text>
                                        <View className="iconfont-h5 icon-a-gengduo20" style={{ fontSize: "12rpx" }} />
                                    </View>
                                </View>
                            ) : (
                                <View className="dec-user-info__member-bar-placeholder" />
                            )}
                        </View>
                    </View>
                    {showBottomArc ? (
                        <View className="dec-user-info__arc" style={arcStyle}>
                            <Image className="dec-user-info__arc-img" src={arcDataUrl} mode="scaleToFill" />
                        </View>
                    ) : null}
                </>
            ) : layoutStyle === 2 ? (
                /* ===================== Style 2: Light Icons ===================== */
                <View className="dec-user-info__wrap dec-user-info__wrap--style2" style={gradientWrapStyle}>
                    <View className="dec-user-info__container" style={containerPaddingStyle}>
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
                                        <View className="dec-user-info__info dec-user-info__info--flex1">
                                            <View className="dec-user-info__name-row dec-user-info__name-row--between">
                                                <View className="dec-user-info__name-group">
                                                    {closeAuth === 1 ? (
                                                        <View
                                                            className="dec-user-info__auth"
                                                            onClick={() => goPages("/pages/user/userCertification/index")}
                                                        >
                                                            <TigAuthBadge verified={!!userInfo.isCompanyAuth} />
                                                        </View>
                                                    ) : null}
                                                    <Text className="dec-user-info__name" style={{ color: resolvedTextColors.nameColor }}>
                                                        {userInfo.nickname || userInfo.username}
                                                    </Text>
                                                </View>
                                                <View className="dec-user-info__action-icons">
                                                    {data.settings?.show !== false && data.settings?.icon?.picUrl ? (
                                                        <TigImage
                                                            className="dec-user-info__action-icon"
                                                            src={imageFormat(data.settings.icon.picUrl)}
                                                            onClick={() => handleShortcutClick("settings")}
                                                        />
                                                    ) : null}
                                                    {data.notification?.show !== false ? (
                                                        <View className="dec-user-info__action-icon-wrap" onClick={handleNotificationClick}>
                                                            {data.notification?.icon?.picUrl ? (
                                                                <TigImage
                                                                    className="dec-user-info__action-icon"
                                                                    src={imageFormat(data.notification.icon.picUrl)}
                                                                />
                                                            ) : null}
                                                            {hasUnread ? <View className="dec-user-info__notification-dot" /> : null}
                                                        </View>
                                                    ) : null}
                                                </View>
                                            </View>
                                            <View className="dec-user-info__sub" style={{ color: resolvedTextColors.subColor }}>
                                                <Text>{maskedPhone}</Text>
                                            </View>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>

                        {showStats ? (
                            <View className="dec-user-info__stats">
                                {visibleStats.map((item) => (
                                    <View className="dec-user-info__stat-item" key={item.key} onClick={() => handleStatClick(item.key)}>
                                        <Text className="dec-user-info__stat-value" style={{ color: resolvedTextColors.statValueColor }}>
                                            {getStatValue(item.key)}
                                        </Text>
                                        <Text className="dec-user-info__stat-label" style={{ color: resolvedTextColors.statLabelColor }}>
                                            {safeT(item.label)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}
                        <View className="dec-user-info__member-bar-placeholder dec-user-info__member-bar-placeholder--sm" />
                    </View>
                </View>
            ) : layoutStyle === 3 ? (
                /* ===================== Style 3: Minimal Growth ===================== */
                <View className="dec-user-info__wrap dec-user-info__wrap--style3" style={gradientWrapStyle}>
                    <View className="dec-user-info__container" style={containerPaddingStyle}>
                        <View
                            className="dec-user-info__header dec-user-info__header--arrow"
                            onClick={() => isLoggedIn && goPages("/pages/user/profile/index")}
                        >
                            <View className="dec-user-info__profile">
                                {!isLoggedIn ? (
                                    <>
                                        <View
                                            className="dec-user-info__avatar"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLogin();
                                            }}
                                        >
                                            <View className="dec-user-info__avatar-img">
                                                <TigImage src={staticResource("common/empty-img-bg3.png")} mode="aspectFill" />
                                            </View>
                                        </View>
                                        <View
                                            className="dec-user-info__info"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLogin();
                                            }}
                                        >
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
                                            <View className="dec-user-info__name" style={{ color: resolvedTextColors.nameColor }}>
                                                {userInfo.nickname || userInfo.username}
                                            </View>
                                            <View className="dec-user-info__sub" style={{ color: resolvedTextColors.subColor }}>
                                                <Text>{maskedPhone}</Text>
                                            </View>
                                        </View>
                                    </>
                                )}
                            </View>
                            {isLoggedIn ? <View className="dec-user-info__nav-arrow iconfont-h5 icon-a-gengduo20" /> : null}
                        </View>

                        {isLoggedIn && showMemberBar ? (
                            <View className="dec-user-info__member-bar dec-user-info__member-bar--growth" style={memberBarStyle}>
                                <Text className="dec-user-info__growth-label">{t("成长值")}</Text>
                                <View className="dec-user-info__growth-right">
                                    <Text className="dec-user-info__growth-value">{userInfo.growthPoints || 0}</Text>
                                    <View className="dec-user-info__growth-arrow iconfont-h5 icon-a-gengduo20" />
                                </View>
                            </View>
                        ) : null}
                    </View>
                </View>
            ) : (
                /* ===================== Style 4: Centered Avatar + Growth Card ===================== */
                <View className="dec-user-info__wrap dec-user-info__wrap--style4">
                    <View className="dec-user-info__style4-grad" style={style4GradStyle} />
                    <View className="dec-user-info__container dec-user-info__container--style4" style={containerPaddingStyle}>
                        <View className="dec-user-info__center-header">
                            {!isLoggedIn ? (
                                <>
                                    <View className="dec-user-info__avatar dec-user-info__avatar--lg" onClick={handleLogin}>
                                        <View className="dec-user-info__avatar-img dec-user-info__avatar-img--lg">
                                            <TigImage src={staticResource("common/empty-img-bg3.png")} mode="aspectFill" />
                                        </View>
                                    </View>
                                    <View
                                        className="dec-user-info__center-name dec-user-info__center-name--login"
                                        style={{ color: resolvedTextColors.nameColor }}
                                        onClick={handleLogin}
                                    >
                                        {t("登录/注册")}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View className="dec-user-info__avatar-wrap">
                                        <View className="dec-user-info__avatar dec-user-info__avatar--lg">
                                            <TigUpload requestUrl="user/user/modifyAvatar" onChange={() => void getUserInfo()}>
                                                <TigImage
                                                    className="dec-user-info__avatar-img dec-user-info__avatar-img--lg"
                                                    src={imageFormat(userInfo.avatar || "")}
                                                    mode="aspectFill"
                                                />
                                            </TigUpload>
                                        </View>
                                        {showEditIcon ? (
                                            <Image
                                                className="dec-user-info__edit-icon"
                                                src={EDIT_ICON}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goPages("/pages/user/profile/index");
                                                }}
                                            />
                                        ) : null}
                                    </View>
                                    <View className="dec-user-info__center-name-row">
                                        <Text className="dec-user-info__center-name" style={{ color: resolvedTextColors.nameColor }}>
                                            {userInfo.nickname || userInfo.username}
                                        </Text>
                                        {closeAuth === 1 ? (
                                            <View className="dec-user-info__auth-badge" onClick={() => goPages("/pages/user/userCertification/index")}>
                                                <TigAuthBadge type="tag" verified={!!userInfo.isCompanyAuth} />
                                            </View>
                                        ) : null}
                                    </View>
                                </>
                            )}
                        </View>

                        {isLoggedIn && showMemberBar ? (
                            <View className="dec-user-info__growth-card" style={growthCardStyle}>
                                {growthWaveUrl ? <Image className="dec-user-info__growth-card-wave" src={growthWaveUrl} mode="scaleToFill" /> : null}
                                <View className="dec-user-info__growth-card-left" onClick={() => goPages("/pages/user/levelCenter/index")}>
                                    <View className="dec-user-info__growth-card-label-row">
                                        <Text className="dec-user-info__growth-card-label">{t("成长值")}</Text>
                                        <View className="dec-user-info__growth-card-label-arrow iconfont-h5 icon-a-gengduo20" />
                                    </View>
                                    <Text className="dec-user-info__growth-card-value">{userInfo.growthPoints || 0}</Text>
                                </View>
                                <View className="dec-user-info__growth-card-btn" onClick={() => goPages("/pages/user/levelCenter/index")}>
                                    {growthBtnText}
                                </View>
                            </View>
                        ) : null}
                    </View>
                </View>
            )}
        </View>
    );
}