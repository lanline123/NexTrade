import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { View } from "@tarojs/components";
import { useDidHide, useDidShow } from "@tarojs/taro";

import ProductItem from "./ProductItem";
import Specification from "@/components/product/specification";
import type { SpecificationRef } from "@/components/product/specification";
import { delay, getElementRect, redirect } from "@/utils";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";

import "./Masonry.scss";

interface Props {
    commodityList?: any[];
    promotionList?: Record<string, any>;
    styleMap?: Record<number, ProductActiveStyleVO>;
    type?: string;
    showShop?: boolean;
    shopId?: number | null;
    /** 文本对齐：1=左对齐，2=居中对齐 */
    textAlign?: number;
    /** 文字粗细：1=常规体，2=加粗体 */
    textWeight?: number;
    /** 商品名称行数：1=1行，2=2行 */
    goodsNameRow?: number;
    /** 商品标题行数（兼容字段，与 goodsNameRow 等价） */
    productTitleLine?: number;
    /** 是否显示商品名称 */
    showName?: boolean;
    /** 购买按钮样式：undefined=沿用旧图标，0=不显示，1~8=对应样式 */
    buyBtnStyle?: number;
    /** 是否显示优惠券活动；undefined 表示沿用其他页面原有行为 */
    showCoupon?: boolean;
    productTitleColor?: string;
    priceColor?: string;
    themeColor?: string;
    itemBackgroundColor?: string;
    productImageRadius?: number;
    /** 立即购买跳结算页时附加的 query（门店自提 tab 锁定配送方式），透传给规格弹窗 */
    checkQueryExtra?: string;
    /** 旧 slot name="product"：外部自定义商品卡片 */
    renderProduct?: (item: any) => ReactNode;
    /** 旧 @callback */
    onCallback?: () => void;
}

/** 列内条目：index 为在原列表中的下标，key 为高度缓存标识 */
interface ColumnEntry {
    item: any;
    index: number;
    key: string;
}

/** 未测得高度时的预估值（px），保证首屏能左右均衡分列，再由真实测量纠偏 */
const ESTIMATED_ITEM_HEIGHT = 300;
/** 两列高度差在该阈值（px）内视为基本持平，此时优先放左列，避免观感上总偏向右列 */
const COLUMN_HEIGHT_TOLERANCE = 20;

/**
 * 瀑布流容器（自旧 components/masonry/masonry.vue 移植）
 * - 按累计高度把商品放入较短列，测到真实高度后纠偏重排
 * - 旧 onShow/onHide → Taro useDidShow/useDidHide；旧 getCurrentInstance → 改用全局 querySelectorAll
 */
export default function Masonry({
    commodityList = [],
    promotionList = {},
    styleMap = {},
    type = "",
    showShop = true,
    shopId = null,
    textAlign,
    textWeight,
    goodsNameRow,
    productTitleLine,
    showName = true,
    buyBtnStyle,
    showCoupon,
    productTitleColor,
    priceColor,
    themeColor,
    itemBackgroundColor,
    productImageRadius,
    checkQueryExtra = "",
    renderProduct,
    onCallback
}: Props) {
    const [columnList, setColumnList] = useState<ColumnEntry[][]>([[], []]);
    const [productId, setProductId] = useState(0);
    const [isCycleBuy, setIsCycleBuy] = useState(false);
    const [isSubCard, setIsSubCard] = useState(false);

    const specificationRef = useRef<SpecificationRef | null>(null);
    const currentItemRef = useRef<any>({});

    const isPageVisibleRef = useRef(true);
    /** 已测得的卡片高度缓存，key 为条目唯一标识，避免重复测量 */
    const heightCacheRef = useRef<Map<string, number>>(new Map());
    /** 重测任务序号：仅让最后一次触发的异步重测生效，避免翻页/切分类时旧任务回填错乱 */
    const remeasureTokenRef = useRef(0);
    /** 列数据镜像：异步测量回调需要读取最新列结构 */
    const columnListRef = useRef<ColumnEntry[][]>([[], []]);

    const copyCommodityList = useMemo(() => {
        if (commodityList && commodityList.length > 0) {
            return JSON.parse(JSON.stringify(commodityList));
        }
        return [];
    }, [commodityList]);

    /** 条目唯一标识：兑换列表用 id，商品列表用 productId，两者都缺时退化为下标 */
    const getItemKey = (item: any, index: number): string => {
        const id = item?.id ?? "";
        const pid = item?.productId ?? "";
        return id === "" && pid === "" ? `idx-${index}` : `${id}-${pid}`;
    };

    /**
     * 按列表顺序把每项放入当前累计高度较小的列。
     * 高度优先取缓存，未测得的用预估值参与累计，保证一次性铺完首屏而不是逐条追加。
     * 同一份缓存下算法是确定的：翻页追加时前面的条目落列不变，不会整屏重排。
     */
    const buildColumns = useCallback(
        (list: any[]) => {
            const columns: ColumnEntry[][] = [[], []];
            const columnHeights = [0, 0];
            list.forEach((item: any, index: number) => {
                const key = getItemKey(item, index);
                const height = heightCacheRef.current.get(key) ?? ESTIMATED_ITEM_HEIGHT;
                // 仅当左列高出容差时才放右列；两列基本持平时优先放左列
                const target = columnHeights[0] <= columnHeights[1] + COLUMN_HEIGHT_TOLERANCE ? 0 : 1;
                columns[target].push({ item, index, key });
                columnHeights[target] += height;
            });
            columnListRef.current = columns;
            setColumnList(columns);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    /** 查询某一列所有卡片的真实高度 */
    const queryCellHeights = async (columnIndex: number): Promise<number[]> => {
        try {
            const rects = await getElementRect(`.masonry-cell-${columnIndex}`, undefined, true);
            return (rects || []).map((rect) => Number(rect?.height) || 0);
        } catch {
            return [];
        }
    };

    const isSameHeights = (a: number[], b: number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

    /**
     * 异步测量已渲染卡片的真实高度，回填缓存后重排一次。
     * 图片是懒加载的，卡片高度会随图片到位而变化，因此连续两次测得一致才视为稳定。
     */
    const remeasureAndBalance = async (list: any[]) => {
        const token = ++remeasureTokenRef.current;
        let previous: number[][] = [[], []];
        for (let i = 0; i < 30; i++) {
            await delay(i === 0 ? 80 : 150);
            // 期间发生了新的分配（翻页/切分类）或页面已隐藏，放弃本次过期任务
            if (token !== remeasureTokenRef.current || !isPageVisibleRef.current) return;
            const measured = await Promise.all([queryCellHeights(0), queryCellHeights(1)]);
            if (token !== remeasureTokenRef.current || !isPageVisibleRef.current) return;

            const stable = measured.every(
                (heights, columnIndex) => heights.length === columnListRef.current[columnIndex].length && isSameHeights(heights, previous[columnIndex])
            );
            if (stable) {
                measured.forEach((heights, columnIndex) => {
                    columnListRef.current[columnIndex].forEach((entry, cellIndex) => {
                        if (heights[cellIndex] > 0) heightCacheRef.current.set(entry.key, heights[cellIndex]);
                    });
                });
                buildColumns(list);
                return;
            }
            previous = measured;
        }
    };

    /** 先按已知高度立即铺满，再按真实高度纠偏 */
    const distribute = async (list: any[]) => {
        buildColumns(list);
        await delay(0);
        void remeasureAndBalance(list);
    };

    // 对应旧 watch(copyCommodityList, { immediate: true })
    useEffect(() => {
        if (!copyCommodityList || copyCommodityList.length === 0) {
            remeasureTokenRef.current++;
            columnListRef.current = [[], []];
            setColumnList([[], []]);
            return;
        }
        void distribute(copyCommodityList);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [copyCommodityList]);

    // 对应旧 onShow / onHide
    const isFirstShowRef = useRef(true);
    useDidShow(() => {
        isPageVisibleRef.current = true;

        // 首次 onShow 跳过
        if (isFirstShowRef.current) {
            isFirstShowRef.current = false;
            return;
        }

        if (copyCommodityList.length === 0) return;

        // 页面隐藏期间无法测高，回到前台后补测一次
        setTimeout(() => {
            if (!isPageVisibleRef.current) return;
            void remeasureAndBalance(copyCommodityList);
        }, 100);
    });

    useDidHide(() => {
        isPageVisibleRef.current = false;
        remeasureTokenRef.current++; // 中断当前测量任务
    });

    // 对应旧 onUnmounted
    useEffect(() => {
        return () => {
            remeasureTokenRef.current++;
            heightCacheRef.current.clear();
        };
    }, []);

    const handleClickItem = (item: any) => {
        let skuId;
        const promotionItem = promotionList[item.productId];
        if (promotionItem && promotionItem.activityInfo && promotionItem.activityInfo.length > 0 && promotionItem.activityInfo[0].skuIds) {
            skuId = promotionItem.activityInfo[0].skuIds[0];
        }

        let params: string;
        switch (type) {
            case "exchange":
                params = `id=${item.id}&type=exchange`;
                break;
            default:
                params = `id=${item.productId}`;
        }

        params = skuId ? `${params}&skuId=${skuId}` : params;

        if (Number(shopId) > 0) {
            params = `${params}&shopId=${shopId}`;
        }

        redirect({ url: "/pages/product/index?" + params });
    };

    const handleToShop = (id: number) => {
        redirect({ url: `/pages/shop/index?shopId=${id}` });
    };

    // 是否是周期购 / 次卡（对应旧 computed，读取当前点击项）
    const handleBuy = (item: any) => {
        if (item.isCheck) return;
        item.isCheck = true;
        currentItemRef.current = item;
        setIsCycleBuy(item.deliveryMode === 2 && item.deliveryType === 1);
        setIsSubCard(item.deliveryMode === 2 && item.deliveryType === 2);
        switch (type) {
            case "exchange":
                setProductId(item.id);
                break;
            default:
                setProductId(item.productId);
        }
    };

    const loadEnd = () => {
        specificationRef.current?.handleShowPopup();
        currentItemRef.current.isCheck = false;
    };

    const handleClose = () => {
        setProductId(0);
    };

    return (
        <View>
            <View className="masonry">
                {columnList.map((column, columnIndex) => (
                    <View className="masonry-item-column" key={columnIndex}>
                        {/* 每张卡片外包一层 masonry-cell 供测量单卡真实高度；列表可能出现重复商品，key 需带上原始下标 */}
                        {column.map((entry) => (
                            <View className={`masonry-cell masonry-cell-${columnIndex}`} key={`${entry.index}-${entry.key}`}>
                                {renderProduct ? (
                                    renderProduct(entry.item)
                                ) : (
                                    <ProductItem
                                        item={entry.item}
                                        promotionList={promotionList}
                                        styleMap={styleMap}
                                        type={type}
                                        showShop={showShop}
                                        isCycleBuy={entry.item.deliveryMode === 2 && entry.item.deliveryType === 1}
                                        isSubCard={entry.item.deliveryMode === 2 && entry.item.deliveryType === 2}
                                        textAlign={textAlign}
                                        textWeight={textWeight}
                                        goodsNameRow={goodsNameRow}
                                        productTitleLine={productTitleLine}
                                        showName={showName}
                                        buyBtnStyle={buyBtnStyle}
                                        showCoupon={showCoupon}
                                        productTitleColor={productTitleColor}
                                        priceColor={priceColor}
                                        themeColor={themeColor}
                                        itemBackgroundColor={itemBackgroundColor}
                                        productImageRadius={productImageRadius}
                                        onClickItem={handleClickItem}
                                        onClickBuy={handleBuy}
                                        onClickShop={handleToShop}
                                    />
                                )}
                            </View>
                        ))}
                    </View>
                ))}
            </View>
            <Specification
                ref={specificationRef}
                productId={productId}
                isCycleBuy={isCycleBuy}
                isSubCard={isSubCard}
                shopId={shopId}
                type={type}
                checkQueryExtra={checkQueryExtra}
                onAddCardSucceed={() => onCallback?.()}
                onLoadEnd={loadEnd}
                onClose={handleClose}
            />
        </View>
    );
}