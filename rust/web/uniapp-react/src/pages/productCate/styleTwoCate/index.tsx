import { useMemo, useRef, useState } from "react";
import { View, Text, Image, ScrollView } from "@tarojs/components";

import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import ProductItem from "@/components/masonry/ProductItem";
import Specification, { type SpecificationRef } from "@/components/product/specification";
import { getCateProduct } from "@/api/home/home";
import type { GetCateProductFilterParams } from "@/types/home/home";
import type { filterSeleted } from "@/types/productCate/productCate";
import type { CateCenterV2Data } from "@/components/modules/cate-center/cate-center-v2/types";
import { buildCateCenterV2Vars, cateCenterV2Defaults } from "@/components/modules/cate-center/cate-center-v2/config";
import { deepMerge } from "@/utils/deepMerge";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks";
import { staticResource, redirect, isOverseas } from "@/utils";
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
 * 分类样式二组件（自旧 pages/productCate/styleTwoCate.vue 移植）
 * - 顶部分类Tab+商品瀑布流
 * - 支持分类筛选和商品搜索
 * - 支持 cateCenterV2 装修配置
 */
export default function StyleTwoCate({ height: heightProp = 0, module = {} as CateCenterV2Data }: Props) {
    const configStoreCommonHeaderHeight = useConfigStore((s) => s.commonHeaderHeight);

    const [currentCateId, setCurrentCateId] = useState(0);
    const [subCurrentCateId, setSubCurrentCateId] = useState(0);
    const [menuList, setMenuList] = useState<filterSeleted[]>([]);

    const moduleConfig = useMemo<CateCenterV2Data>(() => {
        return deepMerge({ ...cateCenterV2Defaults } as any, module || {});
    }, [module]);

    const searchPlaceholder = moduleConfig.searchPlaceholder || t("搜索商品");
    const isOverseasSkin = isOverseas();

    /** 外贸皮肤 mainHeader 占位（fixed 后脱离文档流） */
    const mainHeaderSpacerStyle = isOverseasSkin ? { height: `${configStoreCommonHeaderHeight || 0}px` } : undefined;

    const cateV2TextAlign = moduleConfig.textAlign ?? cateCenterV2Defaults.textAlign ?? 1;
    const cateV2TextWeight = moduleConfig.textWeight ?? cateCenterV2Defaults.textWeight ?? 1;
    const cateV2GoodsNameRow = moduleConfig.goodsNameRow ?? cateCenterV2Defaults.goodsNameRow ?? 2;
    const cateV2ShowName = (moduleConfig.showName ?? cateCenterV2Defaults.showName ?? 1) !== 0;
    const cateV2BuyBtnStyle = moduleConfig.buyBtnStyle ?? cateCenterV2Defaults.buyBtnStyle ?? 1;

    const decorateVars = useMemo(() => buildCateCenterV2Vars(moduleConfig), [moduleConfig]);

    // 商品卡由 ProductItem 内部注入 --pi-* 变量，这里按「专用色 → 主题色 → 不下发」逐级取值
    const cateV2PriceColor = moduleConfig.priceColor || moduleConfig.themeColor || undefined;
    const cateV2BuyBtnColor = moduleConfig.buyBtnColor || moduleConfig.themeColor || undefined;
    const cateV2ProductTitleColor = moduleConfig.productTitleColor || undefined;
    const cateV2GoodsListBgColor = moduleConfig.goodsListBgColor || undefined;

    // 对应旧 reactive params：可变对象由 useList 持有并原地改写 page
    const params = useRef({
        categoryId: 0,
        page: 1,
        size: 10
    }).current;

    const { data: list, getList, isLoading, total, updateTotal } = useList<
        Awaited<ReturnType<typeof getCateProduct>>["records"][number],
        GetCateProductFilterParams
    >(getCateProduct, {
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

    /** 旧 scroll-box 的 v-bind("height") → 内联 style（注释原位置：.scroll-box { height: v-bind("height") }） */
    const scrollBoxHeight = (() => {
        // props.height 已减 --nav-height；海外用 spacer(commonHeaderHeight) 占位，需吐回 nav 再减实测头高
        if (isOverseasSkin) {
            return `calc(${heightProp} + var(--nav-height) - ${configStoreCommonHeaderHeight || 0}px)`;
        }
        return `calc(${heightProp} - 90rpx)`;
    })();

    // ===================== 旧 masonry.vue 内置的规格弹窗加购流程（随瀑布流一并移植） =====================
    const [productIdState, setProductIdState] = useState(0);
    const specificationRef = useRef<SpecificationRef>(null);
    const [currentItem, setCurrentItem] = useState<any>({});
    // 旧版直接 mutate item.isCheck 借 Vue 响应式刷新；React 用 tick 强制重渲染
    const [, setTick] = useState(0);
    const forceTick = () => setTick((x) => x + 1);

    // 是否是周期购
    const isCycleBuy = currentItem.deliveryMode === 2 && currentItem.deliveryType === 1;
    // 是否是次卡
    const isSubCard = currentItem.deliveryMode === 2 && currentItem.deliveryType === 2;

    const handleClickItem = (item: any) => {
        // 旧 masonry.handleClickItem：skuId 取自 promotionList（旧 styleTwo 未传促销列表，恒走默认分支）
        redirect({ url: `/pages/product/index?id=${item.productId}` });
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

    // 瀑布流两列拆分（旧 masonry 为实测高度均衡分列，React 版与搜索结果页一致先按奇偶分列）
    // TODO(MIGRATION)：旧 masonry.vue 的 getElementRect 实测高度均衡算法未随移植，先按奇偶分列兜底
    const evenColumn = list.filter((_: any, index: number) => index % 2 === 0);
    const oddColumn = list.filter((_: any, index: number) => index % 2 === 1);

    const renderColumn = (columnList: any[]) =>
        columnList.map((item: any) => (
            <ProductItem
                key={item.productId}
                item={item}
                promotionList={{}}
                styleMap={styleMap}
                isCycleBuy={item.deliveryMode === 2 && item.deliveryType === 1}
                isSubCard={item.deliveryMode === 2 && item.deliveryType === 2}
                textAlign={cateV2TextAlign}
                textWeight={cateV2TextWeight}
                goodsNameRow={cateV2GoodsNameRow}
                showName={cateV2ShowName}
                buyBtnStyle={cateV2BuyBtnStyle}
                productTitleColor={cateV2ProductTitleColor}
                priceColor={cateV2PriceColor}
                themeColor={cateV2BuyBtnColor}
                itemBackgroundColor={cateV2GoodsListBgColor}
                onClickItem={handleClickItem}
                onClickBuy={handleBuy}
            />
        ));

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
                            onChange={handleChange}
                        />
                        <View className="list-content">
                            {!isLoading && total > 0 && (
                                <ScrollView scrollY className="list-scroll" onScrollToLower={reachBottom}>
                                    {/* TODO(MIGRATION)：旧 <masonry> 实测高度均衡瀑布流 → 奇偶两列（与搜索结果页口径一致） */}
                                    <View className="masonry">
                                        <View className="masonry-item-column">{renderColumn(evenColumn)}</View>
                                        <View className="masonry-item-column">{renderColumn(oddColumn)}</View>
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

            {/* 旧 masonry 内置 <specification>：加购走规格弹窗流程 */}
            <Specification
                ref={specificationRef}
                productId={productIdState}
                isCycleBuy={isCycleBuy}
                isSubCard={isSubCard}
                onLoadEnd={loadEnd}
                onClose={handleClose}
            />
        </View>
    );
}
