import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow } from "@tarojs/taro";

import { useCartStore } from "@/store/cart";
import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { getElementRect, redirect, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./MainHeader.scss";

export interface MainHeaderRef {
    /** 测量头部高度并写入 store（对应旧 defineExpose getContentRect） */
    getContentRect: () => void;
}

interface Props {
    position?: "sticky" | "static" | "fixed";
    title?: string;
    showLeft?: boolean;
    noSafeTop?: boolean;
    background?: string;
    /** 旧 slot name="navbar"（自定义导航内容） */
    navbar?: ReactNode;
    left?: ReactNode;
    middle?: ReactNode;
    right?: ReactNode;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 外贸风主导航头（自旧 components/mainHeader/index.vue 移植）
 * - 左侧菜单抽屉 + logo，右侧消息/购物车；可选二级标题栏
 * - 小程序端按胶囊位置让出 padding
 * - 测量 .common-header 实际高度写入 configStore.commonHeaderHeight，供 sticky 头计算偏移
 * - 旧 defineExpose → forwardRef/useImperativeHandle
 */
const MainHeader = forwardRef<MainHeaderRef, Props>(function MainHeader(
    { position = "static", title = "", showLeft = true, noSafeTop = false, background = "#fff", navbar, left, middle, right },
    ref
) {
    const baseInfo = useConfigStore((s) => s.baseInfo);
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);
    const setCommonHeaderHeight = useConfigStore((s) => s.setCommonHeaderHeight);
    const userInfo = useUserStore((s) => s.userInfo) || {};
    const token = useUserStore((s) => s.token);
    const logout = useUserStore((s) => s.logout);
    const cartCount = useCartStore((s) => s.cartCount);
    const fetchCartCount = useCartStore((s) => s.fetchCartCount);

    const [showMenu, setShowMenu] = useState(false);
    const isHeaderActiveRef = useRef(true);

    const isWeapp = process.env.TARO_ENV === "weapp";

    const mainHeaderStyle = isWeapp && !noSafeTop ? `padding-top: ${menuButtonInfo.top}px;padding-right: ${menuButtonInfo.width}px;` : "";
    const placeholderStyle = isWeapp ? `margin-right: ${menuButtonInfo.width / 2 + 5}px;` : "";
    const topPlaceholderStyle = isWeapp ? `padding-top: ${(menuButtonInfo.height + menuButtonInfo.top) / 2 + 5}px;` : "";

    const couponCount = (() => {
        const coupon = Number(userInfo?.coupon);
        if (Number.isFinite(coupon) && coupon >= 0) return coupon;
        return 0;
    })();

    // 对应旧 cartStore.fetchCartCount()（setup 顶层调用）
    useEffect(() => {
        void fetchCartCount();
    }, [fetchCartCount]);

    /**
     * 测量顶部栏高度写入 store，供搜索等页面计算顶部占位和固定偏移。
     * 首次进入时 DOM/安全区可能尚未稳定，按跨境项目做法延后重试。
     */
    const getContentRect = async () => {
        await sleep(0);
        for (let i = 0; i < 3; i++) {
            if (!isHeaderActiveRef.current) return;
            try {
                const result = await getElementRect(".common-header");
                if (!isHeaderActiveRef.current) return;
                if (result && !Array.isArray(result) && result.height > 0) {
                    setCommonHeaderHeight(result.height);
                    return;
                }
            } catch (e) {
                console.error("getElementRect error:", e);
            }
            await sleep(50 * (i + 1));
        }
    };

    useImperativeHandle(ref, () => ({ getContentRect }));

    // 对应旧 onMounted：窗口尺寸变化时重测（rpx 随窗口宽度变化）
    useEffect(() => {
        const handleResize = () => {
            void getContentRect();
        };
        Taro.onWindowResize(handleResize);
        void getContentRect();
        return () => {
            isHeaderActiveRef.current = false;
            Taro.offWindowResize(handleResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useDidShow(() => {
        isHeaderActiveRef.current = true;
        void getContentRect();
    });

    useDidHide(() => {
        isHeaderActiveRef.current = false;
        setShowMenu(false);
    });

    const handleLink = (url: string) => {
        redirect({ url });
    };

    const handleIcon = () => {
        // #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            window.history.back();
            return;
        }
        // #endif
        Taro.navigateBack();
    };

    return (
        <>
            <View className="common-header-box" style={{ position, background } as any}>
                <View className={`common-header${noSafeTop ? " no-safe-top" : ""}`} style={{ background }}>
                    <View className="main-header" style={mainHeaderStyle}>
                        <View className="main-header-box flex">
                            <View className="box-left flex align-center">
                                <View className="menu-icon" onClick={() => setShowMenu((v) => !v)}>
                                    <View className="iconfont-h5 icon-caidan" />
                                </View>
                                {baseInfo.shopLogo ? (
                                    <View className="header-logo" onClick={() => handleLink("/pages/index/index")}>
                                        <Image mode="widthFix" src={baseInfo.shopLogo} />
                                    </View>
                                ) : null}
                            </View>
                            <View className="box-right flex align-center">
                                <View className="user-icon" onClick={() => handleLink("/pages/member/index")}>
                                    <View className="iconfont-h5 icon-xinjianwenbenwendang" />
                                </View>
                                <View className="cart-icon" onClick={() => handleLink("/pages/cart/index")}>
                                    <View className="iconfont-h5 icon-gouwuche4" />
                                    {cartCount && cartCount > 0 ? <View className="corner-mark">{cartCount}</View> : null}
                                </View>
                            </View>
                        </View>
                    </View>

                    {navbar ??
                        (title ? (
                            <View className="navbar-content">
                                <View className="left">{showLeft ? left ?? <View className="iconfont icon-houtui" onClick={handleIcon} /> : null}</View>
                                <View className="middle">{middle ?? <View className="title line1">{t(title)}</View>}</View>
                                <View className="right">{right}</View>
                            </View>
                        ) : null)}
                </View>
            </View>

            {showMenu ? (
                <View className="common-menu-box" onClick={() => setShowMenu(false)}>
                    <View className="left-menu-box flex flex-column" onClick={(e) => e.stopPropagation()}>
                        <View className="left-menu-header common-box">
                            <View className="close-icon" onClick={() => setShowMenu(false)}>
                                <Image src={staticResource("common/close.png")} />
                            </View>
                            <View className="menu-header-content flex align-center" style={topPlaceholderStyle}>
                                <View className="profile-photo">
                                    {userInfo.avatar ? (
                                        <Image src={imageFormat(userInfo.avatar)} />
                                    ) : (
                                        <Image src={staticResource("common/default-user.png")} />
                                    )}
                                </View>
                                {token ? (
                                    <>
                                        <View className="profile-info line1">{userInfo.nickname || userInfo.username}</View>
                                        <View className="header-btn" style={placeholderStyle as any} onClick={() => void logout()}>
                                            <Text className="header-btn-text"> {t("登出")}</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View className="profile-info line1" onClick={() => handleLink("/pages/login/index")}>
                                        {t("登入")}
                                    </View>
                                )}
                            </View>
                        </View>

                        <View className="category-box common-box flex align-center justify-between" onClick={() => handleLink("/pages/productCate/index")}>
                            <View className="category-text">{t("分类")}</View>
                            <View className="category-icon">
                                <Image src={staticResource("common/right_arrows.png")} />
                            </View>
                        </View>

                        <View className="page-menu common-box">
                            <View className="page-item flex align-center justify-between" onClick={() => handleLink("/pages/user/order/list")}>
                                <View className="item-left">
                                    <View className="left-icon" />
                                    <View className="left-text">{t("订单")}</View>
                                </View>
                                <View className="item-right flex align-center">
                                    <View className="category-icon">
                                        <Image src={staticResource("common/right_arrows.png")} />
                                    </View>
                                </View>
                            </View>
                            <View className="page-item flex align-center justify-between" onClick={() => handleLink("/pages/user/messageLog/index")}>
                                <View className="item-left">
                                    <View className="left-icon" />
                                    <View className="left-text">{t("消息")}</View>
                                </View>
                                <View className="item-right flex align-center">
                                    <View className="category-icon">
                                        <Image src={staticResource("common/right_arrows.png")} />
                                    </View>
                                </View>
                            </View>
                            <View
                                className="page-item flex align-center justify-between"
                                onClick={() => handleLink("/pages/user/collectProduct/index")}
                            >
                                <View className="item-left flex">
                                    <View className="left-icon" />
                                    <View className="left-text">{t("心愿单")}</View>
                                </View>
                                <View className="item-right flex align-center">
                                    <View className="category-icon">
                                        <Image src={staticResource("common/right_arrows.png")} />
                                    </View>
                                </View>
                            </View>
                            <View className="page-item flex align-center justify-between" onClick={() => handleLink("/pages/coupon/index?type=2")}>
                                <View className="item-left">
                                    <View className="left-icon" />
                                    <View className="left-text">{t("优惠券")}</View>
                                </View>
                                <View className="item-right flex align-center">
                                    {token ? <View className="right-text">{couponCount}</View> : null}
                                    <View className="category-icon">
                                        <Image src={staticResource("common/right_arrows.png")} />
                                    </View>
                                </View>
                            </View>
                            <View className="page-item flex align-center justify-between" onClick={() => handleLink("/pages/address/list")}>
                                <View className="item-left">
                                    <View className="left-icon" />
                                    <View className="left-text">{t("地址")}</View>
                                </View>
                                <View className="item-right flex align-center">
                                    <View className="category-icon">
                                        <Image src={staticResource("common/right_arrows.png")} />
                                    </View>
                                </View>
                            </View>
                            <View className="page-item flex align-center justify-between" onClick={() => handleLink("/pages/user/profile/index")}>
                                <View className="item-left">
                                    <View className="left-icon" />
                                    <View className="left-text">{t("设置")}</View>
                                </View>
                                <View className="item-right flex align-center">
                                    <View className="category-icon">
                                        <Image src={staticResource("common/right_arrows.png")} />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            ) : null}
        </>
    );
});

export default MainHeader;