import { useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import type { ShopDetailItem } from "@/types/shop/shop";
import { useConfigStore } from "@/store/config";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";
import Service from "@/components/service";

import MenuPop from "../menuPop";

import "./index.scss";

interface Props {
    showDownload?: boolean;
    downloadBusy?: boolean;
    /** 滚动位置（对应旧 v-model:modelValue，Number） */
    modelValue?: number;
    activeModule?: string;
    /** 对应旧 event prop（Function）：点击模块后执行锚点滚动 */
    event?: (val: string) => void;
    isCollect?: boolean;
    /** 布局风格变体：A1 / A3 使用贴合式双层导航 */
    layoutStyle?: string;
    /** A3 商城头部显示时，二级导航吸附在它的实测高度之后。 */
    hasMainHeader?: boolean;
    showService?: boolean | number;
    productId?: string | number;
    shopInfo?: ShopDetailItem;
    /** 对应旧 emit("update:modelValue")（旧组件未实际触发，保留契约） */
    onUpdateModelValue?: (val: number) => void;
    /** 对应旧 emit("update:activeModule") */
    onUpdateActiveModule?: (val: string) => void;
    /** 对应旧 emit("share") */
    onShare?: () => void;
    /** 对应旧 emit("collect") */
    onCollect?: () => void;
    /** 对应旧 emit("download") */
    onDownload?: () => void;
}

/**
 * 商品详情顶部导航组件（自旧 pages/product/src/productNav.vue 移植）
 * - A1/A3 装修风格：贴合式双层导航（含快捷菜单、收藏、客服）
 * - 默认风格：悬浮式导航（透明度随滚动渐变）
 * - v-bind() 已转内联 style（paddingTop/iconInfo 相关），scss 内注释原位置
 */
export default function ProductNav({
    showDownload = false,
    downloadBusy = false,
    modelValue = 0,
    activeModule = "",
    event,
    isCollect = false,
    layoutStyle = "",
    hasMainHeader = false,
    showService = true,
    productId = "",
    shopInfo = {} as ShopDetailItem,
    onUpdateModelValue: _onUpdateModelValue,
    onUpdateActiveModule,
    onShare,
    onCollect,
    onDownload
}: Props) {
    const configStore = useConfigStore();

    // A1 标准风与 A3 跨境风共用贴合式双层导航；A2 门店风保留原悬浮导航。
    const isDecorateNav = layoutStyle === "A1" || layoutStyle === "A3";
    const isOverseasNav = layoutStyle === "A3";
    const navTop = hasMainHeader ? configStore.commonHeaderHeight : 0;
    // 对应旧 configStore.saveTop（uniapp 版为 safeAreaInsets.top 的 getter，React 版直接取 safeAreaInsets.top）
    const saveTop = configStore.safeAreaInsets.top;

    const decoratedSafeTop = useMemo(() => {
        // 旧 #ifdef MP-WEIXIN
        if (process.env.TARO_ENV === "weapp") {
            if (isDecorateNav && !hasMainHeader) {
                return Math.max(configStore.menuButtonInfo.top || saveTop || 0, 0);
            }
        }
        return 0;
    }, [isDecorateNav, hasMainHeader, configStore.menuButtonInfo.top, saveTop]);

    const decoratedSafeRight = useMemo(() => {
        // 旧 #ifdef MP-WEIXIN
        if (process.env.TARO_ENV === "weapp") {
            if (isDecorateNav && !hasMainHeader) {
                return Math.max(configStore.menuButtonInfo.width || 0, 0);
            }
        }
        return 0;
    }, [isDecorateNav, hasMainHeader, configStore.menuButtonInfo.width]);

    const decoratedNavStyle = {
        top: `${navTop}px`,
        "--product-nav-safe-top": `${decoratedSafeTop}px`,
        "--product-nav-safe-right": `${decoratedSafeRight}px`,
        "--product-nav-placeholder-height": `calc(77rpx + ${decoratedSafeTop}px)`
    } as Record<string, string | number>;

    // 与项目 D 一致：页面开始滚动后，标题切换为商详模块 tabs。
    const decorateTabThreshold = navTop;

    const handleDownload = () => {
        if (downloadBusy) return;
        setShowQuickMenu(false);
        setShowMenu(false);
        onDownload?.();
    };

    // 评价锚点随配置动态更新。
    const moduleList = useMemo(() => {
        const list = [
            {
                label: t("商详"),
                value: ".product-area"
            }
        ];
        if (configStore.productCommentEnabled === 1) {
            list.push({
                label: t("评价"),
                value: ".evaluate-area"
            });
        }
        list.push({
            label: t("详情"),
            value: ".product-detail-area"
        });
        return list;
    }, [configStore.productCommentEnabled]);

    const contentThresholdValue = 250;
    const iconThresholdValue = contentThresholdValue - 80;
    const iconOpacity = useMemo(() => {
        let opacity = 1;
        if (modelValue > iconThresholdValue) {
            opacity = 0;
        } else if (modelValue < iconThresholdValue && modelValue > 0) {
            opacity = (iconThresholdValue - modelValue) / iconThresholdValue;
        }
        if (modelValue > contentThresholdValue) {
            opacity = 1;
        }
        return opacity;
    }, [modelValue, iconThresholdValue, contentThresholdValue]);

    const contentOpacity = useMemo(() => {
        let opacity = 0;
        if (modelValue > contentThresholdValue) {
            opacity = 1;
        } else if (modelValue < contentThresholdValue && modelValue > 0) {
            opacity = modelValue / contentThresholdValue;
        }
        return opacity;
    }, [modelValue, contentThresholdValue]);

    const handleClick = (val: string) => {
        onUpdateActiveModule?.(val);
        event?.(val);
    };

    const [showMenu, setShowMenu] = useState(false);
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const handelShowMenu = () => {
        setShowMenu(true);
    };
    const handleSearch = () => {
        setShowQuickMenu(false);
        redirect({ url: "/pages/search/index" });
    };
    const handleQuickShare = () => {
        setShowQuickMenu(false);
        onShare?.();
    };
    const handleBack = () => {
        // 旧 #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            history.back();
        }

        // 旧 #ifndef H5
        if (process.env.TARO_ENV !== "h5") {
            Taro.navigateBack();
        }
    };

    // 对应旧 computed paddingTop（v-bind(paddingTop) 转内联 style）
    const paddingTop = useMemo(() => {
        let num = saveTop + 10;
        // 旧 #ifdef MP-WEIXIN
        if (process.env.TARO_ENV === "weapp") {
            num = configStore.menuButtonInfo.top;
        }
        return num + "px";
    }, [saveTop, configStore.menuButtonInfo.top]);

    // 对应旧 computed iconInfo：configStore.menuButtonInfo
    const iconInfo = configStore.menuButtonInfo;
    // 旧 scss 里 MP-WEIXIN 分支的 top/height/padding-top:0 覆盖，统一收拢为内联 style
    const isWeapp = process.env.TARO_ENV === "weapp";

    // 旧 .product-nav-icon 内联样式（原 scss：padding-top: v-bind(paddingTop)；MP-WEIXIN: top/height/display:flex/align-items:center/padding-top:0）
    const navIconStyle = {
        paddingTop: isWeapp ? 0 : paddingTop,
        top: isWeapp ? `${iconInfo.top}px` : undefined,
        height: isWeapp ? `${iconInfo.height}px` : undefined,
        display: isWeapp ? "flex" : undefined,
        alignItems: isWeapp ? "center" : undefined
    } as Record<string, string | number | undefined>;

    // 旧 .product-nav-right-group 内联样式（原 scss：padding-top: v-bind(paddingTop)；MP-WEIXIN: right/top/height/padding-top:0）
    const rightGroupStyle = {
        paddingTop: isWeapp ? 0 : paddingTop,
        right: isWeapp ? `${iconInfo.width + 20}px` : undefined,
        top: isWeapp ? `${iconInfo.top}px` : undefined,
        height: isWeapp ? `${iconInfo.height}px` : undefined
    } as Record<string, string | number | undefined>;

    // 旧 .product-nav-middle 内联样式（原 scss：padding-top: v-bind(paddingTop)；MP-WEIXIN: height/padding-right/padding-bottom:0）
    const middleStyle = {
        paddingTop,
        height: isWeapp ? `${iconInfo.height}px` : undefined,
        paddingRight: isWeapp ? `${iconInfo.width + 40}px` : undefined
    } as Record<string, string | number | undefined>;

    return (
        <>
            {/* 装修风格：贴合式双层导航（A1 标准风 / A3 跨境风） */}
            {isDecorateNav ? (
                <View
                    className={`product-nav product-nav--decorated ${isOverseasNav ? "product-nav--overseas" : ""}`}
                    style={decoratedNavStyle as any}
                >
                    <View className="product-nav-container decorated">
                        <View
                            className="nav-left"
                            onClick={() => {
                                handleBack();
                            }}
                        >
                            <Text className="iconfont-h5 icon-fanhui" />
                        </View>
                        <View className="product-nav-middle decorated">
                            {modelValue <= decorateTabThreshold ? (
                                <View className="middle-title">{t("商品详情")}</View>
                            ) : (
                                <View className="module-list">
                                    {moduleList.map((item) => (
                                        <View
                                            key={item.label}
                                            className={`module-text ${item.value === activeModule ? "active" : ""}`}
                                            onClick={() => handleClick(item.value)}
                                        >
                                            {item.label}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                        <View
                            className="nav-collect"
                            onClick={() => {
                                onCollect?.();
                            }}
                        >
                            <Text className={`iconfont-h5 ${isCollect ? "icon-yishoucang1" : "icon-shoucang2"}`} />
                        </View>
                        <View
                            className="nav-more"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowQuickMenu((v) => !v);
                            }}
                        >
                            <Text className="iconfont-h5 icon-gengduo2" />
                            <View className={`more-menu-box ${showQuickMenu ? "showMenu" : ""}`}>
                                <View className="more-menu">
                                    <View
                                        className="menu-item"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSearch();
                                        }}
                                    >
                                        <View className="iconfont-h5 item-icon icon-a-34" />
                                        <View className="item-name">{t("搜索")}</View>
                                    </View>
                                    <View
                                        className="menu-item"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleQuickShare();
                                        }}
                                    >
                                        <View className="iconfont-h5 item-icon icon-af" />
                                        <View className="item-name">{t("分享")}</View>
                                    </View>
                                    {showDownload ? (
                                        <View
                                            className={`menu-item ${downloadBusy ? "download-busy" : ""}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload();
                                            }}
                                        >
                                            <View className="iconfont-h5 item-icon icon-sucai" />
                                            <View className="item-name">{t(downloadBusy ? "正在准备素材" : "素材下载")}</View>
                                        </View>
                                    ) : null}
                                    {showService ? (
                                        <Service phone={shopInfo.kefuPhone} productId={Number(productId)} shopId={shopInfo.shopId}>
                                            <View className="menu-item">
                                                <View className="iconfont-h5 item-icon icon-a-22222" />
                                                <View className="item-name">{t("客服")}</View>
                                            </View>
                                        </Service>
                                    ) : null}
                                </View>
                            </View>
                            {/* 旧 v-show → display 控制 */}
                            <View
                                className="shade-box"
                                style={{ display: showQuickMenu ? undefined : "none" }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowQuickMenu(false);
                                }}
                            />
                        </View>
                    </View>
                </View>
            ) : (
                /* 默认风格：悬浮式导航 */
                <View className="product-nav" style={{ top: navTop + "px" }}>
                    <View className="product-nav-container">
                        <View
                            className="product-nav-left product-nav-icon"
                            style={{ ...navIconStyle, opacity: iconOpacity } as any}
                            onClick={() => {
                                handleBack();
                            }}
                        >
                            <Text className={`iconfont icon-houtui ${modelValue > contentThresholdValue ? "change" : ""}`} />
                        </View>

                        <View
                            className="product-nav-middle"
                            style={{ ...middleStyle, opacity: contentOpacity } as any}
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            {moduleList.map((item) => (
                                <View
                                    key={item.label}
                                    className={`middle-text ${item.value === activeModule ? "active" : ""}`}
                                    onClick={() => handleClick(item.value)}
                                >
                                    {item.label}
                                </View>
                            ))}
                        </View>
                        <View className="product-nav-right-group" style={{ ...rightGroupStyle, opacity: iconOpacity } as any}>
                            {modelValue <= contentThresholdValue ? (
                                <>
                                    <View
                                        className={`product-nav-icon action-btn ${modelValue > contentThresholdValue ? "action-btn--plain" : ""}`}
                                        onClick={() => {
                                            onShare?.();
                                        }}
                                    >
                                        <Text className={`iconfont-h5 icon-fenxiang ${modelValue > contentThresholdValue ? "change" : ""}`} />
                                    </View>
                                    <View
                                        className={`product-nav-icon action-btn ${modelValue > contentThresholdValue ? "action-btn--plain" : ""}`}
                                        onClick={() => {
                                            onCollect?.();
                                        }}
                                    >
                                        <Text
                                            className={`iconfont-h5 ${isCollect ? "icon-yishoucang" : "icon-shoucang1"} ${
                                                modelValue > contentThresholdValue ? "change" : ""
                                            }`}
                                        />
                                    </View>
                                </>
                            ) : null}
                            <View
                                className={`product-nav-icon action-btn ${modelValue > contentThresholdValue ? "action-btn--plain" : ""}`}
                                onClick={handelShowMenu}
                            >
                                <Text
                                    className={`iconfont-h5 icon-gengduo2 ${modelValue > contentThresholdValue ? "change icon-gengduo" : ""}`}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            )}
            {isDecorateNav && !isOverseasNav ? <View className="product-nav-placeholder" /> : null}
            {/* 旧 <menuPop v-model="showMenu"> → modelValue + onUpdateModelValue */}
            <MenuPop modelValue={showMenu} onUpdateModelValue={(val) => setShowMenu(val)} showDownload={showDownload} downloadBusy={downloadBusy} onDownload={handleDownload} />
        </>
    );
}
