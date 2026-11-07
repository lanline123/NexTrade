import { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";

import MainHeader, { type MainHeaderRef } from "@/components/mainHeader";
import Recommend from "@/components/recommend";
import TigAuthBadge from "@/components/tig/tig-auth-badge/TigAuthBadge";
import TigBackTop from "@/components/tig/tig-back-top";
import TigCopyright from "@/components/tig/tig-copyright/TigCopyright";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import TigUpload from "@/components/tig/tig-upload/TigUpload";
import { getMemberDecorate, getMemberDecorateLegacy } from "@/api/home/home";
import MemberDecorate from "@/pages/member/components/decorate";
import Account from "@/pages/member/components/decorate/account";
import Advertising from "@/pages/member/components/decorate/advertising";
import MyService from "@/pages/member/components/decorate/myService";
import TermPayCard from "@/pages/member/components/termPay/termPayCard";
import { useScrollTop } from "@/hooks";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import type { MemberDecorateModule } from "@/types/decorate/member-decorate";
import { isMerchant, isO2o, isOverseas, isPro, staticResource } from "@/utils";
import { ensureMemberFixedModules } from "@/utils/ensureFixedModules";
import { imageFormat } from "@/utils/format";
import { handleDecorateLoadError } from "@/utils/handleDecorateLoadError";
import { handleLogin } from "@/utils/handleLogin";
import { t } from "@/utils/i18n";

import "./index.scss";

// 固定功能模块类型：装修为空时会被兜底注入，不能单独算作「有装修」
const FIXED_MODULE_TYPES = ["fixedFunctionalArea", "fixed-functional-area"];

// 样式 2/3/4 的默认渐变色
const STYLE_GRADIENT_DEFAULTS: Record<number, { colorA: string; colorB: string }> = {
    2: { colorA: "#E0FCED", colorB: "#FDF1F3" },
    3: { colorA: "#F1EFE9", colorB: "#E7F0E6" },
    4: { colorA: "#FBD9E1", colorB: "#FDEDEF" }
};

const GRADIENT_DIR_MAP: Record<string, string> = { upDown: "to bottom", leftRight: "to right", diagonal: "135deg" };

// 沉浸式渐隐带高度（rpx）
const IMMERSIVE_BAND = 880;

/**
 * 把字符串化的 boolean / 数字回填为真实类型，避免下游判断失效
 */
const normalizeModuleValues = (raw: any): any => {
    if (raw === null || raw === undefined) return raw;
    if (Array.isArray(raw)) {
        return raw.map((v) => normalizeModuleValues(v));
    }
    if (typeof raw === "object") {
        const result: Record<string, any> = {};
        Object.keys(raw).forEach((key) => {
            result[key] = normalizeModuleValues(raw[key]);
        });
        return result;
    }
    if (typeof raw === "string") {
        if (raw === "true") return true;
        if (raw === "false") return false;
        if (raw !== "" && /^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
        return raw;
    }
    return raw;
};

/** 从装修接口结果中取出页面设置 pageModule（兼容新/老结构），并规整布尔/数字 */
const parsePageModule = (result: any): Record<string, any> => {
    let pm: any = result?.pageModule ?? result?.data?.pageModule ?? {};
    if (typeof pm === "string") {
        try {
            pm = JSON.parse(pm);
        } catch {
            pm = {};
        }
    }
    return normalizeModuleValues(pm) || {};
};

/** 把模块数组规整为 MemberDecorateModule[]（兼容 module 为对象或 JSON 字符串） */
const mapModuleList = (list: any): MemberDecorateModule[] => {
    return (Array.isArray(list) ? list : []).map((m: any) => {
        let mod: any = m?.module;
        if (typeof mod === "string") {
            try {
                mod = JSON.parse(mod);
            } catch {
                /* ignore */
            }
        }
        return {
            type: m?.type,
            isShow: m?.isShow,
            fixed: m?.fixed,
            module: normalizeModuleValues(mod) || {}
        } as MemberDecorateModule;
    });
};

interface OrderEntryDef {
    key: string;
    icon: string;
    label: string;
    needComment?: boolean;
}

const NORMAL_ORDER_ENTRIES: OrderEntryDef[] = [
    { key: "awaitPay", icon: "icon-daifukuan", label: "待付款" },
    { key: "awaitShipping", icon: "icon-daifahuo", label: "待发货" },
    { key: "awaitReceived", icon: "icon-daishouhuo", label: "待收货" },
    { key: "awaitComment", icon: "icon-daipingjia", label: "待评价", needComment: true },
    { key: "awaitAftersalesCollect", icon: "icon-tuikuan", label: "退换/售后" }
];

/**
 * 用户中心首页（自旧 pages/member/index.vue 移植）
 * - 装修非空时按装修模块渲染
 * - 装修为空时回退原硬编码布局（普通版 / 跨境旧版两套）
 */
export default function Member() {
    const router = useRouter();
    const { scrollTop } = useScrollTop();

    const userStore = useUserStore();
    const configStore = useConfigStore();
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const storeToken = useUserStore((s) => s.token);
    const orderNum = (useUserStore((s) => s.orderNum) || {}) as Record<string, any>;
    const setUserInfo = useUserStore((s) => s.setUserInfo);
    const getOrderNum = useUserStore((s) => s.getOrderNum);
    const getUserInfo = useUserStore((s) => s.getUserInfo);
    const whenConfigReady = useConfigStore((s) => s.whenConfigReady);
    const commonHeaderHeight = useConfigStore((s) => s.commonHeaderHeight);
    const useNewMemberCenter = useConfigStore((s) => s.useNewMemberCenter);
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);
    const integralName = useConfigStore((s) => s.integralName);

    const layoutRef = useRef<MainHeaderRef | null>(null);
    const isOverseasSkin = isOverseas();

    /** 旧 tig-layout isZh：海外构建按当前语言判断，国内恒为中文 */
    const langCode = useI18nStore((s) => s.langCode);
    const isZh = isOverseasSkin
        ? langCode
            ? langCode.includes("zh")
            : (Taro.getSystemInfoSync().language || "zh").includes("zh")
        : true;

    const [previewId, setPreviewId] = useState<string | number>("");
    const [modules, setModules] = useState<MemberDecorateModule[]>([]);
    const [pageModule, setPageModule] = useState<Record<string, any>>({});
    const [decorateLoaded, setDecorateLoaded] = useState(false);
    const [showFallbackLayout, setShowFallbackLayout] = useState(false);
    const [legacyBanner, setLegacyBanner] = useState<Record<string, any> | null>(null);
    const [legacyMenuType, setLegacyMenuType] = useState<number | string>("");
    const [legacyMenuList, setLegacyMenuList] = useState<any[]>([]);

    const hasToken = Boolean(storeToken || Taro.getStorageSync("token"));

    const couponCount = (() => {
        const coupon = Number(userInfo?.coupon);
        if (Number.isFinite(coupon) && coupon >= 0) return coupon;
        return 0;
    })();

    const goPages = (url: string) => {
        Taro.navigateTo({ url });
    };

    const goRankPages = (url: string) => {
        if (isPro()) {
            Taro.navigateTo({ url });
        }
    };

    /** 重置用户信息，用于退出登录后清空页面数据 */
    const resetUser = () => {
        setUserInfo({} as any);
    };

    // 仅当存在至少一个非固定功能模块时，才视为装修生效
    const hasDecorate = modules.some((m) => !FIXED_MODULE_TYPES.includes(m.type || ""));

    // 页面标题是否沉浸式（来自后台页面设置 pageModule.immersive）
    const immersive = Boolean(pageModule?.immersive);

    /** 顶部头部高度：跨境为 mainHeader 实测高度（fixed 后脱离文档流），国内为导航栏 */
    const headerOffsetValue = isOverseasSkin ? `${commonHeaderHeight || 0}px` : "var(--nav-height)";

    /** 外贸皮肤 mainHeader 占位 */
    const mainHeaderSpacerStyle = isOverseasSkin ? { height: `${commonHeaderHeight || 0}px` } : undefined;

    const pageGradientStyle = (() => {
        if (!hasDecorate) return {} as Record<string, string>;
        const first = modules[0];
        if (!first) return {} as Record<string, string>;
        const type = first.type;
        if (type !== "userInfo" && type !== "user-info") return {} as Record<string, string>;
        const mod = first.module as any;
        const ls = mod?.layoutStyle;
        if (ls !== 2 && ls !== 3) return {} as Record<string, string>;
        const g = mod?.gradient;
        const colorA = g?.colorA || "#fcf6fc";
        const colorB = g?.colorB || "#f3f3fe";
        return {
            background: `linear-gradient(180deg, ${colorA} 0%, ${colorB} 20%, #f5f5f5 45%)`,
            marginTop: `calc(-1 * ${headerOffsetValue})`,
            paddingTop: headerOffsetValue
        };
    })();

    // 跨境外贸头背景：沉浸式随滚动渐显，否则取后台标题栏背景色，缺省白色
    const headerBackground = (() => {
        if (immersive) {
            const progress = Math.min(1, scrollTop / 70);
            return `rgba(255, 255, 255, ${progress})`;
        }
        return pageModule?.titleBackgroundColor || "#fff";
    })();

    const navbarBackground = (() => {
        const configBg = pageModule?.titleBackgroundColor;
        // 沉浸式：随滚动从透明渐显到白色
        if (immersive) {
            const progress = Math.min(1, scrollTop / 70);
            return `rgba(255, 255, 255, ${progress})`;
        }
        // 非沉浸式：优先取后台页面设置的标题栏背景颜色
        if (configBg) return configBg;
        if (Object.keys(pageGradientStyle).length === 0) {
            return "linear-gradient(90deg, #fcf6fc, #f3f3fe)";
        }
        const progress = Math.min(1, scrollTop / 70);
        return `rgba(255, 255, 255, ${progress})`;
    })();

    // 导航栏文字颜色：取后台页面设置的标题栏文字颜色，缺省为黑色
    const navbarColor = pageModule?.titleColor || "#000";

    // 取首个 userInfo3 样式 2/3/4 的渐变色（仅沉浸式生效）
    const gradientColors = (() => {
        if (!immersive) return null;
        const first = modules[0];
        if (!first) return null;
        const type = first.type;
        if (type !== "userInfo3" && type !== "user-info3") return null;
        const mod = first.module as any;
        const ls = Number(mod?.layoutStyle);
        // 样式 4 的渐变改由组件自身按「成长值卡一半高度」绘制，页面不再统一铺底
        if (ls !== 2 && ls !== 3) return null;
        const def = STYLE_GRADIENT_DEFAULTS[ls] ?? { colorA: "#fcf6fc", colorB: "#f3f3fe" };
        const g = mod?.gradient;
        return { colorA: g?.colorA || def.colorA, colorB: g?.colorB || def.colorB, gradientType: g?.gradientType || "leftRight" };
    })();

    // 沉浸式：页面容器统一绘制「左右 + 上下渐隐」渐变，并延伸到导航栏下方（与 Admin 预览一致）
    const pageImmersiveStyle = (() => {
        if (!immersive) return {} as Record<string, string>;
        const base: Record<string, string> = { paddingTop: headerOffsetValue };
        // 样式四：导航栏区域的渐变改由组件渐变层向上延伸绘制（整段连续，避免接缝），页面只保留占位 paddingTop
        const c = gradientColors;
        if (!c) return base;
        const dir = GRADIENT_DIR_MAP[c.gradientType || "leftRight"] || "to right";
        return {
            ...base,
            backgroundImage: `linear-gradient(to bottom, transparent 0, #f5f5f5 ${IMMERSIVE_BAND}rpx), linear-gradient(${dir}, ${c.colorA}, ${c.colorB})`,
            backgroundSize: `100% ${IMMERSIVE_BAND}rpx`,
            backgroundRepeat: "no-repeat",
            backgroundColor: "#f5f5f5"
        };
    })();

    // 后台页面背景色（旧 page-meta 下发 --member-page-bg）
    const pageBg = (() => {
        // 跨境旧版兜底沿用独立跨境 Uniapp 的白色页面底，不使用普通版渐变或后台残留背景色
        if (isOverseasSkin && showFallbackLayout) return "#fff";
        const bg = pageModule?.backgroundColor;
        if (!bg || immersive) return undefined;
        return bg;
    })();

    const fetchLegacyMemberDecorate = async () => {
        try {
            const result: any = await getMemberDecorateLegacy();
            const list = Array.isArray(result?.data) ? result.data : [];
            const banner = list.find((m: any) => m?.type === "bannerList");
            const menu = list.find((m: any) => m?.type === "menus");
            setLegacyBanner(banner?.module?.bannerList || null);
            setLegacyMenuType(menu?.module?.menuType ?? "");
            setLegacyMenuList(Array.isArray(menu?.module?.menuList) ? menu.module.menuList : []);
        } catch (error) {
            console.error("获取老版本装修配置失败:", error);
            setLegacyBanner(null);
            setLegacyMenuType("");
            setLegacyMenuList([]);
        }
    };

    const fetchMemberDecorate = async (nextPreviewId: string | number) => {
        // 等待全局配置就绪，确保已拿到后端下发的 useNewMemberCenter 新旧版开关
        await whenConfigReady();
        // 个人中心新旧版开关：useNewMemberCenter=0（旧版）时强制走兜底布局 + 老接口
        if (Number(useNewMemberCenter) === 0) {
            setModules([]);
            setPageModule({});
            setShowFallbackLayout(true);
            await fetchLegacyMemberDecorate();
            setDecorateLoaded(true);
            return;
        }
        try {
            const result: any = await getMemberDecorate(nextPreviewId);
            const parsed = mapModuleList(result?.moduleList);
            // 仅有固定功能模块（装修为空时被兜底注入）时，不算有效新装修，走下方硬编码兜底
            const hasRealModule = parsed.some((m) => !FIXED_MODULE_TYPES.includes(m.type || ""));
            if (hasRealModule) {
                setModules(parsed);
                setPageModule(parsePageModule(result));
                ensureMemberFixedModules(parsed);
                setShowFallbackLayout(false);
            } else {
                setModules([]);
                setPageModule({});
                // 仅当该会员页为首页配置时，才展示硬编码兜底布局并请求老接口补齐广告图与我的服务
                const fallback = result?.isHome === 1;
                setShowFallbackLayout(fallback);
                if (fallback) {
                    await fetchLegacyMemberDecorate();
                }
            }
        } catch (error) {
            if (await handleDecorateLoadError(error)) return;
            console.error("获取装修配置失败:", error);
            setModules([]);
            setPageModule({});
            setShowFallbackLayout(true);
            await fetchLegacyMemberDecorate();
        } finally {
            setDecorateLoaded(true);
        }
    };

    // 对应旧 onLoad
    useEffect(() => {
        const options: any = router.params;
        const pid = options?.previewId ?? "";
        setPreviewId(pid);
        void fetchMemberDecorate(pid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loginSuccess = () => {
        void fetchMemberDecorate(previewId);
        void getOrderNum(true);
    };

    // 对应旧 onShow：未登录清空数据，已登录刷新用户信息与订单统计
    useDidShow(() => {
        Taro.hideTabBar({ fail: () => {} } as any);
        if (!hasToken) {
            resetUser();
            return;
        }
        void Promise.all([getUserInfo(), getOrderNum()]);
    });

    return (
        <TigLayout onLoginSuccess={loginSuccess}>
            <View className="member-page" style={pageBg ? ({ "--member-page-bg": pageBg } as any) : undefined}>
                {/* 沉浸式：铺一层固定页面底色，与 userInfo3 渐变的渐隐目标色一致 */}
                {immersive ? <View className="immersive-page-bg" /> : null}
                {/* tig-layout 内 sticky 会被 overflow:hidden 截断，与首页一致用 fixed + 占位 */}
                {isOverseasSkin ? <MainHeader ref={layoutRef} position="fixed" background={headerBackground} /> : null}
                {/* 沉浸式不占位，让首个模块的渐变铺到头部背后 */}
                {isOverseasSkin && !immersive ? <View className="main-header-spacer" style={mainHeaderSpacerStyle} /> : null}
                {!isOverseasSkin ? (
                    <TigNavbar showLeft={false} title={t("会员中心")} needPlaceholder={!immersive} background={navbarBackground} color={navbarColor} />
                ) : null}

                {decorateLoaded ? (
                    hasDecorate ? (
                        <View className={`user${immersive ? " user--immersive" : ""}`} style={(immersive ? pageImmersiveStyle : pageGradientStyle) as any}>
                            <MemberDecorate modules={modules} immersive={immersive} />
                        </View>
                    ) : showFallbackLayout ? (
                        <View className={`user${isOverseasSkin ? " overseas-legacy" : ""}`}>
                            <View className={`user_header${isOverseasSkin ? " overseas-user-header" : " user_bg_color"}`}>
                                <View className="picTxt">
                                    {!hasToken ? (
                                        <>
                                            <View className="pictrue" onClick={handleLogin}>
                                                <Image
                                                    className="pic-btn"
                                                    mode="aspectFill"
                                                    src={staticResource(isOverseasSkin ? "common/default-user.png" : "common/empty-img-bg3.png")}
                                                />
                                            </View>
                                            <View className="text">
                                                <View className="name" onClick={handleLogin}>
                                                    {isOverseasSkin ? t("登录") : t("登录/注册")}
                                                </View>
                                                {isOverseasSkin ? <View className="desc">{t("为了获得最佳体验")}</View> : null}
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <TigUpload requestUrl="user/user/modifyAvatar" onChange={() => void getUserInfo()}>
                                                <View className="pictrue">
                                                    <TigImage className="pic-btn" src={imageFormat(userInfo.avatar || "")} mode="aspectFill" />
                                                </View>
                                            </TigUpload>
                                            <View className="text">
                                                {isOverseasSkin ? (
                                                    <>
                                                        <View className="name line1">{userInfo.nickname || userInfo.username}</View>
                                                        {userInfo.rankName ? (
                                                            <View className="logo" onClick={() => goRankPages("/pages/user/levelCenter/index")}>
                                                                <Text>{t(userInfo.rankName)}</Text>
                                                            </View>
                                                        ) : null}
                                                    </>
                                                ) : (
                                                    <>
                                                        <View className="acea-row row-middle info">
                                                            {configStore.closeAuth === 1 ? (
                                                                <View className="auth" onClick={() => goPages("/pages/user/userCertification/index")}>
                                                                    <TigAuthBadge verified={!!userInfo.isCompanyAuth} />
                                                                </View>
                                                            ) : null}
                                                            <View className="name line1">{userInfo.nickname || userInfo.username}</View>
                                                            {userInfo?.showSign ? (
                                                                <View className="acea-row qiandao" onClick={() => goPages("/pages/user/sign/index")}>
                                                                    <View className="iconfont icon-qiandao" />
                                                                    <View>{t("签到有礼")}</View>
                                                                </View>
                                                            ) : null}
                                                            <View className="iconfont-h5 icon-shezhi" onClick={() => goPages("/pages/user/profile/index")} />
                                                        </View>
                                                        <View className="logo acea-row row-middle" onClick={() => goRankPages("/pages/user/levelCenter/index")}>
                                                            {isPro() ? <TigImage className="vip_logo" src={userInfo?.rankLogo} mode="widthFix" /> : null}
                                                            {userInfo.rankName ? t(userInfo.rankName) : ""}
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </View>

                                {!isOverseasSkin ? (
                                    <View className="user_top_group">
                                        <View className="item" onClick={() => goPages("/pages/user/collectProduct/index")}>
                                            <View className="tit">
                                                {t("商品收藏")}
                                                <Text className="txt">{Number(orderNum.productCollect) >= 0 ? orderNum.productCollect : "--"}</Text>
                                            </View>
                                        </View>
                                        {isMerchant() || isO2o() ? (
                                            <View className="item" onClick={() => goPages("/pages/user/collectionShop/index")}>
                                                <View className="tit">
                                                    {t(isO2o() ? "门店关注" : "店铺收藏")}
                                                    <Text className="txt">{Number(orderNum.shopCollect) >= 0 ? orderNum.shopCollect : "--"}</Text>
                                                </View>
                                            </View>
                                        ) : null}
                                        {isZh && productCommentEnabled === 1 ? (
                                            <View className="item" onClick={() => goPages("/pages/user/comment/list")}>
                                                <View className="tit">
                                                    {t("待评价")}
                                                    <Text className="txt">{Number(orderNum.awaitComment) >= 0 ? orderNum.awaitComment : "--"}</Text>
                                                </View>
                                            </View>
                                        ) : null}
                                        <View className="item" onClick={() => goPages("/pages/user/historyProduct/index")}>
                                            <View className="tit">{t("浏览记录")}</View>
                                        </View>
                                    </View>
                                ) : null}
                            </View>

                            <View className="user_wrapper">
                                {isOverseasSkin ? (
                                    <>
                                        {hasToken ? (
                                            <>
                                                <View className="list-group my-order overseas-order">
                                                    <View className="title acea-row row-between-wrapper">
                                                        <View className="order-title">{t("订单")}</View>
                                                        <View className="more" onClick={() => goPages("/pages/user/order/list")}>
                                                            <View>{t("查看更多")}</View>
                                                            <View className="iconfont icon-xiangyou" />
                                                        </View>
                                                    </View>
                                                    <View className="wrap">
                                                        <View className="li" onClick={() => goPages("/pages/user/order/list?type=awaitPay")}>
                                                            <View className="content">
                                                                {Number(orderNum.awaitPay) > 0 ? <View className="num">{orderNum.awaitPay}</View> : null}
                                                                <View className="icon iconfont-h5 icon-a-pending-payment" />
                                                                <View className="txt">{t("待付款")}</View>
                                                            </View>
                                                        </View>
                                                        <View className="li" onClick={() => goPages("/pages/user/order/list?type=awaitReceived")}>
                                                            <View className="content">
                                                                {Number(orderNum.awaitReceived) > 0 ? <View className="num">{orderNum.awaitReceived}</View> : null}
                                                                <View className="icon iconfont-h5 icon-dadao" />
                                                                <View className="txt">{t("进行中")}</View>
                                                            </View>
                                                        </View>
                                                        <View className="li" onClick={() => goPages("/pages/user/order/list?type=awaitComment")}>
                                                            <View className="content">
                                                                <View className="icon iconfont-h5 icon-complete" />
                                                                <View className="txt">{t("已完成")}</View>
                                                            </View>
                                                        </View>
                                                    </View>
                                                </View>
                                                <View className="overseas-term-pay">
                                                    <TermPayCard />
                                                </View>
                                                <View className="overseas-other-menu">
                                                    <View className="cell-wrap" onClick={() => goPages("/pages/user/order/list?type=awaitComment")}>
                                                        <View className="icon iconfont-h5 icon-evaluate" />
                                                        <View className="cell-name">{t("评价")}</View>
                                                        <View className="right-icon">
                                                            <Text className="iconfont icon-xiangyou" />
                                                        </View>
                                                    </View>
                                                    <View className="cell-wrap" onClick={() => goPages("/pages/user/afterSale/list")}>
                                                        <View className="icon iconfont-h5 icon-after-sale" />
                                                        <View className="cell-name">{t("售后")}</View>
                                                        <View className="right-icon">
                                                            <Text className="iconfont icon-xiangyou" />
                                                        </View>
                                                    </View>
                                                </View>
                                            </>
                                        ) : (
                                            <View className="login-btn-wrap overseas-login-btn">
                                                <View className="login-btn" onClick={handleLogin}>
                                                    {t("登入/注册")}
                                                </View>
                                            </View>
                                        )}
                                        <View className="gap" style={{ height: "16rpx", background: "#f5f6fa" }} />
                                        {legacyBanner?.picUrl ? <Advertising data={legacyBanner} /> : null}
                                        {legacyMenuList.length > 0 ? <MyService data={legacyMenuList} menuType={legacyMenuType} /> : null}
                                        <View className="legacy-account">
                                            <Account data={{}} />
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <View className="list-group my-order">
                                            <View className="title acea-row row-between-wrapper">
                                                <View>{t("我的订单")}</View>
                                                <View className="more" onClick={() => goPages("/pages/user/order/list")}>
                                                    <View>{t("全部订单")}</View>
                                                    <View className="iconfont icon-xiangyou" />
                                                </View>
                                            </View>
                                            <View className="wrap">
                                                {NORMAL_ORDER_ENTRIES.map((item) => {
                                                    if (item.needComment && productCommentEnabled !== 1) return null;
                                                    const count = Number(orderNum[item.key]) || 0;
                                                    return (
                                                        <View
                                                            key={item.key}
                                                            className="li"
                                                            onClick={() => goPages(`/pages/user/order/list?type=${item.key}`)}
                                                        >
                                                            <View className="badge-wrap">
                                                                <Text className={`iconfont-h5 ${item.icon}`} />
                                                                {count > 0 ? <View className="badge">{count}</View> : null}
                                                            </View>
                                                            <View className={`txt${item.key === "awaitAftersalesCollect" ? " line1" : ""}`}>
                                                                {t(item.label)}
                                                            </View>
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>

                                        <View className="list-group my-wallet">
                                            <View className="title acea-row row-between-wrapper">
                                                <View>{t("我的钱包")}</View>
                                                <View className="more" onClick={() => goPages("/pages/user/account/index")}>
                                                    <View>{t("进入钱包")}</View>
                                                    <View className="iconfont icon-xiangyou" />
                                                </View>
                                            </View>
                                            <View className="wrap">
                                                <View className="li" onClick={() => goPages("/pages/user/account/index")}>
                                                    <Text className="num">{Number(userInfo.totalBalance) >= 0 ? userInfo.totalBalance : 0}</Text>
                                                    <View className="txt">{t("余额")}</View>
                                                </View>
                                                <View className="li" onClick={() => goPages("/pages/coupon/index?type=2")}>
                                                    <Text className="num">{couponCount}</Text>
                                                    <View className="txt">{t("优惠券")}</View>
                                                </View>
                                                <View className="li" onClick={() => goPages("/pages/user/point/detail")}>
                                                    <Text className="num">{Number(userInfo.points) >= 0 ? userInfo.points : 0}</Text>
                                                    <View className="txt">{t(integralName)}</View>
                                                </View>
                                            </View>
                                        </View>

                                        <TermPayCard />
                                        {legacyBanner?.picUrl ? <Advertising data={legacyBanner} /> : null}
                                        {legacyMenuList.length > 0 ? <MyService data={legacyMenuList} menuType={legacyMenuType} /> : null}
                                    </>
                                )}
                            </View>
                        </View>
                    ) : null
                ) : null}

                <Recommend />
                {/* 旧 <tig-copyright />（版权/技术支持图，B6 已移植组件，接线） */}
                <TigCopyright />
                <TigBackTop scrollTop={scrollTop} />
            </View>
        </TigLayout>
    );
}