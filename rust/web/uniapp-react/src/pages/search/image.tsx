import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, usePageScroll, useReachBottom } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import {
    getImageSearchAttributes,
    getImageSearchFilter,
    getImageSearchProduct,
    isImageSearchDisabled,
    isImageSearchExpired,
    searchByImage,
    type ImageSearchError,
    type ImageSearchQuery
} from "@/api/search/imageSearch";
import { useConfigStore } from "@/store/config";
import { useImageSearchStore } from "@/store/imageSearch";
import { useUserStore } from "@/store/user";
import type { attrsListData, Brand, filterSeleted } from "@/types/search/search";
import { getCaptureLayout, getHeaderInsets } from "@/utils/imageSearchLayout";
import { getSearchShopId, leaveImageSearch, takePendingSearchImage, type PickedSearchImage } from "@/utils/imageSearchPick";
import { t } from "@/utils/i18n";

import FilterBar, { type FilterBarRef } from "./imageSearch/components/FilterBar";
import ProductResult from "./imageSearch/components/ProductResult";
import SortBar from "./imageSearch/components/SortBar";
import TextSearchLayer, { type TextSearchLayerRef } from "./imageSearch/components/TextSearchLayer";
import { useOverlayBack } from "./imageSearch/composables/useOverlayBack";
import { useProductSearch } from "./imageSearch/composables/useProductSearch";
import { clearRestoredSearch, loadRestoredSearch, rememberSearch } from "./imageSearch/utils/pageRestore";
import { emptyFilter, getLocationParams, toFilterQuery, type ImageFilterState, type SortValue } from "./imageSearch/utils/searchRequest";

import "./image.scss";

/**
 * 以图搜图的等待与结果页（自旧 pages/search/image.vue 逐行移植）
 * - 上传图片取得图搜会话，商品列表、排序、筛选都在本次相似商品内进行，不重复传图
 * - 页内全屏文字搜索层在本次图搜会话内按关键词再搜，结果展示在该层内，与图片结果互不影响
 */

interface ConfirmedQuery {
    image: PickedSearchImage;
    searchToken: string;
}

type Phase = "restoring" | "scanning" | "failed" | "done";

/** rpx → px（对应旧 uni.upx2px） */
const upx2px = (rpx: number) => (Taro.getSystemInfoSync().windowWidth / 750) * rpx;

/** H5 是否滚到了页面底部或回弹区 */
const isAtBottom = (scrollTop: number) => {
    if (process.env.TARO_ENV !== "h5") return false;
    return scrollTop + window.innerHeight >= document.documentElement.scrollHeight - 1;
};

export default function ImageSearchResult() {
    const layout = getCaptureLayout();
    // 搜索行高 88rpx、上内边距 16rpx，中心在 60rpx；文字输入层的输入行尺寸相同，共用这组避让
    const headerInsets = getHeaderInsets(upx2px(60));
    const barStyle = headerInsets.right ? { paddingRight: `${headerInsets.right}px` } : {};
    // 取消按钮固定在屏幕下部，白色半透明底色，压在黑边上呈深灰、压在图片上透出底图
    const cancelBottom = layout.safeBottom + 64;
    // 从按钮上方约 100px 开始渐暗
    const shadeHeight = cancelBottom + 140;

    // 交接的图片在建页时同步取走，决定首屏：有图直接进扫描；没有是 H5 刷新，恢复期间用浅色底，不闪黑色扫描层
    const pendingImageRef = useRef<PickedSearchImage | null | undefined>(undefined);
    if (pendingImageRef.current === undefined) pendingImageRef.current = takePendingSearchImage();
    const pendingImage = pendingImageRef.current;

    const [phase, setPhaseState] = useState<Phase>(pendingImage ? "scanning" : "restoring");
    // 有过一次成功的查询后结果区一直保留
    const [hasResult, setHasResult] = useState(false);
    const [query, setQuery] = useState<PickedSearchImage>({ path: "", source: "camera" });
    const imagePath = query.path;

    // 最近一次成功的查询：重新检索期间保留，取消时恢复
    const confirmedRef = useRef<ConfirmedQuery | null>(null);
    // 进行中的上传；序号用来丢弃被取消或被新图取代的响应
    const uploadRef = useRef<{ abort: () => void } | null>(null);
    const uploadSeqRef = useRef(0);
    // 进行中的上传成功后是否保留排序和筛选：同一张图重新检索时保留，初次搜索时重置
    const keepConditionsRef = useRef(false);
    // 从店铺内搜索栏进入时限定的店铺，重新检索时仍在同一家店内搜索
    const shopIdRef = useRef<number | undefined>(undefined);

    // 镜像 state，供事件闭包与一次性挂载逻辑读取最新值（对应旧 ref 语义）
    const phaseRef = useRef<Phase>(phase);
    const setPhase = (value: Phase) => {
        phaseRef.current = value;
        setPhaseState(value);
    };

    const [filters, setFiltersState] = useState<ImageFilterState>(emptyFilter());
    const filtersRef = useRef<ImageFilterState>(filters);
    const setFilters = (value: ImageFilterState) => {
        filtersRef.current = value;
        setFiltersState(value);
    };

    const [facets, setFacets] = useState<{ category: filterSeleted[]; brand: Brand[]; attrs: attrsListData[] }>({
        category: [],
        brand: [],
        attrs: []
    });
    const facetsRef = useRef(facets);
    facetsRef.current = facets;
    const facetSeqRef = useRef(0);

    const configStoreEnableAttributeFilter = useConfigStore((s) => s.enableAttributeFilter);
    const enableAttributeFilterRef = useRef(configStoreEnableAttributeFilter);
    enableAttributeFilterRef.current = configStoreEnableAttributeFilter;

    const fetchCapabilities = useImageSearchStore((s) => s.fetchCapabilities);
    const isImageSearchAvailable = useImageSearchStore((s) => s.isAvailable);
    const markUnavailable = useImageSearchStore((s) => s.markUnavailable);

    // 正在处理的业务动作统一走 ref，避免一次性挂载逻辑拿到陈旧闭包
    const leaveDisabledRef = useRef<() => void>();

    const conditions = useCallback(
        (): ImageSearchQuery => ({
            searchToken: confirmedRef.current?.searchToken || "",
            ...toFilterQuery(filtersRef.current)
        }),
        []
    );

    const {
        data: productList,
        promotionList,
        isLoading,
        isLoadMore,
        error,
        params,
        sortState,
        search,
        changeSort,
        resetSort,
        retry,
        reachBottom,
        stop
    } = useProductSearch(
        (data: ImageSearchQuery) =>
            getImageSearchProduct(data).catch((err: ImageSearchError) => {
                // 图搜会话无效或已过期按没有商品处理，不提示失效也不重新检索
                if (isImageSearchExpired(err)) return { records: [], total: 0 };
                if (isImageSearchDisabled(err)) {
                    leaveDisabledRef.current?.();
                    return { records: [], total: 0 };
                }
                throw err;
            }),
        conditions
    );

    /** 筛选项与列表用同一组条件；失败不打断列表，保留上一次的可选项 */
    const loadFacets = async () => {
        const id = ++facetSeqRef.current;
        const data = { ...getLocationParams(), ...conditions() };
        const [filterRes, attrRes] = await Promise.allSettled([
            getImageSearchFilter(data),
            // 后台未开启属性筛选时不请求属性建议，与商品搜索页一致
            enableAttributeFilterRef.current ? getImageSearchAttributes(data) : Promise.resolve({ attributes: [] as attrsListData[] })
        ]);
        if (id !== facetSeqRef.current) return;
        if ([filterRes, attrRes].some((res) => res.status === "rejected" && isImageSearchDisabled((res as PromiseRejectedResult).reason))) {
            leaveDisabledRef.current?.();
            return;
        }
        let category: filterSeleted[] = [];
        let brand: Brand[] = [];
        let attrs: attrsListData[] = [];
        // 图搜会话无效或已过期按没有筛选项处理
        if (filterRes.status === "rejected" && isImageSearchExpired(filterRes.reason)) {
            category = [];
            brand = [];
        }
        if (attrRes.status === "rejected" && isImageSearchExpired(attrRes.reason)) attrs = [];
        if (filterRes.status === "fulfilled") {
            const filter = (filterRes.value as any)?.filter ?? {};
            const list = Array.isArray(filter.category) ? filter.category : [];
            // 已选分类后后端只返回它的子分类，叶子分类返回空；此时保留原列表，面板不至于整块消失
            category = list.length || !filtersRef.current.cat ? list : facetsRef.current.category;
            brand = Array.isArray(filter.brand) ? filter.brand : [];
        }
        if (attrRes.status === "fulfilled") {
            attrs = Array.isArray((attrRes.value as any)?.attributes) ? (attrRes.value as any).attributes : [];
        }
        setFacets({ category, brand, attrs });
    };

    const [searchOpen, setSearchOpen] = useState(false);
    const searchOpenRef = useRef(searchOpen);
    searchOpenRef.current = searchOpen;

    // 打开文字搜索层时的图搜会话，层内按关键词在这批相似商品里再搜
    const [searchLayerToken, setSearchLayerToken] = useState("");
    const searchLayerRef = useRef<TextSearchLayerRef>(null);
    const filterBarRef = useRef<FilterBarRef>(null);

    // 搜索行 128rpx 加排序行 88rpx，与样式里 .result__bar、.sort-bar 的高度一致；收起时整体上移这么多，只留筛选标签
    // 排序行底部留 20rpx 的空白不移出，作为筛选标签的上边距；scrollTop 是 px，这里换算一下
    const COLLAPSE_OFFSET = upx2px(196);
    // 同方向累计滚动超过这个距离才收起或恢复，少量抖动不触发
    const COLLAPSE_THRESHOLD = 24;

    // 上滑收起搜索行和排序行，只留筛选标签；下滑恢复，不必回到列表顶部
    const [collapsed, setCollapsed] = useState(false);
    const lastScrollTopRef = useRef(0);
    const scrollAccRef = useRef(0);

    const [filterOpen, setFilterOpen] = useState(false);
    const filterOpenRef = useRef(filterOpen);
    filterOpenRef.current = filterOpen;

    const scrollToTop = () => {
        setCollapsed(false);
        Taro.pageScrollTo({ scrollTop: 0, duration: 0 });
    };

    usePageScroll(({ scrollTop }) => {
        const delta = scrollTop - lastScrollTopRef.current;
        lastScrollTopRef.current = scrollTop;
        // 回到顶部或顶部回弹时始终展开
        if (scrollTop <= 0) {
            setCollapsed(false);
            scrollAccRef.current = 0;
            return;
        }
        // 扫描层、搜索层、筛选面板打开期间以及触底时不联动
        if (phaseRef.current !== "done" || searchOpenRef.current || filterBarRef.current?.isOpen() || isAtBottom(scrollTop)) {
            scrollAccRef.current = 0;
            return;
        }
        // 方向改变时重新累计
        if (delta > 0 !== scrollAccRef.current > 0) scrollAccRef.current = 0;
        scrollAccRef.current += delta;
        if (scrollAccRef.current >= COLLAPSE_THRESHOLD && scrollTop > COLLAPSE_OFFSET) setCollapsed(true);
        else if (scrollAccRef.current <= -COLLAPSE_THRESHOLD) setCollapsed(false);
    });

    const openSearch = () => {
        filterBarRef.current?.close();
        setSearchLayerToken(confirmedRef.current?.searchToken || "");
        setSearchOpen(true);
    };

    // 切换排序后列表回到顶部，商品区显示加载中，不重新进入扫描等待
    const onChangeSort = (value: SortValue) => {
        filterBarRef.current?.close();
        if (changeSort(value)) scrollToTop();
    };

    // 筛选只在本次相似商品内生效：沿用同一会话回到第一页，并刷新其余筛选项的可选值
    const onChangeFilter = (value: ImageFilterState) => {
        setFilters(value);
        search();
        void loadFacets();
        scrollToTop();
    };

    const cancelUpload = () => {
        uploadSeqRef.current++;
        uploadRef.current?.abort();
        uploadRef.current = null;
    };

    const failText = (err: ImageSearchError) => err.message || t("图片搜索失败，请重试");

    /**
     * 用已有的图搜会话展示结果
     * @param keep 是否保留当前的排序和筛选
     */
    const showResult = (picked: PickedSearchImage, searchToken: string, keep: boolean) => {
        confirmedRef.current = { image: picked, searchToken };
        rememberSearch(picked, searchToken);
        setQuery(picked);
        setPhase("done");
        setHasResult(true);
        if (!keep) {
            // 初次搜索的结果从默认排序、无筛选开始
            resetSort();
            setFilters(emptyFilter());
            setFacets({ category: [], brand: [], attrs: [] });
        }
        search();
        void loadFacets();
        scrollToTop();
    };

    /**
     * 上传图片检索
     * @param keep 是否保留当前的排序和筛选，同一张图重新检索时使用
     */
    const startSearch = (picked: PickedSearchImage, keep = false) => {
        cancelUpload();
        const id = uploadSeqRef.current;
        setQuery(picked);
        keepConditionsRef.current = keep;
        setPhase("scanning");

        const task = searchByImage(picked.path, shopIdRef.current);
        uploadRef.current = task;
        rememberSearch(picked, "");
        task.promise.then(
            (session) => {
                if (id !== uploadSeqRef.current) return;
                uploadRef.current = null;
                showResult(picked, session.searchToken, keep);
            },
            (err: ImageSearchError) => {
                if (id !== uploadSeqRef.current) return;
                uploadRef.current = null;
                if (isImageSearchDisabled(err)) {
                    leaveDisabledRef.current?.();
                    return;
                }
                setPhase("failed");
                Taro.showToast({ title: failText(err), icon: "none" });
            }
        );
    };

    // 上传失败后重试，沿用这次上传原本的条件处理方式
    const retryUpload = () => startSearch(query, keepConditionsRef.current);

    // 会话归属变化后，用本地保留的同一张图重新上传，排序和筛选保持不变
    const searchAgain = () => {
        if (confirmedRef.current) startSearch(confirmedRef.current.image, true);
    };

    // 用同一张图重新检索中：扫描层盖在已有结果上，返回等同取消，回到上一次的结果
    const rescanning = hasResult && phase !== "done";
    const rescanningRef = useRef(rescanning);
    rescanningRef.current = rescanning;

    // 登录、退出、切换账号后旧会话不再属于当前身份，重新搜索
    const searchForNewUser = () => {
        if (phaseRef.current === "scanning") startSearch(query);
        else if (phaseRef.current === "done") searchAgain();
    };

    // 身份通常在登录页等其它页面变化，回到本页再检索：H5 重新检索要压一条历史记录，不能压在别的页面上
    const pageVisibleRef = useRef(true);
    const searchOnShowRef = useRef(false);

    const goBack = () => {
        cancelUpload();
        clearRestoredSearch();
        overlayBack.release();
        // H5 刷新后无可恢复内容时页面栈只有这一页，此时在页面初始化中退浏览器历史会被路由来回撤销，导致页面反复加载，改为回首页
        if (Taro.getCurrentPages().length > 1) Taro.navigateBack();
        else Taro.reLaunch({ url: "/pages/index/index" });
    };

    // 后台已关闭图搜：不提示，连同拍摄页一起退出，回到发起搜索的页面，入口随之隐藏
    const leavingRef = useRef(false);

    const leaveDisabled = () => {
        if (leavingRef.current) return;
        leavingRef.current = true;
        // 店铺内搜索只关闭店铺内入口，全站入口不受影响
        markUnavailable(shopIdRef.current !== undefined);
        cancelUpload();
        stop();
        clearRestoredSearch();
        overlayBack.release();
        leaveImageSearch();
    };
    leaveDisabledRef.current = leaveDisabled;

    // 初次搜索取消则退出；重新检索时取消则回到上一次的结果
    const cancel = () => {
        if (!confirmedRef.current) return goBack();
        cancelUpload();
        const confirmed = confirmedRef.current;
        setQuery(confirmed.image);
        rememberSearch(confirmed.image, confirmed.searchToken);
        setPhase("done");
    };

    const preview = () => {
        Taro.previewImage({ urls: [imagePath] });
    };

    // 挂载即执行旧 onLoad：先读开关，再按交接图片 / H5 恢复内容决定首屏
    useEffect(() => {
        let active = true;
        const run = async () => {
            shopIdRef.current = getSearchShopId();
            // 开关已读过时不再请求；H5 刷新后本页先读一次，已关闭时不上传
            await fetchCapabilities();
            if (!active) return;
            if (!isImageSearchAvailable(shopIdRef.current !== undefined)) return leaveDisabled();
            if (pendingImage) return startSearch(pendingImage);
            // H5 刷新后交接的图片已被取走，用刷新前保存的图片和会话恢复；会话失效时按没有商品展示
            const restored = await loadRestoredSearch();
            if (!active) return;
            if (!restored) return goBack();
            if (restored.searchToken) showResult(restored.image, restored.searchToken, false);
            else startSearch(restored.image);
        };
        void run();
        return () => {
            active = false;
        };
        // 仅首次挂载执行（对应旧 onLoad）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 搜索层或筛选面板打开时底层列表不翻页
    useReachBottom(() => {
        if (phaseRef.current === "done" && !searchOpenRef.current && !filterBarRef.current?.isOpen()) reachBottom();
    });

    // H5 的浏览器返回不触发 onBackPress，用一条历史记录承接：返回先取消重新检索、关搜索层或筛选面板
    const overlayBack = useOverlayBack(
        () => rescanningRef.current || searchOpenRef.current || filterOpenRef.current,
        () => {
            if (rescanningRef.current) cancel();
            searchLayerRef.current?.close();
            filterBarRef.current?.close();
        }
    );

    // TODO(MIGRATION)：Taro 4 没有 onBackPress 等价 API，微信小程序端系统返回暂不拦截；
    // H5 已由 useOverlayBack 承接，weapp 待接入 wx.enableAlertBeforeUnload 或原生返回键方案。

    // 扫描页是黑底，结果页是浅色底，状态栏文字颜色跟着切换
    useEffect(() => {
        // TODO(MIGRATION)：旧版 App 端 plus.navigator.setStatusBarStyle；Taro 端待 App 壳确定后接入
    }, [phase]);

    // H5 关掉本页的页面回弹：iOS 触底回弹会把吸顶的搜索和筛选区一起顶上去再落回
    // 只在本页生效，离开或进入其它页面时恢复
    const setOverscroll = (disabled: boolean) => {
        if (process.env.TARO_ENV !== "h5") return;
        const value = disabled ? "none" : "";
        document.documentElement.style.overscrollBehaviorY = value;
        document.body.style.overscrollBehaviorY = value;
    };

    useDidShow(() => {
        setOverscroll(true);
        pageVisibleRef.current = true;
        if (!searchOnShowRef.current) return;
        searchOnShowRef.current = false;
        searchForNewUser();
    });

    useDidHide(() => {
        setOverscroll(false);
        pageVisibleRef.current = false;
    });

    // 身份变化：登录、退出、切换账号后旧会话不再属于当前身份，重新搜索
    useEffect(() => {
        return useUserStore.subscribe((state, prevState) => {
            if (state.token === prevState.token) return;
            if (pageVisibleRef.current) searchForNewUser();
            else searchOnShowRef.current = true;
        });
        // 仅注册一次订阅
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // H5 文字输入层打开时锁住底层页面滚动；输入层上的 touchmove 拦截挡不住鼠标滚轮、键盘和部分浏览器的触摸滚动
    // 只隐藏滚动条不改滚动位置，关闭后列表停在原处
    const setPageScrollLocked = (locked: boolean) => {
        if (process.env.TARO_ENV !== "h5") return;
        document.documentElement.style.overflow = locked ? "hidden" : "";
    };
    useEffect(() => {
        setPageScrollLocked(searchOpen);
    }, [searchOpen]);

    // 对应旧 onUnload
    useEffect(() => {
        return () => {
            setOverscroll(false);
            setPageScrollLocked(false);
            cancelUpload();
            stop();
            facetSeqRef.current++;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout needSafeBottom={false} overflow={false}>
            <View className={`image-result${hasResult || phase === "restoring" ? " image-result--done" : ""}`}>
                {/* 用同一张图重新检索时盖在已有结果之上，取消后结果的列表和滚动位置原样还在 */}
                {(phase === "scanning" || phase === "failed") && (
                    <View
                        className="scan"
                        onTouchMove={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                    >
                        <View className="scan__frame">
                            <Image className="scan__image" src={imagePath} mode="aspectFit" />
                        </View>
                        {/* 底部渐暗，浅色图片上也能看清取消和重试按钮 */}
                        <View className="scan__shade" style={{ height: `${shadeHeight}px` }} />
                        {phase === "scanning" ? (
                            <>
                                <View className="scan__line" />
                                <View className="scan__cancel" style={{ bottom: `${cancelBottom}px` }} onClick={cancel}>
                                    <Text className="scan__cancel-text">{t("取消")}</Text>
                                </View>
                            </>
                        ) : (
                            /* 失败后停止扫描，保留本次图片；原因用 toast 提示，这里只给恢复方式 */
                            <View className="scan__failed" style={{ bottom: `${cancelBottom}px` }}>
                                <View className="scan__failed-actions">
                                    <View className="scan__cancel scan__cancel--inline" onClick={cancel}>
                                        <Text className="scan__cancel-text">{t("取消")}</Text>
                                    </View>
                                    <View className="scan__cancel scan__cancel--inline" onClick={retryUpload}>
                                        <Text className="scan__cancel-text">{t("重试")}</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {hasResult && (
                    <View className="result">
                        {/* 吸顶区域高度始终不变，收起时只把内容整体上移，列表不会跳动 */}
                        <View className="result__header">
                            <View className="result__status" style={{ height: `${headerInsets.top}px` }} />
                            <View className={`result__header-inner${collapsed ? " result__header-inner--collapsed" : ""}`}>
                                <View className="result__bar" style={barStyle}>
                                    <View className="result__thumb" onClick={preview}>
                                        {/* 完整显示整张图片不裁剪，与提交搜索的图片一致 */}
                                        <Image className="result__thumb-image" src={imagePath} mode="aspectFit" />
                                    </View>
                                    <View className="result__search" onClick={openSearch}>
                                        <Text className="result__search-text">{t("搜索商品")}</Text>
                                        <Text className="result__search-icon iconfont-h5 icon-sousuo" />
                                    </View>
                                    <View className="result__close" onClick={goBack}>
                                        <Text className="iconfont-h5 icon-chacha" />
                                    </View>
                                </View>
                                <View className="result__filter">
                                    <SortBar sort={sortState.sort} order={sortState.order} onChange={onChangeSort} />
                                    <FilterBar
                                        ref={filterBarRef}
                                        modelValue={filters}
                                        categoryList={facets.category}
                                        brandList={facets.brand}
                                        attrList={facets.attrs}
                                        onChange={onChangeFilter}
                                        onToggle={setFilterOpen}
                                    />
                                </View>
                            </View>
                        </View>
                        <View className="result__list">
                            <ProductResult
                                productList={productList}
                                promotionList={promotionList}
                                page={params.page}
                                isLoading={isLoading}
                                isLoadMore={isLoadMore}
                                error={error}
                                emptyText={t("没有找到相似的商品")}
                                onRetry={retry}
                            />
                        </View>
                    </View>
                )}

                {searchOpen && (
                    <TextSearchLayer
                        ref={searchLayerRef}
                        imagePath={imagePath}
                        searchToken={searchLayerToken}
                        topInset={headerInsets.top}
                        rightInset={headerInsets.right}
                        onClosed={() => setSearchOpen(false)}
                        onDisabled={leaveDisabled}
                    />
                )}
            </View>
        </TigLayout>
    );
}