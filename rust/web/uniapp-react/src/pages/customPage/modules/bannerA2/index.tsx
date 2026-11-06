import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import ImageSearchEntry from "@/components/imageSearchEntry";
import { designPxToDevicePx, designPxToRpx, formatCommonStyle } from "@/components/modules";
import { useImgInfo } from "@/hooks/useDecorate";
import { useScrollTop } from "@/hooks/index";
import { getAddressList } from "@/api/user/address";
import type { AddressFilterResult } from "@/types/user/address";
import { useConfigStore } from "@/store/config";
import { useRegionStore } from "@/store/region";
import { useUserStore } from "@/store/user";
import { redirect, getPx, getElementRect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    needStatusBar?: boolean;
}

/**
 * 内联移植自旧 components/navbarContent/index.vue（React 工程尚无该全局组件）。
 * bannerA2 只用到 height / needStatusBar 两个 prop，其余（fixed/placeholder 等）未传入故未搬。
 * 原 onShow 里的 getMenuButtonInfo/getSystemInfo 刷新随页面初始化完成，此处不再重复触发。
 */
function NavbarContent({ height = 45, needStatusBar = true, children }: { height?: number | string; needStatusBar?: boolean; children?: any }) {
    const menuTop = useConfigStore((s) => s.menuButtonInfo.top);
    const menuHeight = useConfigStore((s) => s.menuButtonInfo.height);
    const menuWidth = useConfigStore((s) => s.menuButtonInfo.width);
    const safeAreaTop = useConfigStore((s) => s.safeAreaInsets.top);

    const statusBarTop = menuTop ? menuTop - 2 : safeAreaTop;

    let navbarHeight: number | string = getPx(height);
    if (menuTop) {
        navbarHeight = menuHeight + 4;
    }

    const paddingRight = menuWidth ? menuWidth + 5 : 0;

    return (
        <View className="navbar-box nav-content-dnBzczIyODI" style={{ position: "static", background: "transparent" }}>
            {needStatusBar && <View className="status-bar" style={{ paddingTop: `${statusBarTop}px` }} />}
            {needStatusBar ? (
                <View className="navbar" style={{ height: `${navbarHeight}px`, paddingRight: `${paddingRight}px` }}>
                    {children}
                </View>
            ) : (
                <View className="navbar" style={{ height: `${navbarHeight}px` }}>{children}</View>
            )}
        </View>
    );
}

export default function BannerA2({ module, index, needStatusBar = true }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    const picList = useMemo(() => {
        const list = module?.bannerContent?.picList;
        if (!Array.isArray(list)) return [];
        return list.filter((item: any) => item?.picUrl || item?.picThumb);
    }, [module?.bannerContent?.picList]);

    const [realIndex, setRealIndex] = useState(0);

    const currentImageUrl = useMemo(() => {
        if (!picList.length) return "";
        const item = picList[realIndex] || picList[0];
        return imageFormat(item?.picUrl || item?.picThumb || "");
    }, [picList, realIndex]);

    const configStore = useConfigStore();

    // TODO(MIGRATION)：region store 仅迁移了 currentShop/nearestShopInfo 等基础字段，
    // currentSelectedName / currentRegion 尚未迁移，先按旧结构可选读取
    const regionStore = useRegionStore() as unknown as Record<string, any>;

    const userToken = useUserStore((s) => s.token);

    // 定位模式下默认展示的最近收货地址（优先选中/默认地址，其次列表首条）
    const [latestAddress, setLatestAddress] = useState<AddressFilterResult | null>(null);
    const latestAddressName = useMemo(() => latestAddress?.address || "", [latestAddress]);

    const fetchLatestAddress = async () => {
        if (!userToken) {
            setLatestAddress(null);
            return;
        }
        try {
            const result = await getAddressList({ page: 1, size: 20 });
            const records = result.records || [];
            setLatestAddress(records.find((item: any) => item.isSelected === 1) || records.find((item: any) => item.isDefault === 1) || records[0] || null);
        } catch (error) {
            console.error("获取最近收货地址失败:", error);
            setLatestAddress(null);
        }
    };

    // 进店模式：1-网店可切换，2-网店不可切换，3-定位可切换，4-定位不可切换
    const entryMode = useMemo(() => Number(configStore.storeEntryRule) || 1, [configStore.storeEntryRule]);

    // 是否走"显示当前网店"分支（模式一、二）；否则走"显示定位/收货地址"（模式三、四）
    const isShopMode = useMemo(() => entryMode === 1 || entryMode === 2, [entryMode]);

    // 是否允许切换（模式一、三可切换，模式二、四不可切换）
    const canSwitch = useMemo(() => entryMode === 1 || entryMode === 3, [entryMode]);

    // 头部左侧展示文本
    // 网店模式：优先取用户主动选择的 currentShop，回退到按定位计算的 nearestShopInfo
    // 定位模式：优先显示选中的收货地址/选点详情，回退到当前地区名
    // 注：当前模板未渲染门店/地址入口，此逻辑随旧版一并保留（scss 中 .area-select-box 同源）
    const entryText = useMemo(() => {
        if (isShopMode) {
            return regionStore.currentShop?.shopTitle || regionStore.nearestShopInfo?.shopTitle || t("选择门店");
        }
        // 定位模式：用户显式选择的展示名优先；否则默认最近收货地址；都没有才回退定位
        return regionStore.currentSelectedName || latestAddressName || regionStore.currentRegion?.regionName || t("定位中");
    }, [isShopMode, regionStore, latestAddressName]);
    void entryText;

    const handleAreaClick = () => {
        if (!canSwitch) return;
        if (isShopMode) {
            redirect({ url: "/pages/store/select/index" });
            return;
        }
        redirect({ url: "/pages/region/index" });
    };
    void handleAreaClick;

    const { scrollTop } = useScrollTop();

    // 测量点取 .image-ad-con 而非 swiper 内部的 .image-ad-item：后者宽度依赖 swiper 内部布局，
    // 页面返回且图片命中缓存时，测量会早于布局完成拿到 0 宽，把高度固化为 0 且不再有重算时机
    const HEIGHT_SELECTOR = ".image-ad-con";
    const { imgratio, setImgratio, height, getImgratio, getHeght } = useImgInfo();
    const [windowWidth, setWindowWidth] = useState(Taro.getWindowInfo().windowWidth);
    // 挂载期注册的回调闭包里读不到最新 state，用 ref 镜像（对应旧 windowWidth.value 的同步读取）
    const windowWidthRef = useRef(Taro.getWindowInfo().windowWidth);

    // swiper 必须有显式高度，测量未就绪时传 0 会折叠内容区，先用屏宽估算顶上
    const swiperHeight = useMemo(() => {
        if (height > 0) return height;
        if (!imgratio) return 0;
        return (windowWidth - designPxToDevicePx(20, windowWidth)) * imgratio;
    }, [height, imgratio, windowWidth]);

    // getImageInfo 在部分平台会失败，此时图片 load 事件是比例的唯一来源；
    // 比例只认首图，否则轮播切换背景图会带着高度一起跳
    const handleImageLoad = async (event: any) => {
        if (imgratio > 0) return;
        const width = Number(event?.detail?.width);
        const imageHeight = Number(event?.detail?.height);
        if (width <= 0 || imageHeight <= 0) return;
        setImgratio(imageHeight / width);
        await getHeght(HEIGHT_SELECTOR, rootRef);
    };

    const windowResizeCallback = async () => {
        windowWidthRef.current = Taro.getWindowInfo().windowWidth;
        setWindowWidth(windowWidthRef.current);
        updateNavbarHeight();
        await getHeght(HEIGHT_SELECTOR, rootRef);
    };

    // uni.onWindowResize → Taro.onWindowResize；onUnmounted 清理
    useEffect(() => {
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [bannerRectTop, setBannerRectTop] = useState(0);
    // 旧版 logoRectHeight 声明后从未赋值，恒为 0，这里保持一致
    const logoRectHeight = useRef(0).current;

    const fixed = useMemo(() => {
        let value = false;
        if (module.bannerStyle.effectType == "ceiling" && scrollTop > bannerRectTop + logoRectHeight) {
            value = true;
        }
        return value;
    }, [module.bannerStyle, scrollTop, bannerRectTop, logoRectHeight]);

    const selectColor = useMemo(() => {
        return module.bannerContent.swiperPageColor || "#333";
    }, [module.bannerContent]);

    const indicatorColor = useMemo(() => {
        return module.bannerContent.indicatorColor || "rgba(0, 0, 0, 0.2)";
    }, [module.bannerContent]);

    const mode = useMemo(() => {
        return module.picPageType == 1 ? "default" : "dot";
    }, [module.picPageType]);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle);
    }, [module.moduleStyle]);

    const swiperChange = (e: any) => {
        setRealIndex(e < picList.length ? e : 0);
    };

    const searchStyle = useMemo(() => {
        return `height: 100%; border-radius: ${designPxToRpx(module.bannerStyle?.searchRadius)}; background-color: ${module.bannerStyle?.searchBackgroundColor}`;
    }, [module.bannerStyle]);

    const searchTnputStyle = useMemo(() => {
        return `height: ${designPxToRpx(module.bannerStyle?.searchHeight)}; line-height: ${designPxToRpx(module.bannerStyle?.searchHeight)}; color: ${
            module.bannerStyle?.searchFontColor
        }; background-color: ${module.bannerStyle?.searchBackgroundColor}; --color: ${module.bannerStyle?.searchFontColor}`;
    }, [module.bannerStyle]);

    const [navbarHeightValue, setNavbarHeightValue] = useState<number | string>("");
    const updateNavbarHeight = () => {
        const heightStr = designPxToRpx(module.bannerStyle?.searchHeight);
        const next = heightStr ? designPxToDevicePx(Number(module.bannerStyle?.searchHeight), windowWidthRef.current) : "";
        setNavbarHeightValue(next);
    };
    // 对应旧 watch(searchHeight, updateNavbarHeight, { immediate: true })
    useEffect(() => {
        updateNavbarHeight();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.bannerStyle?.searchHeight]);

    // 对应旧 onMounted：先拿比例再测宽度，顺序颠倒会算出 0 高度
    useEffect(() => {
        (async () => {
            await getImgratio(currentImageUrl);
            await getHeght(HEIGHT_SELECTOR, rootRef);

            if (index == 0 && module.bannerStyle.effectType == "ceiling") {
                const bannerRes = await getElementRect(".banner", rootRef.current);
                if (bannerRes) {
                    setBannerRectTop(bannerRes.top);
                }
            }
            // 定位模式下拉取最近收货地址作为默认展示
            if (!isShopMode) {
                fetchLatestAddress();
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (picList.length === 0) {
        return null;
    }

    return (
        <View
            ref={rootRef}
            className="bannerA2 module-ad-con"
            style={{ "--select-color": selectColor, "--indicator-color": indicatorColor } as Record<string, string>}
        >
            <View className="banner-bg">
                <Image src={currentImageUrl} onLoad={handleImageLoad} />
            </View>
            <View className="bg-gradient" />
            <View
                className="banner-box"
                style={
                    commonStyle.moduleStyle.boxPaddingBottom +
                    commonStyle.moduleStyle.boxPaddingTop +
                    commonStyle.moduleStyle.boxPadding +
                    commonStyle.moduleStyle.backgroundSize +
                    commonStyle.moduleStyle.backgroundImage
                }
            >
                <View className="banner" style={`margin-top:${designPxToRpx(module.moduleStyle?.bannerMarginTop)};`}>
                    <View className="bar">
                        <NavbarContent height={navbarHeightValue} needStatusBar={needStatusBar}>
                            <View className="search-top">
                                <View
                                    className="search"
                                    style={searchStyle}
                                    onClick={() => {
                                        redirect({ url: "/pages/search/index" });
                                    }}
                                >
                                    <View className="search-icon" style={`color:${module.bannerStyle?.searchIconColor}`}>
                                        <Text className="iconfont-h5 icon-sousuo1" />
                                    </View>
                                    <View className="search-form">
                                        <View className="search-input" style={searchTnputStyle}>
                                            <View className="search-placeholder">{module.searchContent?.searchText}</View>
                                        </View>
                                        <ImageSearchEntry color={module.bannerStyle?.searchIconColor} />
                                    </View>
                                </View>
                            </View>
                        </NavbarContent>
                    </View>

                    {/* 旧版此处有一段被注释的吸顶 search-top 模板，按原样不迁移 */}

                    <View className="image-ad-warp">
                        <View className="image-ad-con">
                            {/* 旧 tig-swiper（:model-value="picList" :dot="false"）等价展开：
                                circular、autoplay 默认 true、interval 默认 3000、duration 默认 500；
                                :dot="false" → 关闭内置指示点，由下方自定义 .indicator-box 承担 */}
                            <Swiper
                                current={0}
                                className={module.picPageType == 3 ? "uni-swiper-dot-box" : ""}
                                style={{ height: swiperHeight + "px" }}
                                circular
                                indicatorDots={false}
                                autoplay
                                interval={3000}
                                duration={500}
                                onChange={(e: any) => swiperChange(e.detail.current)}
                            >
                                {picList.map((item: any, picIndex: number) => (
                                    <SwiperItem key={picIndex}>
                                        <View
                                            className="image-ad-item"
                                            style={`border-radius: ${designPxToRpx(module.bannerContent?.picRadius || 0)};overflow: hidden;`}
                                            onClick={() => {
                                                item.picLink && redirect({ url: urlFormat(item.picLink) });
                                            }}
                                        >
                                            <View
                                                className="item-content"
                                                style={`background-image:url(${imageFormat(item.picUrl || item.picThumb)});padding-top:${imgratio * 100}%;`}
                                            />
                                        </View>
                                    </SwiperItem>
                                ))}
                            </Swiper>
                            <View className={`indicator-box ${module.bannerContent.picPageType == 2 ? "type2" : ""}`}>
                                {picList.map((_, picIndex: number) => (
                                    <View key={picIndex + 1} className={`indicator-item ${realIndex + 1 === picIndex + 1 ? "indicator-item-active" : ""}`} />
                                ))}
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
