import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "@tarojs/components";
import { useLoad, useShareAppMessage } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import ShopModules from "@/pages/customPage/modules/shopModules";
import { getShopDecorate, getShopDetail } from "@/api/shop/shop";
import type { ShopDetailItem } from "@/types/shop/shop";
import type { PageModule } from "@/types/home/home";
import { useConfigStore } from "@/store/config";
import { setPageMeta } from "@/utils/seo";
import { parseQueryString } from "@/utils";
import { handleDecorateLoadError } from "@/utils/handleDecorateLoadError";
import { usePageGuards } from "@/utils/pageMixin";
import { t } from "@/utils/i18n";

import "./index.scss";

/**
 * 店铺首页（自旧 pages/shop/index.vue 121 行移植）
 * - 店铺装修模块由 shopModules 分发（无 navbar/searchBar，头部由 shopInfo 模块承载）
 * - 页面背景色/背景图取装修 pageModule 配置
 *
 * TODO(MIGRATION)：旧 `defineOptions({ componentPlaceholder: { modules: "view" } })` 为小程序
 * 分包异步化的占位配置，Taro 工程无分包/无该机制，故未平移（不影响渲染结果）。
 */
export default function ShopIndex() {
    usePageGuards();

    const baseShopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    const shopIdRef = useRef(0);
    const previewIdRef = useRef<number | undefined>(undefined);

    const [shopId, setShopId] = useState(0);
    const [navbarTitle, setNavbarTitle] = useState(t("店铺详情"));
    const [modulesList, setModulesList] = useState<any[]>([]);
    const [pageModulesData, setPageModulesData] = useState<PageModule>({} as PageModule);
    const [shopInfo, setShopInfo] = useState<ShopDetailItem>({} as ShopDetailItem);

    const getShopInfo = useCallback(async () => {
        try {
            const result = await getShopDetail(shopIdRef.current);
            setShopInfo(result);
            setNavbarTitle(result.shopTitle);
        } catch (error: any) {
            console.error(error);
        }
    }, []);

    const __getShopDecorate = useCallback(async () => {
        try {
            const result = await getShopDecorate(shopIdRef.current, previewIdRef.current);
            setModulesList(result.moduleList);
            setPageModulesData(result.pageModule);
        } catch (error) {
            if (await handleDecorateLoadError(error)) {
                return;
            }
            console.error(error);
        }
    }, []);

    // 对应旧 onLoad
    useLoad((options: any) => {
        // #ifdef MP-WEIXIN
        if (process.env.TARO_ENV === "weapp" && options?.scene) {
            Object.assign(options, parseQueryString(decodeURIComponent(options.scene)));
        }
        // #endif
        previewIdRef.current = options?.previewId ? Number(options.previewId) : undefined;
        if (options && options.shopId) {
            const id = Number(options.shopId);
            shopIdRef.current = id;
            setShopId(id);
            void getShopInfo();
            void __getShopDecorate();
        }
    });

    // 对应旧 onMounted 的 #ifdef H5
    useEffect(() => {
        if (process.env.TARO_ENV !== "h5") return;
        setPageMeta({
            title: `${t("店铺首页")} - ${baseShopTitle}`,
            description: `${t("欢迎访问")}${baseShopTitle}`
        });
    }, [baseShopTitle]);

    const cssVariable = useMemo(() => {
        const sizeMap: Record<string, string> = {
            "1": "100% auto",
            "2": "auto 100%",
            "3": "100% 100%"
        };
        const repeatMap: Record<string, string> = {
            "1": "no-repeat",
            "2": "repeat",
            "3": "repeat-x",
            "4": "repeat-y"
        };
        return {
            backgroundColor: `${pageModulesData.backgroundColor}`,
            backgroundImage: `url("${pageModulesData.backgroundImage?.picUrl}")`,
            backgroundSize: `${sizeMap[pageModulesData.backgroundSize]}`,
            backgroundRepeat: `${repeatMap[pageModulesData.backgroundRepeat]}`
        } as CSSProperties;
    }, [pageModulesData]);

    useShareAppMessage(() => {
        return {
            title: shopInfo.shopTitle
        };
    });

    return (
        <TigLayout
            title={navbarTitle}
            shopId={shopId}
            background={pageModulesData.titleBackgroundColor}
            color={pageModulesData.titleColor}
        >
            <View className="decorate-page-window" style={cssVariable}>
                {Object.keys(shopInfo).length > 0 && (
                    <ShopModules modules={modulesList} shopInfo={shopInfo} onRefreshShopDetail={getShopInfo} />
                )}
            </View>
        </TigLayout>
    );
}
