import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import { useDidHide, useDidShow } from "@tarojs/taro";

import { designPxToRpx, formatFrame } from "@/components/modules";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getProductsList } from "@/api/common";
import { useProductStyle } from "@/hooks/useProductStyle";
import { productImage } from "@/utils/format";
import { redirect, delay, getElementRect } from "@/utils";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

export default function Product2({ module, shopId = -1 }: Props) {
    const { frame } = module;

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    const allFormat = useMemo(() => {
        return {
            backgroundColor: `background-color: ${module.backgroundColor};`,
            boxPadding: `margin-left: ${designPxToRpx(module.boxPadding)};margin-right: ${designPxToRpx(module.boxPadding)};`,
            boxPaddingBottom: `margin-bottom: ${designPxToRpx(module.boxPaddingBottom)};`,
            boxPaddingTop: `margin-top: ${designPxToRpx(module.boxPaddingTop)};`,
            boxRadius: `border-radius: ${designPxToRpx(module.boxRadius)};`,
            innerPadding: `padding: ${designPxToRpx(module.innerPadding)};`,
            goodsPadding: `padding: ${designPxToRpx(module.goodsPadding)};`
        };
    }, [module]);

    const paramsValueMap: { [key: number]: string[] } = {
        1: ["productIds"],
        2: ["productCategoryId", "productNumber"],
        3: ["productTag", "productNumber"]
    };
    const paramsKeyMap: { [key: string]: string } = {
        productIds: "ids",
        productCategoryId: "categoryId",
        productNumber: "size",
        productTag: "introType"
    };
    const [productList, setProductList] = useState<any[]>([]);
    const { styleMap } = useProductStyle(productList);
    const _getproductList = async () => {
        let param: any = {};
        if (typeof module.products === "object") {
            if (module.products.productSelectType) {
                const type = module.products.productSelectType;
                const keys = paramsValueMap[type];
                if (type == 1) {
                    param[paramsKeyMap[keys[0]]] = module.products.productIds.join(",");
                } else {
                    param.page = 1;
                    keys.forEach((key) => {
                        param[paramsKeyMap[key]] = module.products[key];
                    });
                }
            }
        }
        if (shopId && shopId != -1) {
            param.shopId = shopId;
        }
        try {
            const result = await getProductsList(param);
            setProductList(result.records);
        } catch (error) {
            console.log(error);
        }
    };
    useEffect(() => {
        void _getproductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        productList.length > 0 && (
            <View
                className={`module-ad-con module-goods_ad ad-style__${module.style} ad-buy_btn_style__${module.buyBtnStyle} ad-goods_style__${module.goodsStyle} ad-goods_radio_style__${module.goodsRadioStyle} ad-text_align__${module.textAlign} ad-text_weight__${module.textWeight} ad-goods_name_row__${module.goodsNameRow} ad-goods_name_padding__${module.goodsNamePadding} ad-goods-title_style__${module.title?.titleStyle}`}
                style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
            >
                <View
                    style={
                        frameFormat.backgroundColor +
                        " " +
                        frameFormat.boxRadius +
                        allFormat.backgroundColor +
                        allFormat.boxPadding +
                        allFormat.boxPaddingBottom +
                        allFormat.boxPaddingTop +
                        allFormat.boxRadius +
                        allFormat.innerPadding
                    }
                >
                    {productList.length > 0 && <Product2Masonry commodityList={productList} styleMap={styleMap} />}
                </View>
            </View>
        )
    );
}

/**
 * 瀑布流布局（自旧 components/masonry/masonry.vue 移植；product2 仅传 commodityList/styleMap，
 * 其余 prop 走默认值：promotionList 为空、type 为空、不传装修配色字段）。
 * 规格弹窗（specification）与促销活动条（activityCard）随 B2 商品链路批次移植；
 * 购买按钮当前降级为跳转商品详情页。
 */
interface ColumnEntry {
    item: any;
    index: number;
    key: string;
}

/** 未测得高度时的预估值（px），保证首屏能左右均衡分列，再由真实测量纠偏 */
const ESTIMATED_ITEM_HEIGHT = 300;
/** 两列高度差在该阈值（px）内视为基本持平，此时优先放左列，避免观感上总偏向右列 */
const COLUMN_HEIGHT_TOLERANCE = 20;

function Product2Masonry({ commodityList, styleMap }: { commodityList: any[]; styleMap: Record<number, any> }) {
    const rootRef = useRef<any>(null);
    /** 列内条目：index 为在原列表中的下标，key 为高度缓存标识 */
    const [columnList, setColumnList] = useState<ColumnEntry[][]>([[], []]);
    /** 供异步任务读取当前分列结果（对应旧 columnList.value 的实时读取语义） */
    const columnListRef = useRef<ColumnEntry[][]>([[], []]);
    const isPageVisibleRef = useRef(true);
    /** 已测得的卡片高度缓存，key 为条目唯一标识，避免重复测量 */
    const heightCacheRef = useRef(new Map<string, number>());
    /** 重测任务序号：仅让最后一次触发的异步重测生效，避免翻页/切分类时旧任务回填错乱 */
    const remeasureTokenRef = useRef(0);

    const cloneData = (data: any) => {
        return JSON.parse(JSON.stringify(data));
    };

    const copyCommodityList = useMemo(() => {
        if (commodityList && commodityList.length > 0) {
            return cloneData(commodityList);
        }
        return [];
    }, [commodityList]);

    // ========== 核心瀑布流算法 ==========
    /** 条目唯一标识：兑换列表用 id，商品列表用 productId，两者都缺时退化为下标 */
    const getItemKey = (item: any, index: number): string => {
        const id = item?.id ?? "";
        const productId = item?.productId ?? "";
        return id === "" && productId === "" ? `idx-${index}` : `${id}-${productId}`;
    };

    /**
     * 按列表顺序把每项放入当前累计高度较小的列。
     * 高度优先取缓存，未测得的用预估值参与累计，保证一次性铺完首屏而不是逐条追加。
     * 同一份缓存下算法是确定的：翻页追加时前面的条目落列不变，不会整屏重排。
     */
    const buildColumns = () => {
        const list = copyCommodityList;
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
    };

    /** 查询某一列所有卡片的真实高度 */
    const queryCellHeights = async (columnIndex: number): Promise<number[]> => {
        try {
            const rects: any = await getElementRect(`.masonry-cell-${columnIndex}`, rootRef.current, true);
            return (Array.isArray(rects) ? rects : []).map((rect: any) => Number(rect?.height) || 0);
        } catch {
            return [];
        }
    };

    const isSameHeights = (a: number[], b: number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

    /**
     * 异步测量已渲染卡片的真实高度，回填缓存后重排一次。
     * 图片是懒加载的，卡片高度会随图片到位而变化，因此连续两次测得一致才视为稳定。
     */
    const remeasureAndBalance = async () => {
        const token = ++remeasureTokenRef.current;
        let previous: number[][] = [[], []];
        for (let i = 0; i < 30; i++) {
            await delay(i === 0 ? 80 : 150);
            // 期间发生了新的分配（翻页/切分类）或页面已隐藏，放弃本次过期任务
            if (token !== remeasureTokenRef.current || !isPageVisibleRef.current) return;
            const measured = await Promise.all([queryCellHeights(0), queryCellHeights(1)]);
            if (token !== remeasureTokenRef.current || !isPageVisibleRef.current) return;

            const currentColumns = columnListRef.current;
            const stable = measured.every(
                (heights, columnIndex) => heights.length === currentColumns[columnIndex].length && isSameHeights(heights, previous[columnIndex])
            );
            if (stable) {
                measured.forEach((heights, columnIndex) => {
                    currentColumns[columnIndex].forEach((entry, cellIndex) => {
                        if (heights[cellIndex] > 0) heightCacheRef.current.set(entry.key, heights[cellIndex]);
                    });
                });
                buildColumns();
                return;
            }
            previous = measured;
        }
    };

    /** 先按已知高度立即铺满，再按真实高度纠偏 */
    const distribute = async () => {
        buildColumns();
        // 对应旧 nextTick：等 buildColumns 的状态落地后再测量
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        void remeasureAndBalance();
    };

    // ========== Watch 监听数据变化（旧 watch { immediate: true }） ==========
    useEffect(() => {
        if (!copyCommodityList || copyCommodityList.length === 0) {
            remeasureTokenRef.current++;
            columnListRef.current = [[], []];
            setColumnList([[], []]);
            return;
        }
        void distribute();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [copyCommodityList]);

    // ========== 生命周期钩子 ==========
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
        void delay(100).then(() => {
            if (!isPageVisibleRef.current) return;
            void remeasureAndBalance();
        });
    });

    useDidHide(() => {
        isPageVisibleRef.current = false;
        remeasureTokenRef.current++; // 中断当前测量任务
    });

    useEffect(() => {
        return () => {
            remeasureTokenRef.current++;
            heightCacheRef.current.clear();
        };
    }, []);

    const handleClickItem = (item: any) => {
        // 旧逻辑：promotionList[item.productId] 存在活动时补充 skuId（product2 未传 promotionList，恒为空）；
        // masonry 未传 shopId，此处也不追加 shopId
        const params = `id=${item.productId}`;
        redirect({ url: "/pages/product/index?" + params });
    };

    // TODO(B2)：旧 handleBuy 打开 specification 规格弹窗加购；弹窗随 B2 商品链路批次移植，先降级跳商品详情页
    const handleBuy = (item: any) => {
        handleClickItem(item);
    };

    return (
        <View ref={rootRef as any} className="masonry">
            {columnList.map((column, columnIndex) => (
                <View key={columnIndex} className="masonry-item-column">
                    {/* 每张卡片外包一层 masonry-cell 供测量单卡真实高度；列表可能出现重复商品，key 需带上原始下标 */}
                    {column.map((entry) => (
                        <View key={`${entry.index}-${entry.key}`} className={`masonry-cell masonry-cell-${columnIndex}`}>
                            <Product2MasonryItem item={entry.item} styleMap={styleMap} onClickItem={handleClickItem} onClickBuy={handleBuy} />
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
}

/**
 * 瀑布流商品卡片（自旧 components/masonry/product-item.vue 移植；
 * product2 场景下 type 为空、装修配色/对齐字段均未下发，走默认分支；
 * 拼团标签与活动卡片依赖 promotionList，product2 未传，恒不展示）。
 */
function Product2MasonryItem({
    item,
    styleMap,
    onClickItem,
    onClickBuy
}: {
    item: any;
    styleMap: Record<number, any>;
    onClickItem: (item: any) => void;
    onClickBuy: (item: any) => void;
}) {
    const currentStyle = useMemo(() => {
        const productId = item?.productId;
        return productId ? (styleMap[productId] ?? null) : null;
    }, [item, styleMap]);

    // 计算是否显示售罄状态
    const showOutsale = useMemo(() => {
        return shouldShowSoldOut(item, { isSubCard: false });
    }, [item]);

    return (
        <View className="item-li" onClick={() => onClickItem(item)}>
            <View className="photo">
                <TigImage src={productImage(item)} mode="widthFix" />
                {showOutsale && (
                    <View className="product-status-box">
                        <View className="outsale">{t("已售罄")}</View>
                    </View>
                )}
                {currentStyle?.borderImage && <Image className="product-style-border" src={currentStyle.borderImage} mode="scaleToFill" />}
            </View>
            <View className="info">
                <View className="detail presale-box">
                    {(item.saleMode && item.saleMode > 0) || item.productSaleMode ? (
                        <>
                            <Text className="presale-tag">{t("预售")}</Text>
                            <Text className="separator">|</Text>
                        </>
                    ) : null}
                    <Text>{item.productName}</Text>
                </View>

                <View className="action">
                    <View className="pricenum">
                        <FormatPrice
                            fontStyle={{ fontSize: "32rpx" }}
                            currencyStyle={{ fontSize: "22rpx" }}
                            decimalsStyle={{ fontSize: "25rpx" }}
                            priceData={item.price}
                        />
                    </View>

                    {/* 装修按钮 buyBtnStyle 1~8 与 isCheck loading 态随规格弹窗（B2）一起补齐，默认走旧图标 */}
                    <View className="buy_btn" onClick={() => onClickBuy(item)}>
                        <Text className="iconfont-h5 icon-gouwuche3 buy_btn_icon" />
                    </View>
                </View>
            </View>
        </View>
    );
}
