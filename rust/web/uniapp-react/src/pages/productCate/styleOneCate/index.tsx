import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import TigImage from "@/components/tig/tig-image/TigImage";
import ImageSearchEntry from "@/components/imageSearchEntry";
import { getCategoryAll, getCategoryHot } from "@/api/productCate/productCate";
import type { filterSeleted } from "@/types/productCate/productCate";
import type { CateCenterV1Data } from "@/components/modules/cate-center/cate-center-v1/types";
import { buildCateCenterV1Vars, cateCenterV1Defaults } from "@/components/modules/cate-center/cate-center-v1/config";
import { deepMerge } from "@/utils/deepMerge";
import { useConfigStore } from "@/store/config";
import { redirect, isOverseas } from "@/utils";
import { t } from "@/utils/i18n";
import TopHeader from "../src/TopHeader";

import "./index.scss";

interface Props {
    /** 对应旧 v-model:cat-id */
    catId?: number;
    onCatIdChange?: (id: number) => void;
    /** 装修配置 */
    module?: CateCenterV1Data;
}

/**
 * 分类样式一组件（自旧 pages/productCate/styleOneCate.vue 移植）
 * - 左右分栏布局
 * - 左侧一级分类，右侧二级分类宫格
 * - 支持 cateCenterV1 装修配置
 */
export default function StyleOneCate({ catId = 0, onCatIdChange, module = {} as CateCenterV1Data }: Props) {
    const configStoreCommonHeaderHeight = useConfigStore((s) => s.commonHeaderHeight);

    const moduleConfig = useMemo<CateCenterV1Data>(() => {
        return deepMerge({ ...cateCenterV1Defaults } as any, module || {});
    }, [module]);

    const decorateVars = useMemo(() => buildCateCenterV1Vars(moduleConfig), [moduleConfig]);

    const searchPlaceholder = moduleConfig.searchPlaceholder || cateCenterV1Defaults.searchPlaceholder || t("点击搜索商品信息");
    const isOverseasSkin = isOverseas();
    const recommendText = (moduleConfig.recommendText ?? "").trim();
    const showRecommendEntry = moduleConfig.showRecommend !== false && recommendText.length > 0;

    /** 外贸皮肤 mainHeader 占位（fixed 后脱离文档流） */
    const mainHeaderSpacerStyle = isOverseasSkin ? { height: `${configStoreCommonHeaderHeight || 0}px` } : undefined;

    /** 左侧栏 fixed 偏移：海外顶在 mainHeader 下，国内仍为导航 + 搜索条 */
    const asideOffsetStyle = isOverseasSkin ? { top: `${configStoreCommonHeaderHeight || 0}px`, marginTop: "0" } : undefined;

    /** 右侧内容区：海外不再预留国内搜索条的 98rpx */
    const conterOffsetStyle = isOverseasSkin ? { marginTop: "0" } : undefined;

    const [cateList, setCateList] = useState<any[]>([]);
    const [childCat, setChildCat] = useState<filterSeleted[]>([]);
    const [hotCat, setHotCat] = useState<filterSeleted[]>([]);
    const [partAllLoading, setPartAllLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showCatLevel] = useState(0);

    // catId 由父组件持有（v-model）；异步回调里读 ref 镜像避免陈旧闭包（对应旧 defineModel ref）
    const catIdRef = useRef(catId);
    catIdRef.current = catId;
    /** 装修配置快照（异步回调里读，对应旧 computed 的即时值） */
    const showRecommendEntryRef = useRef(showRecommendEntry);
    showRecommendEntryRef.current = showRecommendEntry;

    const toSearch = () => {
        Taro.navigateTo({
            url: "/pages/search/index"
        });
    };

    const getAllCategory = async () => {
        setPartAllLoading(true);
        try {
            const result: any = await getCategoryAll();
            const list = result || [];
            setCateList(list);
            // 推荐入口关闭时，默认选中第一个分类，避免右侧空白
            if (!showRecommendEntryRef.current && list.length > 0 && catIdRef.current === 0) {
                const first = list[0];
                const nextId = Number(first.categoryId) || 0;
                catIdRef.current = nextId;
                onCatIdChange?.(nextId);
                setChildCat(first.children || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const changeCat = (id: number, item?: any) => {
        onCatIdChange?.(id);
        catIdRef.current = id;
        if (item) {
            setChildCat(item.children || []);
        }
    };

    const getHotCatList = async () => {
        try {
            const result: any = await getCategoryHot();
            setHotCat(result || []);
            setLoading(false);
        } catch (err) {
            console.error(err);
        }
    };

    // 对应旧 setup 阶段的 getAllCategory() / getHotCatList()
    useEffect(() => {
        void getAllCategory();
        void getHotCatList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toSearchResult = (categoryId: number) => {
        redirect({ url: `/pages/search/result?categoryId=${categoryId}` });
    };

    return (
        <View style={decorateVars as any}>
            {/* fixed：父级 tig-layout 默认 overflow:hidden，sticky 会被裁切导致头部上顶 */}
            {isOverseasSkin && <TopHeader placeholder={searchPlaceholder} />}
            {isOverseasSkin && <View className="main-header-spacer" style={mainHeaderSpacerStyle as any} />}
            {!isOverseasSkin && <TigNavbar showLeft={false} title={t("产品分类")} />}
            {(loading || !partAllLoading) && (
                <View className="page-loading">
                    <View className="ico" />
                </View>
            )}
            {partAllLoading && (
                <View className="pageMain">
                    {showCatLevel == 0 && (
                        <View className={`productSort ${isOverseasSkin ? "productSort--overseas" : ""}`}>
                            {!isOverseasSkin && (
                                <View className="header acea-row row-center-wrapper">
                                    <View
                                        className="acea-row row-between-wrapper input"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toSearch();
                                        }}
                                    >
                                        <Text className="iconfont-h5 icon-sousuo" />
                                        <View className="txt">{t(searchPlaceholder)}</View>
                                        <ImageSearchEntry flushRight />
                                    </View>
                                </View>
                            )}
                            <View className="aside" style={asideOffsetStyle as any}>
                                {showRecommendEntry && (
                                    <View
                                        className={"item acea-row row-center-wrapper " + (catId == 0 ? "on" : "")}
                                        onClick={() => changeCat(0)}
                                    >
                                        <Text>{t(recommendText)}</Text>
                                    </View>
                                )}
                                {cateList.map((item: any, index) => (
                                    <View
                                        key={index}
                                        className={"item acea-row row-center-wrapper " + (catId == item.categoryId ? "on" : "")}
                                        // 原 :data-cat_id（旧版供事件委托使用，逻辑未消费，保留语义注释）
                                        onClick={() => changeCat(item.categoryId, item)}
                                    >
                                        {item.catShortName ? <Text>{item.catShortName}</Text> : <Text>{item.categoryName}</Text>}
                                    </View>
                                ))}
                            </View>
                            <View className="conter" style={conterOffsetStyle as any}>
                                {!loading && (
                                    <>
                                        {catId == 0 && showRecommendEntry && (
                                            <View className="listw">
                                                <View className="title acea-row row-center-wrapper">
                                                    <View className="name">{t("热门分类")}</View>
                                                </View>
                                                <View className="list acea-row">
                                                    {hotCat.map((hot, index) => (
                                                        <View
                                                            key={index}
                                                            className="item acea-row row-column row-middle"
                                                            onClick={() => toSearchResult(hot.categoryId)}
                                                        >
                                                            <View className="picture">
                                                                <TigImage src={hot.categoryPic || ""} mode="aspectFill" />
                                                            </View>
                                                            {moduleConfig.showCategoryName !== false && <View className="name line1">{hot.categoryName}</View>}
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                        {catId > 0 &&
                                            childCat.map((cat, index) => (
                                                <View key={index} className="listw" id={`b${index}`}>
                                                    <View className="title acea-row row-center-wrapper">
                                                        <View className="item acea-row row-column row-middle" onClick={() => toSearchResult(cat.categoryId)}>
                                                            <View className="name">{cat.categoryName}</View>
                                                        </View>
                                                    </View>
                                                    <View className="list acea-row">
                                                        {cat.children?.map((childCatItem, index1) => (
                                                            <View
                                                                key={index1}
                                                                className="item acea-row row-column row-middle"
                                                                onClick={() => toSearchResult(childCatItem.categoryId)}
                                                            >
                                                                {childCatItem.categoryPic && (
                                                                    <View className="picture">
                                                                        <TigImage src={childCatItem.categoryPic} />
                                                                    </View>
                                                                )}
                                                                {moduleConfig.showCategoryName !== false && (
                                                                    <View className="name line1">{childCatItem.categoryName}</View>
                                                                )}
                                                            </View>
                                                        ))}
                                                    </View>
                                                </View>
                                            ))}
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}
