import { useEffect, useRef, useState } from "react";
import { View, Image } from "@tarojs/components";
import Taro, {
    useDidShow,
    usePullDownRefresh,
    useReachBottom,
    useRouter,
    useShareAppMessage,
    useShareTimeline,
    useUnload
} from "@tarojs/taro";

import DecorateModules from "@/pages/customPage/components/DecorateModules";
import PreviewTip from "@/pages/index/src/previewTip";
import SplashAd from "@/components/SplashAd";
import Masonry from "@/components/masonry/Masonry";
import MainHeader from "@/components/mainHeader";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getSplashAd, getCateProduct } from "@/api/home/home";
import type { GetProductFilterResult } from "@/types/home/home";
import { usecatnavStore } from "@/store/catnav";
import { useConfigStore } from "@/store/config";
import { staticResource, isOverseas, isDesktopBrowser, parseQueryString } from "@/utils";
import { setPageMeta } from "@/utils/seo";
import { handleDecorateLoadError } from "@/utils/handleDecorateLoadError";
import { usePageGuards } from "@/utils/pageMixin";
import checkAppUpdate from "@/utils/checkAppUpdate";
import { useScrollTop, useProductStyle } from "@/hooks";

import "./index.scss";

/**
 * 商城首页（自旧 pages/index/index.vue 1766 行移植：template 41 + script 303 + scss 1420）
 * - 开屏广告（SplashAd）→ 装修模块渲染 → catNav 分类商品瀑布流
 * - 外贸风皮肤（isOverseas）下顶置 mainHeader + 占位块
 * - 支持 previewId 预览；H5 端命中 bindDecorateId 时跳 PC 对应活动页
 *
 * 未平移项（均为旧代码中的死逻辑或无对应机制）：
 * - 旧 `showCatNav` ref 只被赋值、模板无消费，不迁；
 * - 旧 `bottomLoading` 仅服务于 `!bottomLoading && commodityList.length === 0` 空态分支，
 *   而该分支外层已限定 `commodityList.length > 0`，条件恒假，不迁；
 * - 旧 onShow 末尾 `uni.hideTabBar()` 面向原生 tabBar，Phase 1 不声明（MIGRATION §3.4），跳过；
 * - 旧 `#ifdef APP-PLUS` 的 checkAppUpdate 已随 H5 壳定案接线（utils/checkAppUpdate，壳桥读版本）。
 */
export default function Index() {
    usePageGuards();
    const router = useRouter();
    const { scrollTop } = useScrollTop();
    const resetCatnav = usecatnavStore((s) => s.reset);
    const previewId = useConfigStore((s) => s.previewId);
    const pageModules = useConfigStore((s) => s.pageModules);
    const commonHeaderHeight = useConfigStore((s) => s.commonHeaderHeight);

    const [loading, setLoading] = useState(false);
    const [modulesData, setModulesData] = useState<any[]>([]);
    const [pageModulesData, setPageModulesData] = useState<any>({});
    const [currentCategoryId, setCurrentCategoryId] = useState(0);
    const [commodityList, setCommodityList] = useState<GetProductFilterResult[]>([]);
    const { styleMap } = useProductStyle(commodityList);

    // 开屏广告
    const [splashShow, setSplashShow] = useState(false);
    const [adType, setAdType] = useState<"image" | "video">("image");
    const [adUrl, setAdUrl] = useState("");
    const [duration, setDuration] = useState(0);
    const [redirectType, setRedirectType] = useState("");
    const [redirectUrl, setRedirectUrl] = useState("");

    /** 外贸风皮肤开关：跨境构建 true；纯 o2o 构建下分支隐藏 */
    const isOverseasSkin = isOverseas();

    const pageRef = useRef(1);
    const loadendRef = useRef(false);
    const loadingRef = useRef(false);
    const currentCategoryIdRef = useRef(0);

    const getProductList = async () => {
        try {
            const result = await getCateProduct({ categoryId: currentCategoryIdRef.current, page: pageRef.current });
            if (result.records && result.records.length > 0) {
                setCommodityList((prev) => [...prev, ...result.records]);
                loadendRef.current = false;
            } else {
                loadendRef.current = true;
            }
        } catch (error) {
            console.error(error);
        }
    };

    const loadGoodsList = (categoryId: number) => {
        currentCategoryIdRef.current = categoryId;
        setCurrentCategoryId(categoryId);
        if (categoryId === 0) return;
        pageRef.current = 1;
        loadendRef.current = false;
        setCommodityList([]);
        void getProductList();
    };

    // H5 端 PC 跳转：装修页绑定 PC 活动页且为桌面浏览器时直接跳 PC
    const handlerToPc = (id: number) => {
        if (process.env.TARO_ENV !== "h5") return;
        try {
            if (window.self !== window.top) return;
        } catch {
            return;
        }
        if (isDesktopBrowser() && process.env.NODE_ENV !== "development") {
            const configStore = useConfigStore.getState();
            const url = `${configStore.baseInfo.pcDomain ? configStore.baseInfo.pcDomain : window.location.origin}/activity?id=${id}`;
            window.location.replace(url);
        }
    };

    const getSplashAdData = async () => {
        try {
            const result = await getSplashAd();
            if (!result) return;
            setSplashShow(result.state == 1);
            setAdType(result.materialType == 0 ? "image" : "video");
            setAdUrl(result.materialType == 0 ? (result.materialImg as string) : (result.materialVideo?.[0]?.videoUrl as string));
            setRedirectType(String(result.redirectType));
            setRedirectUrl(result.redirectUrl as string);
            setDuration(result.maxWaitTime);
        } catch (error) {
            console.error("获取开屏广告失败:", error);
        }
    };

    const getIndexData = async (forceRefresh = false) => {
        setLoading(true);
        loadingRef.current = true;
        try {
            const configStore = useConfigStore.getState();
            let res: any = forceRefresh ? null : configStore.homeDecorateData;
            if (!res) {
                res = await configStore.fetchHomeDecorateData(configStore.previewId);
            }
            if (process.env.TARO_ENV === "h5" && res.bindDecorateId) {
                handlerToPc(res.bindDecorateId);
            }
            setModulesData(res.moduleList);
            setPageModulesData(res.pageModule);
            useConfigStore.setState({ pageModules: res.pageModule });
            Taro.stopPullDownRefresh();
        } catch (error) {
            if (await handleDecorateLoadError(error)) {
                return;
            }
            console.error(error);
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    };

    useEffect(() => {
        const configStore = useConfigStore.getState();
        // 旧 #ifdef APP-PLUS || APP-HARMONY 的 checkAppUpdate：H5 壳形态下经桥读版本，
        // 非壳环境（浏览器/微信）getAppUpdateStatus 直接 reject 静默
        checkAppUpdate();
        // MP-WEIXIN scene 参数解析
        if (process.env.TARO_ENV === "weapp" && router.params?.scene) {
            Object.assign(router.params, parseQueryString(decodeURIComponent(router.params.scene)));
        }
        if (router.params?.previewId) {
            useConfigStore.setState({ previewId: Number(router.params.previewId) });
        }
        resetCatnav();
        void getSplashAdData();
        void getIndexData();
        if (process.env.TARO_ENV === "h5") {
            setPageMeta({
                title: configStore.baseInfo.shopTitle,
                description: configStore.baseInfo.shopDesc,
                keywords: configStore.baseInfo.shopTitle,
                type: "website"
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useUnload(() => {
        resetCatnav();
    });

    // 旧 onShow：返回本页时恢复滚动位置（延时 20ms）
    useDidShow(() => {
        if (scrollTop > 0) {
            setTimeout(() => {
                void Taro.pageScrollTo({ scrollTop, duration: 0 });
            }, 20);
        }
    });

    usePullDownRefresh(() => {
        currentCategoryIdRef.current = 0;
        setCurrentCategoryId(0);
        resetCatnav();
        void getIndexData(true);
    });

    useReachBottom(() => {
        if (currentCategoryIdRef.current > 0 && !loadingRef.current && !loadendRef.current) {
            pageRef.current += 1;
            void getProductList();
        }
    });

    useShareAppMessage(() => {
        return {
            title: useConfigStore.getState().baseInfo.shopTitle
        };
    });

    useShareTimeline(() => {
        return {
            title: useConfigStore.getState().baseInfo.shopTitle
        };
    });

    const cssVariable: Record<string, string> = {
        background: pageModules?.backgroundColor || undefined,
        backgroundImage: pageModules?.backgroundImage?.picUrl ? `url("${pageModules.backgroundImage.picUrl}")` : undefined,
        backgroundSize: (pageModules as any)?.backgroundSize,
        backgroundRepeat: (pageModules as any)?.backgroundRepeat
    } as any;

    return (
        <>
            {splashShow && (
                <SplashAd
                    adType={adType}
                    adUrl={adUrl}
                    duration={duration}
                    redirectType={redirectType}
                    redirectUrl={redirectUrl}
                    onClose={() => setSplashShow(false)}
                />
            )}

            <TigLayout>
                {/* 旧注释：layout sticky 失效，用 fixed + 占位 */}
                {isOverseasSkin && <MainHeader position="fixed" />}
                {isOverseasSkin && <View className="main-header-spacer" style={{ height: `${commonHeaderHeight || 0}px` }} />}

                {previewId > 0 && <PreviewTip />}

                {loading ? (
                    <View className="index_empty">
                        <Image lazyLoad src={staticResource("common/index_empty.png")} mode="widthFix" />
                    </View>
                ) : (
                    <View className="index">
                        <View className="decorate-page-window" style={cssVariable as any}>
                            <DecorateModules modules={modulesData} pageModles={pageModulesData} scrollTop={scrollTop} onLoadGoodsList={loadGoodsList} />
                            {currentCategoryId > 0 && commodityList.length > 0 && <Masonry commodityList={commodityList} styleMap={styleMap} />}
                        </View>
                    </View>
                )}
            </TigLayout>
        </>
    );
}
