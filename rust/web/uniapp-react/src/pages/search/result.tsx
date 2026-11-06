import { useEffect, useReducer, useRef, useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import ProductItem from "@/components/masonry/ProductItem";
import LoadingBox from "@/components/loading-box";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import type { Brand, filterSeleted, ProductFilterParams, attrsData, attrsListData } from "@/types/search/search";
import type { StoreSearchParams, StoreSearchRecord } from "@/types/search/storeSearch";
import { getCategoryTree, getCategoryProductFilter, getCategoryProduct, getShopCategoryTree, getSearchEsFilter, getStoreProduct } from "@/api/search/search";
import { getMobileSearchStyle } from "@/api/common";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks";
import HeaderDomestic from "./components/search-result/HeaderDomestic";
import HeaderOverseas from "./components/search-result/header-overseas";
import FilterDomestic from "./components/search-result/filter-domestic";
import FilterOverseas from "./components/search-result/FilterOverseas";
import DrawerDomestic from "./components/search-result/DrawerDomestic";
import DrawerOverseas, { type DrawerOverseasRef } from "./components/search-result/DrawerOverseas";
import SortFilter, { type SortRadioOption } from "./components/sortFilter";
import BrandFilter from "./components/brandFilter";
import AttrFilter from "./components/attrFilter";
import SearchProductList from "./components/search-result/List";
import ShopInfo from "./src/shopInfo";
import StoreSearchCard from "@/components/storeSearchCard";
import { useBrandSelection, useAttrsSelection, toggleBrandId, toggleAttrValue } from "./composables";
import { useConfigStore } from "@/store/config";
import { useRegionStore } from "@/store/region";
import { useSearchDecorateStore } from "@/store/searchDecorate";
import { staticResource, isMerchant, redirect } from "@/utils";
import { setPageMeta } from "@/utils/seo";
import { decodeGroupQuery } from "@/utils/shopGroup";
import { t } from "@/utils/i18n";

import "./result.scss";

/**
 * 搜索结果页（自旧 pages/search/result.vue 移植）
 * - 展示商品搜索结果
 * - 支持分类、品牌、属性筛选
 * - 支持价格排序、销量排序
 */

type FilterParamsState = ProductFilterParams & { keyword: string; min: string | number; max: string | number; attrs: attrsData[] };

export default function SearchResult() {
    const router = useRouter();

    const configStoreEnableAttributeFilter = useConfigStore((s) => s.enableAttributeFilter);
    const configStoreCommonHeaderHeight = useConfigStore((s) => s.commonHeaderHeight);
    const configStoreShopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    // ===================== 搜索页装修配置（Decorate 页 H5 + pageType=6）=====================
    const decorateConfig = useSearchDecorateStore((s) => s.config);
    /** 后台未配置过搜索页装修时，页面保持接入装修前的原样 */
    const hasDecorate = useSearchDecorateStore((s) => s.hasDecorate);
    /** 装修接口是否已返回（成功或失败都算），用于避免头部按默认布局先画一遍 */
    const decorateLoaded = useSearchDecorateStore((s) => s.isLoaded);
    const fetchSearchDecorateConfig = useSearchDecorateStore((s) => s.fetchConfig);
    /** 后台按 px 配置，uniapp 按 rpx 渲染，换算比例固定 1:2 */
    const toRpx = (px: number | undefined, fallback: number) => `${(px ?? fallback) * 2}rpx`;

    // 请求参数与旧 reactive 同构：单个可变对象（useList 会原地改写 page），字段变化需重渲染时走 patchFilter
    const filterParams = useRef<FilterParamsState>({
        //初始化用于查询的参数
        page: 1,
        size: 10,
        sort: "",
        order: "asc",
        keyword: "",
        max: "",
        min: "",
        cat: 0,
        couponId: 0,
        brand: [],
        attrs: [],
        intro: "",
        pageType: "search"
    }).current;
    const [, setFilterVersion] = useReducer((v: number) => v + 1, 0);
    const patchFilter = (patch: Partial<FilterParamsState>) => {
        if ("keyword" in patch) {
            // 对应旧 watch(() => filterParams.keyword) → scrollKeywordToEnd
            scrollKeywordToEnd();
        }
        Object.assign(filterParams, patch);
        setFilterVersion();
    };

    const [brandList, setBrandList] = useState<Brand[]>([]);
    const [brandIdsState, setBrandIdsState] = useState<number[]>([]);
    const brandIdsRef = useRef<number[]>([]);
    /** 同步改 brandIds（state + ref 镜像），保证异步回调里读到最新值（对应旧 ref 语义） */
    const setBrandIds = (next: number[] | ((prev: number[]) => number[])) => {
        const resolved = typeof next === "function" ? next(brandIdsRef.current) : next;
        brandIdsRef.current = resolved;
        setBrandIdsState(resolved);
    };
    const [brandName, setBrandName] = useState("");
    const [categoryList, setCategoryList] = useState<filterSeleted[]>([]);
    const [shopCategoryList, setShopCategoryList] = useState<filterSeleted[]>([]);
    const [categoryTree, setCategoryTree] = useState<filterSeleted[]>([]);
    const [attrsList, setAttrsList] = useState<attrsListData[]>([]);
    const [attrsState, setAttrsState] = useState<attrsData[]>([]);
    const attrsRef = useRef<attrsData[]>([]);
    const setAttrs = (next: attrsData[]) => {
        attrsRef.current = next;
        setAttrsState(next);
    };
    const [maxPrice, setMaxPrice] = useState(0);
    const introList: { [key: string]: string } = {
        new: t("新品"),
        hot: t("热销"),
        best: t("精品")
    };

    /** 搜索框内分类路径：平台分类走 parentTree，店铺分类走店铺 parentTree */
    const treeList = (() => {
        if (filterParams.cat) {
            return categoryTree;
        }
        if (filterParams.shopCategoryId) {
            return shopCategoryList;
        }
        return [];
    })();

    const [keywordScrollLeft, setKeywordScrollLeft] = useState(0);
    const scrollKeywordToEnd = () => {
        setKeywordScrollLeft(0);
        setTimeout(() => {
            setKeywordScrollLeft(99999);
        }, 0);
    };

    const {
        getList,
        total,
        updateTotal,
        data: productList,
        promotionList,
        isLoadMore,
        isLoading
    } = useList(getCategoryProduct, {
        params: filterParams,
        path: {
            dataKey: "records"
        },
        needPromotionList: true
    });
    const { styleMap } = useProductStyle(productList);

    // 后台「移动端搜索风格」接口值；0 表示尚未取到配置
    const [configSearchStyle, setConfigSearchStyle] = useState(0);
    const configSearchStyleRef = useRef(0);
    /** 搜索风格：1 普通商品搜索，2 门店聚合搜索。配置过装修以装修为准，否则回落后台接口 */
    const getSearchStyle = () => {
        if (useSearchDecorateStore.getState().hasDecorate) {
            return Number(useSearchDecorateStore.getState().config.searchResultType) === 2 ? 2 : 1;
        }
        return configSearchStyleRef.current;
    };
    const searchStyle = hasDecorate ? (Number(decorateConfig.searchResultType) === 2 ? 2 : 1) : configSearchStyle;
    const isStoreStyle = searchStyle === 2;

    /** 布局样式：1-国内版，2-海外版；门店聚合搜索固定国内版搜索头 */
    const layoutStyle = isStoreStyle ? 1 : Number(decorateConfig.layoutStyle ?? 1);

    const storeParams = useRef<StoreSearchParams>({
        page: 1,
        size: 5
    }).current;

    const {
        getList: getStoreList,
        data: storeList,
        isLoading: storeIsLoading,
        isLoadMore: storeIsLoadMore
    } = useList<StoreSearchRecord>(getStoreProduct, {
        params: storeParams,
        path: {
            dataKey: "records"
        }
    });

    // TODO(MIGRATION)：region store 的 currentLocationInfo（定位信息）尚未随 O2O 批次移植，
    // 当前恒为空 → currentLocationParams 恒为 {}、hasLocation 恒 false，与旧版未定位时行为一致。
    const getCurrentLocationParams = () => {
        const locationInfo = (useRegionStore.getState() as any).currentLocationInfo;
        const longitude = Number(locationInfo?.longitude);
        const latitude = Number(locationInfo?.latitude);
        const isValidLocation =
            Number.isFinite(longitude) &&
            Number.isFinite(latitude) &&
            longitude >= -180 &&
            longitude <= 180 &&
            latitude >= -90 &&
            latitude <= 90 &&
            (longitude !== 0 || latitude !== 0);

        return isValidLocation ? { longitude, latitude } : {};
    };

    // 未定位时接口返回的距离不可信，不展示
    const hasLocation = "longitude" in getCurrentLocationParams() && "latitude" in getCurrentLocationParams();

    const getProductRequestParams = (extraData: Record<string, any> = {}) => ({
        brand: brandIdsRef.current.join(","),
        ...extraData,
        ...getCurrentLocationParams()
    });

    const loadStoreList = () => {
        const extraData: Record<string, any> = {
            keyword: filterParams.keyword,
            ...getCurrentLocationParams()
        };
        if (filterParams.shopId) {
            extraData.shopId = filterParams.shopId;
        }
        void getStoreList(extraData);
    };

    const loadSearchStyle = async () => {
        try {
            const result = await getMobileSearchStyle();
            const next = Number(result) === 2 ? 2 : 1;
            configSearchStyleRef.current = next;
            setConfigSearchStyle(next);
        } catch (error) {
            console.error(error);
            configSearchStyleRef.current = 1;
            setConfigSearchStyle(1);
        }
    };

    // 搜索数据加载完成后设置 SEO meta（仅 H5）
    useEffect(() => {
        if (!isLoading && process.env.TARO_ENV === "h5") {
            setPageMeta({
                title: `"${filterParams.keyword}" 的搜索结果 - ${configStoreShopTitle}`,
                description: `在${configStoreShopTitle}搜索"${filterParams.keyword}"的相关商品`,
                robots: "noindex,follow"
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading]);

    // 获取列表的查询结果
    const loadFilter = async () => {
        try {
            filterParams.brand = brandIdsRef.current.join(",");
            const productFilter = await getCategoryProductFilter({ ...filterParams });
            const listFilter = (productFilter as any).filter ?? {};
            const selected = (productFilter as any).filterSelected ?? {};

            setBrandList(Array.isArray(listFilter.brand) ? listFilter.brand : []);
            // 已选分类后，后端按「子分类」返回；叶子分类会是 []。此时保留上一份列表，避免抽屉里分类整块消失
            const nextCategory = Array.isArray(listFilter.category) ? listFilter.category : [];
            if (nextCategory.length > 0 || !filterParams.cat) {
                setCategoryList(nextCategory);
            }
            setShopCategoryList(Array.isArray(listFilter.shopCategory) ? listFilter.shopCategory : []);

            const rawMax = listFilter.maxPrice ?? listFilter.max_price;
            setMaxPrice(rawMax === undefined || rawMax === null || rawMax === "" ? 0 : Number(rawMax));
            setBrandName(selected.brand || "");
            filterParams.attrs = selected.attrs;
            setAttrs(
                Array.isArray(selected.attrs)
                    ? selected.attrs.map((item: attrsData) => ({
                          attrName: item.attrName,
                          attrValue: [...(item.attrValue || [])]
                      }))
                    : []
            );
            if (filterParams.cat) {
                const tree = await getCategoryTree(filterParams.cat);
                setCategoryTree(Array.isArray(tree) ? tree : []);
            } else {
                setCategoryTree([]);
            }
            if (filterParams.shopCategoryId) {
                const shopTree = await getShopCategoryTree(filterParams.shopCategoryId);
                setShopCategoryList(Array.isArray(shopTree) ? shopTree : []);
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const [tabIndex, setTabIndex] = useState("default");
    const [tabList, setTabList] = useState([
        {
            label: t("默认"),
            value: "default"
        },
        {
            label: t("销量"),
            value: "sale"
        },
        {
            label: t("价格"),
            value: "price",
            order: "desc"
        }
    ]);
    const onChangeTab = (item: any) => {
        let order: string;
        if (item.value == "price") {
            order = item.order === "desc" ? "asc" : "desc";
        } else {
            order = "";
        }
        setTabList((prev) => prev.map((tab) => (tab.value === item.value ? { ...tab, order } : tab)));
        setTabIndex(item.value);
        patchFilter({ sort: item.value, order });
        void loadFilter();
        resetList();
        void getList(() => getProductRequestParams());
    };

    const [couponInfo, setCouponInfo] = useState<any>({});

    const del = (type: string) => {
        switch (type) {
            case "brand":
                setBrandIds([]);
                setBrandName("");
                break;
            case "price":
                patchFilter({ min: "", max: "" });
                break;
            case "keyword":
                patchFilter({ keyword: "" });
                break;
            case "intro":
                patchFilter({ intro: "" });
                break;
            case "couponInfo":
                setCouponInfo({});
                patchFilter({ couponId: 0 });
                break;
        }
        void _getSearchFilter();
        void loadFilter();
        resetList();
        void getList(() => getProductRequestParams());
    };

    const delAttr = (index: number) => {
        const next = [...filterParams.attrs.slice(0, index), ...filterParams.attrs.slice(index + 1)];
        filterParams.attrs = next;
        setAttrs(next);
        void _getSearchFilter();
        void loadFilter();
        resetList();
        void getList(() => getProductRequestParams({ attrs: attrsRef.current }));
    };

    /** 点掉搜索框内某一级分类：index=0 清空，否则回退到上一级 */
    const delCategory = (index: number) => {
        if (index > 0) {
            if (filterParams.shopCategoryId) {
                patchFilter({ shopCategoryId: shopCategoryList[index - 1].categoryId });
            } else {
                patchFilter({ cat: categoryTree[index - 1].categoryId });
            }
        } else {
            if (filterParams.shopCategoryId) {
                patchFilter({ shopCategoryId: 0 });
            } else {
                patchFilter({ cat: 0 });
            }
        }
        void _getSearchFilter();
        void loadFilter();
        resetList();
        void getList(() => getProductRequestParams());
    };

    const [showDrawerRef, setShowDrawerRef] = useState<boolean>(false);
    const showDrawer = () => {
        setShowDrawerRef(true);
    };

    const toSearch = () => {
        // 跳转到搜索页面，传递关键词和店铺ID
        let url = "/pages/search/index";
        const params: string[] = [];
        if (filterParams.shopId) {
            params.push("shopId=" + filterParams.shopId);
        }
        if (filterParams.keyword) {
            params.push("keyWords=" + encodeURIComponent(filterParams.keyword));
        }
        if (params.length > 0) {
            url += "?" + params.join("&");
        }
        Taro.redirectTo({
            url
        });
    };

    /** 跨境头无系统返回时，搜索框左侧返回（国内/海外装修共用） */
    const handleSearchBack = () => {
        const pages = Taro.getCurrentPages();
        if (pages.length > 1) {
            Taro.navigateBack();
            return;
        }
        Taro.switchTab({
            url: "/pages/index/index"
        });
    };

    const _getSearchFilter = async () => {
        if (!configStoreEnableAttributeFilter) {
            return;
        }
        try {
            const result = await getSearchEsFilter({ keyword: filterParams.keyword, cat: filterParams.cat });
            setAttrsList(result.attributes);
        } catch (error) {
            console.error(error);
        }
    };

    const toHomePage = () => {
        Taro.switchTab({
            url: "/pages/index/index"
        });
    };

    const [navbarTitle, setNavbarTitle] = useState(t("商品搜索"));

    // 对应旧 onLoad
    useEffect(() => {
        void (async () => {
            const option: any = router.params;
            // 搜索风格由装修决定，须先拿到配置再决定拉商品还是拉门店；previewId 存在时读草稿（后台预览链路）
            await fetchSearchDecorateConfig(option?.previewId);
            if (option) {
                if (option.keyWords) {
                    patchFilter({ keyword: decodeGroupQuery(option.keyWords) });
                }
                if (option.intro) {
                    patchFilter({ intro: option.intro });
                }
                const categoryId = Number(option.cat ?? option.categoryId);
                if (Number.isFinite(categoryId) && categoryId > 0) {
                    patchFilter({ cat: categoryId });
                }
                if (option.brandId) {
                    setBrandIds((prev) => [...prev, option.brandId]);
                }
                if (option.shopId) {
                    patchFilter({ shopId: option.shopId });
                    setNavbarTitle(t("店铺商品搜索"));
                }
                if (option.shopCategoryId) {
                    patchFilter({ shopCategoryId: option.shopCategoryId });
                }
                if (option.couponInfo) {
                    const info = JSON.parse(decodeURIComponent(option.couponInfo));
                    setCouponInfo(info);
                    patchFilter({ couponId: info.couponId });
                }
            }
            if (!useSearchDecorateStore.getState().hasDecorate) {
                await loadSearchStyle();
            }
            if (getSearchStyle() === 2) {
                loadStoreList();
                return;
            }
            // H5 刷新/小程序冷启动时，全局配置可能尚未完成初始化。
            // 等待配置就绪后再判断属性筛选开关，避免默认值 0 导致属性筛选被永久跳过。
            await useConfigStore.getState().whenConfigReady();
            await _getSearchFilter();
            void loadFilter();
            void getList(() => getProductRequestParams());
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { onChangeBrand } = useBrandSelection(brandIdsState, setBrandIds);
    const { onAttrClick } = useAttrsSelection(attrsState, setAttrs);

    /** 国内版抽屉提交：回写草稿并刷新列表 */
    const handleDomesticDrawerSubmit = async (data: {
        brandIds: number[];
        attrs: attrsData[];
        cat: number | string;
        shopCategoryId: number | string;
        min: string | number;
        max: string | number;
    }) => {
        setBrandIds(data.brandIds);
        setAttrs(data.attrs);
        filterParams.attrs = data.attrs;
        patchFilter({
            cat: Number(data.cat) || 0,
            shopCategoryId: data.shopCategoryId as number | undefined,
            min: data.min,
            max: data.max
        });
        await loadFilter();
        resetList();
        void getList(() => getProductRequestParams({ attrs: attrsRef.current }));
    };

    /** 国内版抽屉重置：只清条件，等点「确定」再出结果 */
    const handleDomesticDrawerReset = () => {
        patchFilter({ min: "", max: "", cat: 0, shopCategoryId: undefined });
        setBrandIds([]);
        setAttrs([]);
        filterParams.attrs = [];
        setCategoryTree([]);
    };

    // ===================== 海外版筛选（layoutStyle=2）=====================
    const [sortPopup, setSortPopup] = useState(false);
    const [brandPopup, setBrandPopup] = useState(false);
    const [attrPopup, setAttrPopup] = useState(false);
    const [activeAttrIndex, setActiveAttrIndex] = useState(-1);
    const [showAttrRef, setShowAttrRef] = useState(false);
    const overseasDrawerRef = useRef<DrawerOverseasRef | null>(null);

    const currentAttr = attrsList[activeAttrIndex];
    const currentAttrSelectedValues = (() => {
        const name = currentAttr?.name;
        if (!name) return [];
        return attrsState.find((item) => item.attrName === name)?.attrValue ?? [];
    })();

    const closeAllPopup = () => {
        setSortPopup(false);
        setBrandPopup(false);
        setAttrPopup(false);
        setActiveAttrIndex(-1);
    };

    /** 打开海外版「所有筛选条件」底部弹层 */
    const showOverseasFilter = () => {
        closeAllPopup();
        setShowAttrRef(true);
    };

    /** 面板互斥：打开一个即关掉其它，避免多层遮罩叠加 */
    const openPopup = (target: "sort" | "brand" | "attr", attrIndex = -1) => {
        const next = {
            sort: target === "sort" ? !sortPopup : false,
            brand: target === "brand" ? !brandPopup : false,
            // 点同一属性再次收起，点另一属性直接切过去
            attr: target === "attr" ? !(attrPopup && activeAttrIndex === attrIndex) : false
        };
        setSortPopup(next.sort);
        setBrandPopup(next.brand);
        setAttrPopup(next.attr);
        setActiveAttrIndex(next.attr ? attrIndex : -1);
    };

    const handleSort = () => openPopup("sort");
    const brandClick = () => openPopup("brand");
    const attrClick = (_attr: attrsListData, index: number) => openPopup("attr", index);

    /** 海外面板改动后立即出结果，不像国内抽屉那样等「确定」 */
    const applyOverseasFilter = () => {
        filterParams.attrs = attrsRef.current;
        void loadFilter();
        resetList();
        void getList(() => {
            return { brand: brandIdsRef.current.join(","), attrs: attrsRef.current };
        });
    };

    const onOverseasBrandChange = (item: Brand) => {
        // 同步更新 ref 镜像后再触发查询，等价旧 ref 的同步语义
        setBrandIds(toggleBrandId(brandIdsRef.current, item.brandId));
        applyOverseasFilter();
    };

    const onOverseasPopupAttrClick = (name: string, value: string) => {
        setAttrs(toggleAttrValue(attrsRef.current, name, value));
        applyOverseasFilter();
    };

    const sliderMany = (e: { minPrice: number; maxPrice: number }) => {
        patchFilter({ min: e.minPrice, max: e.maxPrice, sort: "price" });
        applyOverseasFilter();
    };

    const handleOverseasReset = () => {
        patchFilter({ min: "", max: "", sort: "", order: "asc", cat: 0 });
        filterParams.attrs = [];
        setAttrs([]);
        setBrandIds([]);
        overseasDrawerRef.current?.initSlider?.();
        void _getSearchFilter();
        applyOverseasFilter();
    };

    const getSortChange = (option: SortRadioOption) => {
        patchFilter({ sort: option.sort, order: option.value });
        closeAllPopup();
        applyOverseasFilter();
    };

    const brandReset = () => {
        setBrandIds([]);
        applyOverseasFilter();
    };

    const onOverseasAttrChange = (value: string) => {
        const name = currentAttr?.name;
        if (!name) return;
        setAttrs(toggleAttrValue(attrsRef.current, name, value));
        applyOverseasFilter();
    };

    const attrReset = () => {
        const name = currentAttr?.name;
        if (!name) return;
        setAttrs(attrsRef.current.filter((item) => item.attrName !== name));
        applyOverseasFilter();
    };

    /** 「新品」pill：按 sort=time 切换，再点一次回默认排序 */
    const toggleNewProductFilter = () => {
        closeAllPopup();
        if (filterParams.sort === "time") {
            patchFilter({ sort: "", order: "asc" });
        } else {
            patchFilter({ sort: "time", order: "desc" });
        }
        applyOverseasFilter();
    };

    const resetList = () => {
        updateTotal(0);
        filterParams.page = 1;
        patchFilter({ intro: "" });
        // productList/promotionList 由 useList 在 page=1 请求时清空（旧版在此处直接清空引用）
    };

    // ===================== 装修样式计算（对应旧 computed）=====================

    // 后台「模块背景色」下发到 page；列表数据未到之前不铺色，避免搜索头下方先闪出彩条空屏
    const pageMetaStyle = (() => {
        if (!hasDecorate) return "";
        const waiting = isStoreStyle ? storeIsLoading : isLoading;
        if (waiting) return "";
        const bg = decorateConfig.backgroundColor;
        return bg ? `background-color:${bg}` : "";
    })();

    // 搜索页主容器：主题变量 + 模块背景。
    // 背景直接落到 pageMain，并撑满导航以下的剩余视口；否则 H5 的 tig-layout 白底会在短列表下方露出。
    // 搜索头占位自身有白底，因此模块背景仍从结果区开始，与 Admin 预览一致。
    const themeVars = (() => {
        if (!hasDecorate) return {} as Record<string, string>;
        const cfg = decorateConfig;
        const waiting = isStoreStyle ? storeIsLoading : isLoading;
        const style: Record<string, string> = {
            "--search-theme": cfg.themeColor || "var(--general)",
            "--search-price-color": cfg.priceColor || cfg.themeColor || "var(--general)",
            "--search-item-bg": cfg.searchItemBackgroundColor || "#ffffff",
            "--search-item-padding-lr": toRpx(cfg.searchItemPaddingLeftRight, 10),
            minHeight: layoutStyle === 2 ? `calc(100vh - ${configStoreCommonHeaderHeight || 0}px)` : "calc(100vh - var(--nav-height))"
        };
        if (!waiting && cfg.backgroundColor) {
            style.backgroundColor = cfg.backgroundColor;
        }
        return style;
    })();

    // 商品容器：外边距 / 内边距 / 圆角均来自后台
    const goodsContainerStyle = (() => {
        if (!hasDecorate) return {} as Record<string, string>;
        const cfg = decorateConfig;
        const paddingTopBottom = cfg.paddingTopBottom ?? cfg.padding ?? 10;
        const paddingLeftRight = cfg.paddingLeftRight ?? cfg.padding ?? 10;
        return {
            margin: toRpx(cfg.margin, 0),
            padding: `${toRpx(paddingTopBottom, 10)} ${toRpx(paddingLeftRight, 10)}`,
            borderRadius: toRpx(cfg.moduleRadius, 0),
            backgroundColor: cfg.backgroundColor || ""
        };
    })();

    /** 门店列表容器：外边距 / 内边距与商品列表同口径（对齐 Admin __content） */
    const storeContainerStyle = (() => {
        if (!hasDecorate) return {} as Record<string, string>;
        const cfg = decorateConfig;
        const paddingTopBottom = cfg.paddingTopBottom ?? cfg.padding ?? 10;
        const paddingLeftRight = cfg.paddingLeftRight ?? cfg.padding ?? 10;
        return {
            margin: toRpx(cfg.margin, 0),
            padding: `${toRpx(paddingTopBottom, 10)} ${toRpx(paddingLeftRight, 10)}`,
            rowGap: toRpx(cfg.storeGap, 10)
        };
    })();

    /** 列表样式：1-双列瀑布流，2-单列列表 */
    const listStyle = Number(decorateConfig.listStyle ?? 1);

    /**
     * 透传给通用瀑布流的装修字段。
     * masonry 被首页/门店/分类等 8 个页面共用，未配置装修时这里全给 undefined，
     * 组件内的 CSS fallback 保证那些页面视觉不变。
     */
    const listDecorate = (() => {
        if (!hasDecorate) return {} as Record<string, any>;
        const cfg = decorateConfig;
        return {
            productTitleLine: cfg.productTitleLine,
            buyBtnStyle: cfg.buyBtnStyle,
            showCoupon: cfg.showCoupon,
            priceColor: cfg.priceColor,
            productTitleColor: cfg.productTitleColor,
            productImageRadius: cfg.productImageRadius,
            itemBackgroundColor: cfg.itemBackgroundColor,
            themeColor: cfg.themeColor
        };
    })();

    /**
     * 透传给门店卡片的装修字段。
     * 未配置装修时全给 undefined，卡片自身的 props 默认值保证观感不变。
     * 扩展设置（商品项背景色 / 主题色 / 商品卡圆角）与商品列表共用字段。
     */
    const storeDecorate = (() => {
        if (!hasDecorate) return {} as Record<string, any>;
        const cfg = decorateConfig;
        return {
            showRating: cfg.storeShowRating,
            showMinOrder: cfg.storeShowMinOrder,
            showDeliveryFee: cfg.storeShowDeliveryFee,
            showDistance: cfg.storeShowDistance,
            showFollow: cfg.storeShowFollow,
            showProductName: cfg.storeShowProductName,
            productNameRow: cfg.storeProductNameRow,
            showProductPrice: cfg.storeShowProductPrice,
            productGap: cfg.storeProductGap,
            shopLogoRadius: cfg.storeLogoRadius,
            cardRadius: cfg.storeCardRadius,
            cardPaddingTopBottom: cfg.storePaddingTopBottom,
            cardPaddingLeftRight: cfg.storePaddingLeftRight,
            shopTitleColor: cfg.storeShopTitleColor,
            shopTitleFontSize: cfg.storeShopTitleFontSize,
            shopTitleFontBold: cfg.storeShopTitleFontBold,
            itemBackgroundColor: cfg.itemBackgroundColor,
            themeColor: cfg.themeColor,
            productImageRadius: cfg.productImageRadius
        };
    })();

    /** 海外版顶部栏占位（fixed 后脱离文档流） */
    const mainHeaderSpacerStyle = layoutStyle === 2 ? { height: `${configStoreCommonHeaderHeight || 0}px` } : undefined;

    /**
     * 搜索顶栏 fixed 偏移。
     * - 国内：CSS 默认 top: var(--nav-height)
     * - 海外版：顶在 mainHeader 下方
     */
    const topFixedStyle = layoutStyle === 2 ? { top: `${configStoreCommonHeaderHeight || 0}px` } : undefined;

    /** 海外版筛选弹层遮罩 top：按 mainHeader 高度定位 */
    const popupMaskStyle = layoutStyle === 2 ? { top: `calc(${configStoreCommonHeaderHeight || 0}px + 176rpx)` } : undefined;

    // TODO(MIGRATION)：旧 <page-meta :page-style="pageMetaStyle" /> 在 Taro React 无等价物，
    // H5 端以 body 背景色兜底；小程序端可后续接入 Taro.setBackgroundColor。
    useEffect(() => {
        if (process.env.TARO_ENV === "h5") {
            document.body.style.backgroundColor = pageMetaStyle ? pageMetaStyle.replace("background-color:", "") : "";
        }
    }, [pageMetaStyle]);

    /** 双列瀑布流（自旧 components/masonry/masonry.vue 简化）：奇偶分列 */
    const evenColumn = productList.filter((_: any, index: number) => index % 2 === 0);
    const oddColumn = productList.filter((_: any, index: number) => index % 2 === 1);

    /** 双列商品卡跳商品详情（与单列 List.toPage 同口径） */
    const toProductPage = (item: any) => {
        const promotionItem = (promotionList as any)[item.productId];
        const skuId = promotionItem?.activityInfo?.[0]?.skuIds?.[0];
        let params = `id=${item.productId}`;
        if (skuId) params += `&skuId=${skuId}`;
        if (item.shop?.shopId) params += `&shopId=${item.shop.shopId}`;
        redirect({ url: "/pages/product/index?" + params });
    };

    const renderMasonryColumn = (list: any[]) =>
        list.map((item: any) => (
            <ProductItem
                key={item.productId}
                item={item}
                promotionList={promotionList}
                styleMap={styleMap}
                productTitleLine={listDecorate.productTitleLine}
                buyBtnStyle={listDecorate.buyBtnStyle}
                showCoupon={listDecorate.showCoupon}
                priceColor={listDecorate.priceColor}
                productTitleColor={listDecorate.productTitleColor}
                productImageRadius={listDecorate.productImageRadius}
                itemBackgroundColor={listDecorate.itemBackgroundColor}
                themeColor={listDecorate.themeColor}
                onClickItem={toProductPage}
                // TODO(B2)：旧 masonry 购物车按钮走规格弹窗流程，当前简化为跳商品详情，规格弹窗随 B2-1c 批次接入
                onClickBuy={toProductPage}
            />
        ));

    return (
        <TigLayout title={layoutStyle === 2 ? "" : navbarTitle} shopId={filterParams.shopId} shopCategoryId={filterParams.shopCategoryId}>
            {/* TODO(B6)：外贸风 mainHeader（overseas 皮肤头部）随特殊批次移植，对应旧 <mainHeader class="main-header" position="fixed" /> */}
            {layoutStyle === 2 && <View className="main-header-spacer" style={mainHeaderSpacerStyle as any} />}
            <View className="pageMain productSort" style={themeVars as any}>
                {/* 装修配置到达前不渲染头部：否则会先按默认的国内版画一遍，拿到海外版配置后整块跳变 */}
                {!decorateLoaded ? (
                    <View className="decorate-placeholder" />
                ) : (
                    <>
                        {/* 国内版：搜索头 + 排序筛选整块 fixed（sticky 在 layout 内会失效） */}
                        {layoutStyle === 1 ? (
                            <>
                                <View className="search-result-domestic-fixed" style={topFixedStyle as any}>
                                    <HeaderDomestic
                                        keyword={filterParams.keyword}
                                        filterParams={filterParams as any}
                                        brandName={brandName}
                                        couponName={couponInfo?.couponName}
                                        treeList={treeList}
                                        introList={introList}
                                        showBack={false}
                                        showImageSearch={!isStoreStyle}
                                        shopId={filterParams.shopId}
                                        onToSearch={toSearch}
                                        onBack={handleSearchBack}
                                        onDelete={del}
                                        onDeleteAttr={delAttr}
                                        onDeleteCategory={delCategory}
                                    />
                                    {!isStoreStyle && (
                                        <FilterDomestic tabList={tabList} tabIndex={tabIndex} onChangeTab={onChangeTab} onShowDrawer={showDrawer} />
                                    )}
                                </View>
                                {/* 门店无筛选栏，占位更矮；白底挡住 page-meta 模块背景色，避免加载时出现黄/彩条空屏 */}
                                <View className={`search-result-domestic-spacer ${isStoreStyle ? "search-result-domestic-spacer--store" : ""}`} />
                            </>
                        ) : (
                            <>
                                <View className="search-result-overseas-fixed" style={topFixedStyle as any}>
                                    <HeaderOverseas
                                        keyword={filterParams.keyword}
                                        scrollLeft={keywordScrollLeft}
                                        shopId={filterParams.shopId}
                                        onToSearch={toSearch}
                                    />
                                    {!isStoreStyle && (
                                        <FilterOverseas
                                            selectedAttrs={attrsState}
                                            sort={filterParams.sort}
                                            brandList={brandList}
                                            brandIds={brandIdsState}
                                            attrList={attrsList}
                                            sortPopup={sortPopup}
                                            brandPopup={brandPopup}
                                            attrPopup={attrPopup}
                                            activeAttrIndex={activeAttrIndex}
                                            onShowDrawer={showOverseasFilter}
                                            onHandleSort={handleSort}
                                            onBrandClick={brandClick}
                                            onAttrClick={attrClick}
                                            onToggleNew={toggleNewProductFilter}
                                        />
                                    )}
                                </View>
                                {!isStoreStyle && <View className="search-result-overseas-spacer" />}
                            </>
                        )}

                        {/* 海外版下拉面板：排序 / 品牌 / 属性，点遮罩关闭 */}
                        {layoutStyle === 2 && (
                            <>
                                {sortPopup && (
                                    <View className="popup-mask" style={popupMaskStyle as any} onClick={closeAllPopup}>
                                        <SortFilter onSortChange={getSortChange} />
                                    </View>
                                )}
                                {brandPopup && (
                                    <View className="popup-mask" style={popupMaskStyle as any} onClick={closeAllPopup}>
                                        <BrandFilter
                                            brandIds={brandIdsState}
                                            onBrandIdsChange={setBrandIds}
                                            brandList={brandList}
                                            total={total}
                                            isLoading={isLoading}
                                            onChange={applyOverseasFilter}
                                            onBrandReset={brandReset}
                                            onClose={closeAllPopup}
                                        />
                                    </View>
                                )}
                                {attrPopup && currentAttr && (
                                    <View className="popup-mask" style={popupMaskStyle as any} onClick={closeAllPopup}>
                                        <AttrFilter
                                            attrItem={currentAttr}
                                            selectedValues={currentAttrSelectedValues}
                                            total={total}
                                            isLoading={isLoading}
                                            onChange={onOverseasAttrChange}
                                            onAttrReset={attrReset}
                                            onClose={closeAllPopup}
                                        />
                                    </View>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* 门店聚合搜索 */}
                {isStoreStyle && (
                    <>
                        <View className="store-container" style={storeContainerStyle as any}>
                            {/* 平台自营门店不计入 total，列表长度才是有关结果的依据 */}
                            {!storeIsLoading && storeList.length > 0 &&
                                storeList.map((item: StoreSearchRecord) => (
                                    <StoreSearchCard
                                        key={item.shopId}
                                        store={item}
                                        manageListGap
                                        hasLocation={hasLocation}
                                        showRating={storeDecorate.showRating}
                                        showMinOrder={storeDecorate.showMinOrder}
                                        showDeliveryFee={storeDecorate.showDeliveryFee}
                                        showDistance={storeDecorate.showDistance}
                                        showFollow={storeDecorate.showFollow}
                                        showProductName={storeDecorate.showProductName}
                                        productNameRow={storeDecorate.productNameRow}
                                        showProductPrice={storeDecorate.showProductPrice}
                                        productGap={storeDecorate.productGap}
                                        shopTitleColor={storeDecorate.shopTitleColor}
                                        shopLogoRadius={storeDecorate.shopLogoRadius}
                                        cardRadius={storeDecorate.cardRadius}
                                        cardPaddingTopBottom={storeDecorate.cardPaddingTopBottom}
                                        cardPaddingLeftRight={storeDecorate.cardPaddingLeftRight}
                                        shopTitleFontSize={storeDecorate.shopTitleFontSize}
                                        shopTitleFontBold={storeDecorate.shopTitleFontBold}
                                        itemBackgroundColor={storeDecorate.itemBackgroundColor}
                                        themeColor={storeDecorate.themeColor}
                                        productImageRadius={storeDecorate.productImageRadius}
                                        applyCardStyle
                                    />
                                ))}
                            {!storeIsLoading && storeList.length === 0 && (
                                <View className="empty-container">
                                    <Image className="empty-image" src={staticResource("empty/emptyProduct.png")} mode="aspectFit" />
                                    <Text>{t("没有找到相关的门店")}</Text>
                                    {/* TODO(MIGRATION)：旧 tig-button2 按钮以 .empty-btn 样式 View 等价重写 */}
                                    <View className="empty-btn" onClick={toHomePage}>
                                        {t("返回首页")}
                                    </View>
                                </View>
                            )}
                        </View>
                        <LoadingBox modelValue={storeIsLoadMore} page={storeParams.page ?? 1} length={storeList.length} />
                    </>
                )}

                {/* 多商户环境：搜索结果顶部展示店铺卡片（shop/shop/list），无匹配店铺时组件内部自动隐藏 */}
                {!isStoreStyle && isMerchant() && !!filterParams.keyword && <ShopInfo keyword={filterParams.keyword} shopId={filterParams.shopId as any} />}

                {/* 加载商品模块 */}
                {!isStoreStyle && (
                    <>
                        {!isLoading && total > 0 && (
                            <View className="goods-container" style={goodsContainerStyle as any}>
                                {/* 单列（listStyle=2）走搜索页专用列表组件，双列沿用通用瀑布流 */}
                                {listStyle === 2 ? (
                                    <SearchProductList productList={productList} promotionList={promotionList} config={decorateConfig} />
                                ) : (
                                    /* TODO(B2)：等高均衡分列可后补；当前按奇偶分列（自旧 masonry.vue 简化） */
                                    <View className="masonry-two-col">
                                        <View className="masonry-col">{renderMasonryColumn(evenColumn)}</View>
                                        <View className="masonry-col">{renderMasonryColumn(oddColumn)}</View>
                                    </View>
                                )}
                            </View>
                        )}
                        {!isLoading && total === 0 && (
                            <View className="empty-container">
                                <Image className="empty-image" src={staticResource("empty/emptyProduct.png")} mode="aspectFit" />
                                <Text>{t("没有找到相关的商品")}</Text>
                                {/* TODO(MIGRATION)：旧 tig-button2 按钮以 .empty-btn 样式 View 等价重写 */}
                                <View className="empty-btn" onClick={toHomePage}>
                                    {t("返回首页")}
                                </View>
                            </View>
                        )}

                        <LoadingBox modelValue={isLoadMore} page={filterParams.page} length={productList.length} />
                    </>
                )}

                {/* 国内版：右侧筛选抽屉 */}
                {layoutStyle === 1 && (
                    <DrawerDomestic
                        show={showDrawerRef}
                        onShowChange={setShowDrawerRef}
                        shopId={filterParams.shopId}
                        categoryList={categoryList}
                        shopCategoryList={shopCategoryList}
                        brandList={brandList}
                        brandIds={brandIdsState}
                        attrsList={attrsList}
                        attrs={attrsState}
                        cat={filterParams.cat}
                        shopCategoryId={filterParams.shopCategoryId}
                        min={filterParams.min}
                        max={filterParams.max}
                        onSubmit={handleDomesticDrawerSubmit}
                        onReset={handleDomesticDrawerReset}
                    />
                )}

                {/* 海外版：底部「所有筛选条件」弹层 */}
                {layoutStyle === 2 && (
                    <DrawerOverseas
                        ref={overseasDrawerRef}
                        show={showAttrRef}
                        onShowChange={setShowAttrRef}
                        brandList={brandList}
                        brandIds={brandIdsState}
                        attrsList={attrsList}
                        attrs={attrsState}
                        sort={filterParams.sort}
                        max={filterParams.max}
                        maxPrice={maxPrice}
                        total={total}
                        isLoading={isLoading}
                        onBrandChange={onOverseasBrandChange}
                        onAttrClick={onOverseasPopupAttrClick}
                        onToggleNew={toggleNewProductFilter}
                        onReset={handleOverseasReset}
                        onSliderMany={sliderMany}
                    />
                )}
            </View>
        </TigLayout>
    );
}
