import { useEffect, useRef, useState } from "react";
import { View, Image } from "@tarojs/components";
import Taro, { useDidShow, usePullDownRefresh, useReachBottom, useRouter, useShareAppMessage, useShareTimeline } from "@tarojs/taro";

import DecorateModules from "./components/DecorateModules";
import Masonry from "@/components/masonry/Masonry";
import TigBackTop from "@/components/tig/tig-back-top";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getIndex, getCateProduct } from "@/api/home/home";
import type { GetProductFilterResult } from "@/types/home/home";
import { usecatnavStore } from "@/store/catnav";
import { staticResource } from "@/utils";
import { handleDecorateLoadError } from "@/utils/handleDecorateLoadError";
import { usePageGuards } from "@/utils/pageMixin";
import { useConfigStore } from "@/store/config";
import { useScrollTop } from "@/hooks";

import "./index.scss";

export default function CustomPage() {
    usePageGuards();
    const router = useRouter();
    const { scrollTop } = useScrollTop();
    const resetCatnav = usecatnavStore((s) => s.reset);
    const previewId = useConfigStore((s) => s.previewId);

    const [loading, setLoading] = useState(false);
    const [modulesData, setModulesData] = useState<any[]>([]);
    const [pageModule, setPageModule] = useState<any>({});
    const [currentCategoryId, setCurrentCategoryId] = useState(0);
    const [commodityList, setCommodityList] = useState<GetProductFilterResult[]>([]);

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

    const getIndexData = async (id?: number) => {
        setLoading(true);
        loadingRef.current = true;
        try {
            const res = await getIndex(id);
            setModulesData(res.moduleList);
            setPageModule(res.pageModule);
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
        if (router.params.id) {
            void getIndexData(Number(router.params.id));
        } else {
            void getIndexData(previewId || undefined);
        }
        resetCatnav();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.params.id]);

    usePullDownRefresh(() => {
        currentCategoryIdRef.current = 0;
        setCurrentCategoryId(0);
        resetCatnav();
        void getIndexData();
    });

    useReachBottom(() => {
        if (currentCategoryIdRef.current > 0 && !loadingRef.current && !loadendRef.current) {
            pageRef.current += 1;
            void getProductList();
        }
    });

    // 旧 onShow：返回本页时恢复滚动位置（旧延时 50ms，本页比首页多一档）
    useDidShow(() => {
        if (scrollTop > 0) {
            setTimeout(() => {
                void Taro.pageScrollTo({ scrollTop, duration: 0 });
            }, 50);
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
                            <DecorateModules modules={modulesData} pageModles={pageModule} scrollTop={scrollTop} onLoadGoodsList={loadGoodsList} />
                            {currentCategoryId > 0 && commodityList.length > 0 && <Masonry commodityList={commodityList} />}
                        </View>
                    </View>
                )}
                <TigBackTop scrollTop={scrollTop} />
            </View>
        </TigLayout>
    );
}
