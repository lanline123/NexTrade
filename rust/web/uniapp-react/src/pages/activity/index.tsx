import { useEffect, useRef, useState } from "react";
import { View, Image } from "@tarojs/components";
import Taro, { useLoad, usePullDownRefresh, useShareAppMessage, useShareTimeline } from "@tarojs/taro";

import DecorateModules from "@/pages/customPage/components/DecorateModules";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigBackTop from "@/components/tig/tig-back-top";
import { getIndex } from "@/api/home/home";
import { staticResource, isDesktopBrowser, parseQueryString } from "@/utils";
import { handleDecorateLoadError } from "@/utils/handleDecorateLoadError";
import { usePageGuards } from "@/utils/pageMixin";
import { useConfigStore } from "@/store/config";
import { useScrollTop } from "@/hooks";

import "./index.scss";

/**
 * 活动页（自旧 pages/activity/index.vue 移植，script 115 行 / template 19 行）。
 * 纯装修渲染页：拉 getIndex(id) 拿 moduleList 交给 DecorateModules，无分类商品逻辑。
 *
 * 旧 scoped scss（含首页历史遗留的 .nav/.news/.specialArea/.homeTopBar/.live-list/.headlines
 * 等节点样式，共 1200+ 行）已按 MIGRATION §7 逐条拷入 index.scss，不做删减。
 */
export default function Activity() {
    usePageGuards();
    const { scrollTop } = useScrollTop();
    const configStore = useConfigStore();
    const baseInfo = useConfigStore((s) => s.baseInfo);

    const [loading, setLoading] = useState(true);
    const [modulesData, setModulesData] = useState<any[]>([]);
    const [pageModule, setPageModule] = useState<any>({});
    // 旧 ref showCatNav：仅赋值、无消费端，为逐行对齐保留
    const [, setShowCatNav] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const isInIframe = () => {
        try {
            return window.self !== window.top;
        } catch {
            return true;
        }
    };

    const handlerToPc = (id: number) => {
        if (process.env.TARO_ENV !== "h5") return;
        if (isInIframe()) return;

        const isPC = isDesktopBrowser();
        if (isPC) {
            const url = `${baseInfo.pcDomain ? baseInfo.pcDomain : window.location.origin}/activity?id=${id}`;
            window.location.replace(url);
        }
    };

    const getIndexData = async (id?: number) => {
        try {
            const res = await getIndex(id);

            // #ifdef H5
            if (process.env.TARO_ENV === "h5" && res.bindDecorateId) {
                handlerToPc(res.bindDecorateId);
            }
            // #endif

            if (!mountedRef.current) return;
            setModulesData(res.moduleList);
            setShowCatNav(1);
            setPageModule(res.pageModule);
            Taro.stopPullDownRefresh();
        } catch (error) {
            if (await handleDecorateLoadError(error)) {
                return;
            }
            console.error(error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    useLoad((options: Record<string, any>) => {
        if (process.env.TARO_ENV === "weapp") {
            if (options?.scene) {
                Object.assign(options, parseQueryString(decodeURIComponent(options.scene)));
            }
        }
        // 兼容后台推广链接 / 小程序码使用的 previewId 参数
        const id = options?.id || options?.previewId;
        if (id) {
            void getIndexData(id);
        }
    });

    usePullDownRefresh(() => {
        void getIndexData();
    });

    useShareAppMessage(() => {
        return {
            title: configStore.baseInfo.shopTitle
        };
    });

    useShareTimeline(() => {
        return {
            title: configStore.baseInfo.shopTitle
        };
    });

    return (
        <TigLayout>
            <View>
                {loading ? (
                    <View className="index_empty">
                        <Image lazyLoad src={staticResource("common/index_empty.png")} mode="widthFix" />
                    </View>
                ) : (
                    <View className="index">
                        <View className="decorate-page-window">
                            <DecorateModules modules={modulesData} pageModles={pageModule} scrollTop={scrollTop} />
                        </View>
                    </View>
                )}
                <TigBackTop scrollTop={scrollTop} />
            </View>
        </TigLayout>
    );
}
