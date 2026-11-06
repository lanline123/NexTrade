import { useMemo, useRef, useState } from "react";
import { View, Text, Image, ScrollView } from "@tarojs/components";

import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import TigLazyImage from "@/components/tig/tig-lazy-image/TigLazyImage";
import Specification, { type SpecificationRef } from "@/components/product/specification";
import FormatPrice from "@/components/format-price/FormatPrice";
import { getCateProduct } from "@/api/home/home";
import type { GetCateProductFilterParams, GetProductFilterResult } from "@/types/home/home";
import type { filterSeleted } from "@/types/productCate/productCate";
import type { CateCenterV2Data } from "@/components/modules/cate-center/cate-center-v2/types";
import { buildCateCenterV2Vars, cateCenterV2Defaults } from "@/components/modules/cate-center/cate-center-v2/config";
import { deepMerge } from "@/utils/deepMerge";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks";
import { staticResource, redirect, isOverseas } from "@/utils";
import { productImage } from "@/utils/format";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";
import { useConfigStore } from "@/store/config";
import TopHeader from "../src/TopHeader";
import SearchBox from "../src/Search";
import MenuBox from "../src/Menu";
import SelectCate from "../src/SelectCate";

import "./index.scss";

interface Props {
    height?: number | string;
    /** 装修配置 */
    module?: CateCenterV2Data;
}

/**
 * 分类样式三组件（自旧 pages/productCate/styleThreeCate.vue 移植）
 * - 顶部分类Tab+商品列表
 * - 支持SKU弹窗快速加购
 */
export default function StyleThreeCate({ height: heightProp = 0, module = {} as CateCenterV2Data }: Props) {
    const configStoreCommonHeaderHeight = useConfigStore((s) => s.commonHeaderHeight);

    const [currentCateId, setCurrentCateId] = useState(0);
    const [subCurrentCateId, setSubCurrentCateId] = useState(0);
    const [menuList, setMenuList] = useState<filterSeleted[]>([]);

    const moduleConfig = useMemo<CateCenterV2Data>(() => {
        return deepMerge({ ...cateCenterV2Defaults } as any, module || {});
    }, [module]);

    const decorateVars = useMemo(() => buildCateCenterV2Vars(moduleConfig), [moduleConfig]);

    const searchPlaceholder = moduleConfig.searchPlaceholder || t("搜索商品");
    const isOverseasSkin = isOverseas();

    /** 外贸皮肤 mainHeader 占位（fixed 后脱离文档流） */
    const mainHeaderSpacerStyle = isOverseasSkin ? { height: `${configStoreCommonHeaderHeight || 0}px` } : undefined;

    const showProductName = (moduleConfig.showName ?? cateCenterV2Defaults.showName ?? 1) !== 0;
    const buyBtnStyleVal = moduleConfig.buyBtnStyle ?? cateCenterV2Defaults.buyBtnStyle ?? 1;
    const showBuyBtn = buyBtnStyleVal !== 0;

    const productListClasses = (() => {
        const cls: string[] = [];
        if (moduleConfig.textAlign === 2) cls.push("product-list--align-2");
        if (moduleConfig.textWeight === 1) cls.push("product-list--weight-1");
        return cls;
    })();

    const nameRowClass = (() => {
        const row = moduleConfig.goodsNameRow ?? cateCenterV2Defaults.goodsNameRow ?? 2;
        return row === 1 ? "item-right-title--row-1" : "";
    })();

    const buyBtnClasses = (() => {
        if (buyBtnStyleVal >= 1 && buyBtnStyleVal <= 8) {
            return [`buy_btn--style${buyBtnStyleVal}`];
        }
        return [];
    })();

    // 对应旧 reactive params：可变对象由 useList 持有并原地改写 page
    const params = useRef({
        categoryId: 0,
        page: 1,
        size: 10
    }).current;

    const { data: list, getList, isLoading, total, updateTotal } = useList<GetProductFilterResult, GetCateProductFilterParams>(getCateProduct, {
        params,
        path: {
            dataKey: "records"
        },
        needReachBottom: false
    });

    const { styleMap } = useProductStyle(list);

    // 对应旧 useList 内部 reachBottom（needReachBottom:false 时未注册页面级触底，由内层 scroll-view 触发）
    const reachBottom = () => {
        if (!isLoading && params.page < Math.ceil(total / params.size)) {
            params.page++;
            void getList();
        }
    };

    const handleChange = () => {
        // 对应旧 list.value = []：useList 在 page=1 请求时会清空 data，此处仅回卷分页
        params.page = 1;
        if (subCurrentCateId === 0) {
            params.categoryId = currentCateId;
        } else {
            params.categoryId = subCurrentCateId;
        }
        void getList();
    };

    // 对应旧 defineExpose({ refreshProductList: handleChange })：旧父级（index.vue）未消费该暴露，React 版不再对外抛出

    const reset = () => {
        setSubCurrentCateId(0);
        // 对应旧 list.value = []：清空列表与 total，等待 selectCate 拉到菜单后触发 handleChange 重新加载
        updateTotal(0);
        setMenuList([]);
        params.page = 1;
    };

    const handleMenu = () => {
        redirect({
            url: "/pages/index/index"
        });
    };

    const handleSearch = () => {
        redirect({
            url: "/pages/search/index"
        });
    };

    const handleToDetail = (id: number) => {
        redirect({
            url: `/pages/product/index?id=${id}`
        });
    };

    // ===================== SKU 弹窗快速加购 =====================
    const [productIdState, setProductIdState] = useState(0);
    const specificationRef = useRef<SpecificationRef>(null);
    const [currentItem, setCurrentItem] = useState<any>({});
    // 旧版直接 mutate item.isCheck 借 Vue 响应式刷新；React 用 tick 强制重渲染
    const [, setTick] = useState(0);
    const forceTick = () => setTick((x) => x + 1);

    // 是否是周期购
    // TODO(MIGRATION)：旧版经 @send-value 的 val.cycleInfo 判定周期购；React 版规格弹层的
    // onSendValue 载荷不含 cycleInfo，按搜索页 List.tsx 口径由当前商品配送字段推导。
    const isCycleBuy = currentItem.deliveryMode === 2 && currentItem.deliveryType === 1;

    // 接收规格组件传递的商品信息，判断是否为周期购（React 载荷无 cycleInfo，保留原逻辑位）
    const handleSpecValue = (_val: any) => {
        // TODO(MIGRATION)：见上方 isCycleBuy 注释
    };

    const handleBuy = (item: any) => {
        if (item.isCheck) return;
        item.isCheck = true;
        setCurrentItem(item);
        setProductIdState(item.productId);
        forceTick();
    };

    const loadEnd = () => {
        specificationRef.current?.handleShowPopup();
        currentItem.isCheck = false;
        forceTick();
    };

    const handleClose = () => {
        setProductIdState(0);
    };

    /** 旧 scroll-box 的 v-bind("height") → 内联 style（注释原位置：.scroll-box { height: v-bind("height") }） */
    const scrollBoxHeight = (() => {
        // props.height 已减 --nav-height；海外用 spacer(commonHeaderHeight) 占位，需吐回 nav 再减实测头高
        if (isOverseasSkin) {
            return `calc(${heightProp} + var(--nav-height) - ${configStoreCommonHeaderHeight || 0}px)`;
        }
        return `calc(${heightProp} - 90rpx)`;
    })();

    return (
        <View style={decorateVars as any}>
            {/* fixed：父级 tig-layout overflow:hidden 会裁切 sticky，导致头部上顶 */}
            {isOverseasSkin && <TopHeader placeholder={searchPlaceholder} />}
            {isOverseasSkin && <View className="main-header-spacer" style={mainHeaderSpacerStyle as any} />}
            {!isOverseasSkin && <TigNavbar title={t("产品分类")} showLeft={false} />}
            {!isOverseasSkin && <SearchBox needMenu placeholder={searchPlaceholder} onMenu={handleMenu} onSearch={handleSearch} />}
            <View className="scroll-box" style={{ height: scrollBoxHeight }}>
                <View className="content-box">
                    <View className="side">
                        <MenuBox currentCateId={currentCateId} onCurrentCateIdChange={setCurrentCateId} onChange={() => reset()} />
                    </View>
                    <View className="list-box">
                        <SelectCate
                            menuList={menuList}
                            onMenuListChange={setMenuList}
                            subCurrentCateId={subCurrentCateId}
                            onSubCurrentCateIdChange={setSubCurrentCateId}
                            currentCateId={currentCateId}
                            module={moduleConfig}
                            type="main"
                            onChange={handleChange}
                        />
                        <View className="list-content">
                            {!isLoading && total > 0 && (
                                <ScrollView scrollY className="list-scroll" onScrollToLower={reachBottom}>
                                    <View className={`product-list ${productListClasses.join(" ")}`}>
                                        {list.map((item: any) => (
                                            <View key={item.productId} className="product-item">
                                                <View className="item-left" onClick={() => handleToDetail(item.productId as number)}>
                                                    <TigLazyImage src={productImage(item)} />
                                                    {(shouldShowSoldOut(item) || item.productStatus == 0) && (
                                                        <View className="product-status-box">
                                                            <View className="outsale">{t(shouldShowSoldOut(item) ? "已售罄" : "已下架")}</View>
                                                        </View>
                                                    )}
                                                    {item.productId != null && styleMap[item.productId]?.borderImage && (
                                                        <Image
                                                            className="product-style-border"
                                                            src={item.productId != null ? styleMap[item.productId]?.borderImage : ""}
                                                            mode="scaleToFill"
                                                        />
                                                    )}
                                                </View>
                                                <View className="item-right">
                                                    {showProductName && (
                                                        <View
                                                            className={`item-right-title ${nameRowClass}`}
                                                            onClick={() => handleToDetail(item.productId as number)}
                                                        >
                                                            <Text>{item.productName}</Text>
                                                        </View>
                                                    )}
                                                    <View className="item-right-meta">
                                                        <View className="item-right-price">
                                                            <FormatPrice
                                                                decimalsStyle={{
                                                                    fontSize: "24rpx",
                                                                    fontWeight: "bold"
                                                                }}
                                                                currencyStyle={{
                                                                    fontSize: "23rpx",
                                                                    fontWeight: "bold"
                                                                }}
                                                                fontStyle={{ fontSize: "32rpx" }}
                                                                priceData={item.deliveryMode === 2 ? (item as any).cyclePrice : item.productPrice}
                                                            />
                                                        </View>
                                                        {showBuyBtn && (
                                                            <View className="buy_icon">
                                                                <View className={`buy_btn ${buyBtnClasses.join(" ")}`} onClick={() => handleBuy(item)}>
                                                                    {item.isCheck ? (
                                                                        // TODO(MIGRATION)：旧 up-loading-icon（uview 圆圈 loading）随基础组件批次替换
                                                                        <Text>…</Text>
                                                                    ) : buyBtnStyleVal === 5 || buyBtnStyleVal === 6 ? (
                                                                        <Text className="buy_btn_text">{t("购买")}</Text>
                                                                    ) : buyBtnStyleVal === 7 || buyBtnStyleVal === 8 ? (
                                                                        <Text className="buy_btn_text">{t("马上抢")}</Text>
                                                                    ) : buyBtnStyleVal === 1 ? (
                                                                        <Text className="iconfont-h5 buy_btn_icon icon-gouwuche" />
                                                                    ) : buyBtnStyleVal === 2 ? (
                                                                        <Text className="iconfont-h5 buy_btn_icon icon-gouwuche1" />
                                                                    ) : buyBtnStyleVal === 3 ? (
                                                                        <Text className="iconfont-h5 buy_btn_icon icon-jia" />
                                                                    ) : buyBtnStyleVal === 4 ? (
                                                                        <Text className="iconfont-h5 buy_btn_icon icon-jia1" />
                                                                    ) : (
                                                                        <Text className="iconfont-h5 icon-gouwuche3 buy_btn_icon" />
                                                                    )}
                                                                </View>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}
                            {!isLoading && total === 0 && (
                                <View className="empty-box">
                                    {/* 旧 <up-empty>（uview）→ Image + Text 等价重写 */}
                                    <Image className="empty-img" src={staticResource("salesman/no_order.png")} mode="aspectFit" />
                                    <Text className="empty-text">{t("暂无数据")}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>

            {/* SKU 弹窗快速加购（旧 <specification ref v-model="productId" v-model:is-cycle-buy @load-end @close @send-value>） */}
            <Specification
                ref={specificationRef}
                productId={productIdState}
                isCycleBuy={isCycleBuy}
                onSendValue={handleSpecValue}
                onLoadEnd={loadEnd}
                onClose={handleClose}
            />
        </View>
    );
}
