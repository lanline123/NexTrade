import type { ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useReducer, useRef } from "react";
import { Image, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import type { SkuList, SkuPromotion, ProductAmountItem, GrouponDetail } from "@/types/product/product";
import type { GrouponBuyData, GrouponLaderItem, GrouponSkuItem } from "@/types/groupon/groupon";
import { getProductDetail, getProductSkuDetail, getProductAmount, getBatchProductAvailability } from "@/api/product/product";
import { getExchangeDetail } from "@/api/exchange/exchange";
import Buy from "@/components/product/buy";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigNumberBox from "@/components/tig/tig-number-box/TigNumberBox";
import FormatPrice from "@/components/format-price/FormatPrice";
import { staticResource, isB2B } from "@/utils";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import { imageFormat } from "@/utils/format";
import { isReservationProductType, isSubCardReservationProduct as checkIsSubCardReservationProduct, shouldShowSoldOut } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";
import { useRegionStore } from "@/store/region";
import { useConfigStore } from "@/store/config";

import "./index.scss";

type AnyObject = Record<string, any>;

// 拼团活动详情 sku 信息（后端字段，当前文件仅用到这些）
interface GrouponPromotionItem {
    skuId: number;
    limitNum: number;
    grouponDetailId: number;
    isJoin: number;
    groupPrice?: string;
}

interface DecorateButtonConfig {
    /** A1：1-简约、2-经典；A2：1-经典、2-简约；A3：1-胶囊/经典、2-直角/简约 */
    buyBarStyle?: 1 | 2;
    /** 按钮圆角，单位 rpx */
    buttonRadius?: number;
}

/** sendValue 事件载荷（对应旧 emit("sendValue")） */
export interface SpecificationSendValuePayload {
    marketPrice: string | number;
    productOriginPrice: string | number;
    productPrice: string | number;
    productStock: number;
    productNumber: number;
    productSkuId: number | undefined;
    skuStr: string;
    isSeckill: number;
    seckillValue: {
        seckillEndTime: string;
        seckillSales: number;
        seckillStock: number;
        canJoin: boolean;
        restrictTip: string;
    };
    promotionList: SkuPromotion[];
    isDiscount: number;
    discountValue: {
        discountEndTime: string;
        discountPrice: number;
        canJoin: boolean;
        restrictTip: string;
    };
    grouponValue: GrouponDetail;
    isGroupon: number;
    depositAmount?: number;
}

export interface SpecificationProps {
    /** 商品 ID（对应旧 v-model / modelValue） */
    productId?: number;
    /** 初始选中 SKU（对应旧 :sku-id），变更时通过 onSkuIdChange 回写（对应旧 v-model:sku-id） */
    skuId?: number;
    /** "exchange" 时走积分兑换流程 */
    type?: string;
    shopId?: number | null;
    /** 默认不传的情况是根据当前的产品是否有拼团活动来展示，如果传了 false，则走默认的流程 */
    grouponEnable?: boolean;
    /** 拼团记录信息 */
    grouponRecordInfo?: {
        grouponPromotionRecordId: number;
        minGroupNum: number;
    };
    /** 立即购买跳结算页时附加的 query（门店自提 tab 锁定配送方式），透传给 Buy 组件 */
    checkQueryExtra?: string;
    /** 商品详情装修风格：A1 / A2 / A3 */
    layoutStyle?: "A1" | "A2" | "A3";
    /** 与商品详情底部购买栏共用的按钮装修配置 */
    decorateConfig?: DecorateButtonConfig;
    /** 是否是周期购（对应旧 v-model:is-cycle-buy，组件内只读） */
    isCycleBuy?: boolean;
    /** 是否是次卡（对应旧 v-model:is-sub-card，组件内只读） */
    isSubCard?: boolean;
    children?: ReactNode;
    onSendValue?: (payload: SpecificationSendValuePayload) => void;
    onAddCardSucceed?: (success: boolean) => void;
    onSkuIdChange?: (skuId: number) => void;
    onLoadEnd?: () => void;
    onClose?: () => void;
}

export interface SpecificationRef {
    /** 打开规格弹层（对应旧 defineExpose handleShowPopup） */
    handleShowPopup: () => void;
    /** 重置并重新拉取商品规格（对应旧 defineExpose refresh） */
    refresh: () => void;
}

interface FilterParams {
    id: number;
    skuId?: number | null;
    extraAttrIds?: string;
    shopId?: number;
}

/**
 * 商品 SKU 规格选择弹层（自旧 components/product/specification.vue 移植）。
 * 说明：旧组件为 Vue ref + computed（部分 computed 带副作用），
 * 这里用单个可变 state ref + 手动 rerender 逐行保留原状态机；
 * 派生值改为渲染期函数求值，副作用 computed（拼团阶梯）按旧模板读取条件触发。
 */
const Specification = forwardRef<SpecificationRef, SpecificationProps>(function Specification(
    {
        productId = 0,
        skuId = 0,
        type = "",
        shopId = null,
        grouponEnable = true,
        grouponRecordInfo = { grouponPromotionRecordId: 0, minGroupNum: 0 },
        checkQueryExtra = "",
        layoutStyle = "A2",
        decorateConfig = {},
        isCycleBuy = false,
        isSubCard = false,
        children,
        onSendValue,
        onAddCardSucceed,
        onSkuIdChange,
        onLoadEnd,
        onClose
    },
    ref
) {
    const [, rerender] = useReducer((c: number) => c + 1, 0);
    const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bulkPurchase = useConfigStore((st) => st.bulkPurchase);
    const showMarketprice = useConfigStore((st) => st.showMarketprice);
    // 旧 watch（非 immediate）不在首次挂载时触发，这里跳过 effect 的首次执行
    const skipGrouponEnableWatchRef = useRef(false);
    const skipRecordIdWatchRef = useRef(false);

    // 全部可变状态（对应旧 <script setup> 中的 ref/reactive）
    const s = useRef({
        tabIndex: 0,
        showPopup: false,
        specificationList: [] as any[],
        skuList: [] as SkuList[],
        b2bSkuList: [] as SkuList[],
        currentSku: {} as SkuList,
        productPrice: "0" as string,
        productOriginPrice: "0" as string,
        productImage: "",
        picUrl: "", // 商品图片
        productStock: 0,
        productName: "",
        productNumber: 1,
        maxProductNumber: 0,
        checkedValue: [] as any[],
        /** 各规格组当前选中的 attributesId，用于同名规格值区分 */
        checkedAttrIds: [] as (number | null)[],
        exchangeDetail: {} as AnyObject,
        productType: 1,
        productIsBuy: 0,
        additionAttribute: [] as any[],
        checkedAttrs: [] as any[],
        productShopId: 0,
        isGroupon: 0,
        currentGroupNumKey: 0,
        isPresale: 0 as number,
        // 预售信息（saleMode>0 时存在；定金预售 depositAmount 会随 SKU 联动）
        presaleInfo: {} as AnyObject,
        // 商品限购
        limitNumber: 0,
        // 周期购/次卡当前选中的营销规格 ID
        selectedCycleSpecId: 0 as number,
        loadedBatchSkuIds: "",
        batchAvailabilityLoading: false,
        firstLoad: false,
        filterParams: { id: 0 } as FilterParams,
        skuStr: "",
        isSeckill: 0,
        promotionList: [] as SkuPromotion[],
        isDiscount: 0,
        seckillValue: {
            seckillEndTime: "",
            seckillSales: 0,
            seckillStock: 0,
            // 二期会员标签（D1096）：false 时秒杀正常展示但置灰购买并提示
            canJoin: true,
            restrictTip: ""
        },
        discountValue: {
            discountEndTime: "",
            discountPrice: 0,
            // false 时不享受限时折扣，按普通价格购买
            canJoin: true,
            restrictTip: ""
        },
        // 拼团活动详细信息
        grouponInfo: {
            productId: 0, // 商品ID
            grouponPromotionId: 0, // 拼团活动 ID
            grouponPromotionItemId: 0, // 拼团活动商品 ID
            grouponDetailId: 0
        } as GrouponDetail,
        grouponBuyData: {
            grouponPromotionId: 0,
            grouponPromotionItemId: 0,
            groupNumKey: 0,
            grouponDetailId: 0,
            price: 0,
            grouponPromotionRecordId: 0
        } as GrouponBuyData,
        // 拼团阶梯信息
        grouponSkus: [] as GrouponSkuItem[],
        skuItem: [] as any[],
        productAmount: { count: 0, total: "0" } as ProductAmountItem,
        // 规格 attributesId 组合 ↔ SKU 映射缓存（对应旧 computed skuSelectionMaps）
        selectionMaps: {
            map: new Map<string, SkuList>(),
            attrIdsBySkuId: new Map<number, number[]>()
        } as { map: Map<string, SkuList>; attrIdsBySkuId: Map<number, number[]> },
        selectionMapsDirty: true
    });

    const popupClose = () => {
        onClose?.();
        sendValue();
        s.current.showPopup = false;
        rerender();
    };

    const handleShowPopup = () => {
        s.current.showPopup = true;
        rerender();
    };

    const handlePreviewImg = (image: string) => {
        if (!image) return;

        const img = imageFormat(image);

        Taro.previewImage({
            urls: [img],
            current: img
        });
    };

    const buildSkuAttrNameValue = (attrName: string, attrValue: string) => `${attrName}:${attrValue}`;

    const parseSkuAttrNameValue = (value: string) => {
        const separatorIndex = String(value || "").indexOf(":");
        if (separatorIndex < 0) {
            return undefined;
        }

        return {
            attrName: value.slice(0, separatorIndex),
            attrValue: value.slice(separatorIndex + 1)
        };
    };

    const getSkuAttrMap = (skuItem?: Partial<SkuList>) => {
        const skuAttrMap = new Map<string, string>();
        const skuData = Array.isArray(skuItem?.skuData) ? skuItem!.skuData : [];

        if (skuData.length > 0) {
            skuData.forEach((item: any) => {
                if (!item?.name) return;
                skuAttrMap.set(String(item.name), buildSkuAttrNameValue(String(item.name), String(item.value ?? "")));
            });
            return skuAttrMap;
        }

        String(skuItem?.skuValue || "")
            .split("|")
            .filter((item) => !!item)
            .forEach((item) => {
                const parsed = parseSkuAttrNameValue(item);
                if (!parsed) return;
                skuAttrMap.set(parsed.attrName, buildSkuAttrNameValue(parsed.attrName, parsed.attrValue));
            });

        return skuAttrMap;
    };

    const getOrderedSkuAttrValues = (skuItem?: Partial<SkuList>) => {
        const skuAttrMap = getSkuAttrMap(skuItem);
        return s.current.specificationList.map((item: any) => skuAttrMap.get(String(item.attrName)) || "");
    };

    const getCheckedValueBySku = (skuItem?: Partial<SkuList>) => {
        const skuAttrMap = getSkuAttrMap(skuItem);
        return s.current.specificationList.map((item: any) => skuAttrMap.get(String(item.attrName)) || "");
    };

    /**
     * 规格 attributesId 组合 ↔ SKU 映射。
     * 同名规格值导致 skuValue 重复时，按笛卡尔积顺序与 SKU 列表出现顺序一一对应。
     */
    const rebuildSkuSelectionMaps = () => {
        const buckets = new Map<string, SkuList[]>();
        s.current.skuList.forEach((skuItem: SkuList) => {
            const orderedTokens = getOrderedSkuAttrValues(skuItem);
            if (orderedTokens.length === 0 || orderedTokens.some((token) => !token)) return;
            const skuKey = orderedTokens.join("|");
            const bucket = buckets.get(skuKey);
            if (bucket) bucket.push(skuItem);
            else buckets.set(skuKey, [skuItem]);
        });

        const matchCursor = new Map<string, number>();
        const consumeFromBucket = (skuKey: string) => {
            const bucket = buckets.get(skuKey);
            if (!bucket || bucket.length === 0) return undefined;
            const pos = matchCursor.get(skuKey) ?? 0;
            matchCursor.set(skuKey, pos + 1);
            return bucket[Math.min(pos, bucket.length - 1)];
        };

        const map = new Map<string, SkuList>();
        const attrIdsBySkuId = new Map<number, number[]>();

        const walk = (groupIndex: number, selectedAttrs: any[], tokens: string[]) => {
            if (groupIndex >= s.current.specificationList.length) {
                if (tokens.length === 0) return;
                const sku = consumeFromBucket(tokens.join("|"));
                if (!sku) return;
                const attrIds = selectedAttrs.map((attr) => Number(attr.attributesId));
                map.set(attrIds.join("|"), sku);
                attrIdsBySkuId.set(Number(sku.skuId), attrIds);
                return;
            }

            const group = s.current.specificationList[groupIndex];
            const attrList = Array.isArray(group?.attrList) ? group.attrList : [];
            if (attrList.length === 0) {
                walk(groupIndex + 1, selectedAttrs, tokens);
                return;
            }

            attrList.forEach((attr: any) => {
                walk(groupIndex + 1, [...selectedAttrs, attr], [...tokens, buildSkuAttrNameValue(String(attr.attrName), String(attr.attrValue))]);
            });
        };

        if (s.current.specificationList.length > 0) {
            walk(0, [], []);
        }

        s.current.selectionMaps = { map, attrIdsBySkuId };
        s.current.selectionMapsDirty = false;
    };

    const getSkuSelectionMaps = () => {
        if (s.current.selectionMapsDirty) {
            rebuildSkuSelectionMaps();
        }
        return s.current.selectionMaps;
    };

    const findSkuByCheckedValue = (selectedValues: string[]) => {
        const validSelectedValues = selectedValues.filter((item) => !!item);
        if (validSelectedValues.length === 0) {
            return undefined;
        }

        return s.current.skuList.find((skuItem: SkuList) => {
            const skuAttrValues = Array.from(getSkuAttrMap(skuItem).values());
            if (skuAttrValues.length !== validSelectedValues.length) {
                return false;
            }

            const skuAttrSet = new Set(skuAttrValues);
            return validSelectedValues.every((item) => skuAttrSet.has(item));
        });
    };

    const findSkuByCheckedAttrIds = (selectedAttrIds: (number | null)[], selectedValues?: string[]) => {
        const validAttrIds = selectedAttrIds.filter((id): id is number => id != null && Number(id) > 0);
        if (validAttrIds.length > 0 && validAttrIds.length === s.current.specificationList.length) {
            const matched = getSkuSelectionMaps().map.get(validAttrIds.join("|"));
            if (matched) return matched;
        }

        return findSkuByCheckedValue(selectedValues || s.current.checkedValue);
    };

    const getCheckedAttrIdsBySku = (skuItem?: Partial<SkuList>) => {
        if (!skuItem?.skuId) {
            return s.current.specificationList.map(() => null);
        }

        const mappedIds = getSkuSelectionMaps().attrIdsBySkuId.get(Number(skuItem.skuId));
        if (mappedIds && mappedIds.length === s.current.specificationList.length) {
            return mappedIds;
        }

        // 回退：按名称匹配各组第一个同名规格值
        const checkedTokens = getCheckedValueBySku(skuItem);
        return s.current.specificationList.map((group: any, index: number) => {
            const token = checkedTokens[index];
            const attr = (group.attrList || []).find((item: any) => buildSkuAttrNameValue(String(item.attrName), String(item.attrValue)) === token);
            return attr?.attributesId != null ? Number(attr.attributesId) : null;
        });
    };

    /** 根据当前已选规格，同步主图（任意规格组有图则取第一张有图的） */
    const syncProductImageByChecked = () => {
        for (let i = 0; i < s.current.specificationList.length; i++) {
            const group = s.current.specificationList[i];
            if (!group?.attrList) continue;
            const attrId = s.current.checkedAttrIds[i];
            const attr =
                attrId != null
                    ? group.attrList.find((subItem: any) => Number(subItem.attributesId) === Number(attrId))
                    : group.attrList.find((subItem: any) => buildSkuAttrNameValue(String(subItem.attrName), String(subItem.attrValue)) === s.current.checkedValue[i]);
            if (attr?.attrPic) {
                s.current.productImage = attr.attrPic;
                return;
            }
        }
    };

    const applyDefaultSkuSelection = (skuItem?: SkuList) => {
        if (!skuItem) return;
        s.current.checkedValue = getCheckedValueBySku(skuItem);
        s.current.checkedAttrIds = getCheckedAttrIdsBySku(skuItem);
        syncProductImageByChecked();
    };

    // 拼团活动中可参团的 SKU id 集合（基于接口返回的 grouponPromotionDetails.isJoin）
    const getJoinableSkuIds = (): Set<number> => {
        const details = s.current.grouponInfo?.grouponPromotionDetails;
        if (!details || !details.length) return new Set<number>();
        return new Set<number>(details.filter((d: any) => d.isJoin === 1).map((d: any) => d.skuId));
    };
    // 是否存在可参团的拼团活动（仅看接口数据，与 grouponEnable 无关）
    // 用于默认选中规格：即使是从「加入购物车 / 选规格」入口打开（grouponEnable=false），
    // 仍然按拼团最低价的 SKU 作为默认值
    const hasJoinableGroupon = () => {
        return !!(s.current.grouponInfo?.grouponPromotionItemId && getJoinableSkuIds().size > 0);
    };
    // 当前是否处于"拼团模式"：拼团开关开启 + 存在可参团活动
    // 用于禁用未参团规格、拦截非法点击等
    const isGrouponActive = () => {
        return !!(grouponEnable && hasJoinableGroupon());
    };
    // 拼团活动中价格最低的阶梯所在的可参团 SKU id（用于默认选中该规格）
    const getCheapestJoinableSkuId = (): number | null => {
        const details = s.current.grouponInfo?.grouponPromotionDetails;
        if (!details || !details.length) return null;
        let best: { skuId: number; price: number } | null = null;
        for (const item of details as any[]) {
            if (item.isJoin !== 1 || !item.groupPrice) continue;
            let prices: any[] = [];
            try {
                prices = JSON.parse(item.groupPrice);
            } catch {
                continue;
            }
            for (const p of prices) {
                const price = Number(p.price);
                if (Number.isNaN(price)) continue;
                if (!best || price < best.price) {
                    best = { skuId: item.skuId, price };
                }
            }
        }
        return best?.skuId ?? null;
    };
    // 当前sku的拼团信息（旧 computed currentSkuGroupon：读取时会联动 grouponBuyData.grouponDetailId）
    const getCurrentSkuGroupon = (): GrouponSkuItem | undefined => {
        if (!s.current.isGroupon) {
            return undefined;
        }
        if (!s.current.grouponSkus) {
            return undefined;
        }
        const currentSkuId = s.current.currentSku?.skuId || 0;
        const res = s.current.grouponSkus.find((item) => item.skuId === currentSkuId);
        s.current.grouponBuyData.grouponDetailId = res?.grouponDetailId || 0;
        return res || undefined;
    };
    // 当前sku的拼团阶梯信息（旧 computed currentSkuGrouponLaders：读取时会联动库存/价格）
    const getCurrentSkuGrouponLaders = (): GrouponLaderItem[] => {
        if (!s.current.isGroupon) {
            return [];
        }
        const currentSkuGroupon = getCurrentSkuGroupon();
        if (!currentSkuGroupon) {
            return [];
        }
        // 设置当前库存
        s.current.productStock = currentSkuGroupon.limitNum || 0;
        // 拿到当前阶梯
        const currentLader = currentSkuGroupon.laders.find((x) => x.grouponNumKey === s.current.currentGroupNumKey);
        s.current.productPrice = currentLader?.price as string;
        s.current.grouponInfo.grouponPrice = currentLader?.price as string;
        // 设置当前拼团活动详情id
        s.current.grouponBuyData.grouponDetailId = currentSkuGroupon.grouponDetailId;
        // 如果传入的拼团记录id，则不显示拼团阶梯
        if (grouponRecordInfo.grouponPromotionRecordId) {
            return currentLader ? [currentLader] : [];
        } else {
            return currentSkuGroupon.laders || [];
        }
    };

    const handleAttrClick = (index: number, id: number) => {
        if (s.current.checkedAttrs[index] && s.current.checkedAttrs[index] === id) {
            s.current.checkedAttrs[index] = null;
        } else {
            s.current.checkedAttrs[index] = id;
        }
        rerender();
        loadSkuPrice();
    };

    const __getProductDetail = async () => {
        try {
            let result: any = {};

            const params: any = {
                id: productId,
                shopId: null,
                nearestShopId: null
            };
            if (shopId === 0 || shopId) {
                params.shopId = shopId;
            } else {
                params.nearestShopId = (useRegionStore.getState().nearestShopInfo as any)?.shopId || null;
            }

            switch (type) {
                case "exchange":
                    result = await getExchangeDetail(params);
                    s.current.exchangeDetail = result.exchangeInfo;
                    s.current.productStock = result.exchangeInfo.productStock;
                    s.current.productPrice = s.current.exchangeDetail.discountsPrice || "0";
                    s.current.productImage = s.current.exchangeDetail.picUrl || "";
                    break;
                default:
                    result = await getProductDetail(params);
                    s.current.productStock = result.item.productStock;
                    s.current.productPrice = result.item.productPrice || "0";
                    s.current.picUrl = result.item.picUrl || "";
                    s.current.productImage = result.item.picUrl || "";
                    s.current.grouponInfo = result.grouponDetail;
                    s.current.limitNumber = result.item.limitNumber || 0; // 商品限购
            }
            s.current.productType = result.item.productType;
            s.current.productIsBuy = result.item.isBuy;
            s.current.productName = result.item.productName || "";
            // 预售信息
            s.current.presaleInfo = {};
            if (result.item.saleMode && Number(result.item.saleMode) > 0) {
                s.current.isPresale = 1;
                s.current.presaleInfo.saleMode = Number(result.item.saleMode);
                if (result.item.presaleInfo) {
                    s.current.presaleInfo.depositAmount = Number(result.item.presaleInfo.depositAmount ?? 0);
                }
            }
            s.current.specificationList = result.attrList.spe;
            s.current.additionAttribute = result.attrList.extra;
            s.current.skuList = result.skuList;
            s.current.selectionMapsDirty = true;
            s.current.productShopId = result.shopId || 0;
            rerender();

            setDefaultValue();
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            onLoadEnd?.();
        }
        // 对应旧 watch([showBulkPurchaseTab, batchSkuIds])：skuList 变化后触发
        handleBulkPurchaseWatch();
        rerender();
    };

    const reset = () => {
        s.current.productNumber = 1;
        s.current.checkedValue = [];
        s.current.checkedAttrIds = [];
        s.current.currentSku = {} as SkuList;
        s.current.checkedAttrs = [];
        s.current.tabIndex = 0;
        s.current.isGroupon = 0;
        s.current.presaleInfo = {};
        s.current.grouponInfo = {
            productId: 0,
            grouponPromotionId: 0,
            grouponPromotionItemId: 0,
            grouponDetailId: 0
        };
        s.current.grouponBuyData = {
            grouponPromotionId: 0,
            grouponPromotionItemId: 0,
            groupNumKey: 0,
            grouponDetailId: 0,
            price: 0,
            grouponPromotionRecordId: 0
        };
        s.current.grouponSkus = [];
        s.current.b2bSkuList = [];
        s.current.loadedBatchSkuIds = "";
        s.current.batchAvailabilityLoading = false;
        s.current.selectionMapsDirty = true;
        clearMarketingState();
        // 对应旧 watch([showBulkPurchaseTab, batchSkuIds])：批量采购相关状态清空
        handleBulkPurchaseWatch();
        rerender();
    };

    // 加载拼团信息
    const loadGrouponInfo = () => {
        if (type) {
            s.current.firstLoad = false;
            onLoadEnd?.();
            return;
        }

        if (!productId) {
            return;
        }

        // 如果产品库存为0
        if (s.current.productStock === 0) {
            return;
        }

        try {
            if (s.current.firstLoad) {
                // 拼团的产品价格就是原价
                s.current.productOriginPrice = s.current.productPrice;
                // 看是否有拼团价格
                if (s.current.grouponInfo.grouponPromotionDetails) {
                    s.current.grouponBuyData.grouponPromotionId = s.current.grouponInfo.grouponPromotionId;
                    s.current.grouponBuyData.grouponPromotionItemId = s.current.grouponInfo.grouponPromotionItemId;
                    s.current.grouponSkus = s.current.grouponInfo.grouponPromotionDetails.map((skuItem: GrouponPromotionItem) => {
                        let skuGroupPrice;
                        // 拼团的阶梯信息
                        const grouponSkuItem: GrouponSkuItem = {
                            skuId: skuItem.skuId,
                            limitNum: skuItem.limitNum,
                            grouponDetailId: skuItem.grouponDetailId,
                            isJoin: skuItem.isJoin,
                            laders: []
                        };
                        // 拿到拼团价
                        if (skuItem.groupPrice) {
                            skuGroupPrice = JSON.parse(skuItem.groupPrice);
                        }
                        if (skuGroupPrice && skuGroupPrice.length) {
                            //  循环处理阶梯价格
                            grouponSkuItem.laders = skuGroupPrice.map((skuGroupPriceItem: AnyObject) => {
                                // 根据grouponNumKey找到拼团人数
                                const laderGrouponNum = s.current.grouponInfo.groupNums?.find((item: any) => item.groupNumKey === skuGroupPriceItem.groupNumKey);
                                return {
                                    grouponNumKey: skuGroupPriceItem.groupNumKey,
                                    grouponNum: laderGrouponNum?.groupNum,
                                    price: skuGroupPriceItem.price
                                };
                            });
                        }
                        return grouponSkuItem;
                    });
                    // 兜底：用所有可参团阶梯里价格最低的那个，回填 currentGroupNum / grouponPrice，
                    // 避免后续未选中可参团 SKU 时拼团标题展示为空
                    const joinableLaders = s.current.grouponSkus.filter((sku) => sku.isJoin === 1).flatMap((sku) => sku.laders || []);
                    if (joinableLaders.length > 0) {
                        const defaultLader = joinableLaders.reduce((min: any, item: any) => {
                            if (!min || (item.price !== undefined && Number(item.price) < Number(min.price))) {
                                return item;
                            }
                            return min;
                        }, null);
                        if (defaultLader) {
                            if (s.current.grouponInfo.currentGroupNum == null) {
                                s.current.grouponInfo.currentGroupNum = defaultLader.grouponNum;
                            }
                            if (s.current.grouponInfo.grouponPrice == null) {
                                s.current.grouponInfo.grouponPrice = defaultLader.price as string;
                            }
                        }
                    }
                }
            }

            // 如果当前商品有参加拼团活动，则修改价格和库存
            if (s.current.grouponSkus && s.current.grouponSkus.length) {
                // 判断是否有参加拼团的信息
                const hasJoinGroupInfo = s.current.grouponSkus.some((item) => item.isJoin);
                if (!hasJoinGroupInfo) {
                    // 没有参加拼团，则走默认的sku价格
                    s.current.isGroupon = 0;
                    loadSkuPrice();
                    return;
                }
                const currentSkuId = s.current.currentSku?.skuId || 0;
                // 拿到当前sku的拼团的库存
                const currentGrouponSku = s.current.grouponSkus.filter((item: any) => item.skuId === currentSkuId)[0];
                // 有当前sku的拼团信息，且当前sku有参团
                if (currentGrouponSku && currentGrouponSku.isJoin === 1) {
                    // 如果库存小于产品库存，则修改库存
                    if (currentGrouponSku.limitNum < s.current.productStock) {
                        s.current.productStock = currentGrouponSku.limitNum;
                    }
                    // 如果有传递拼团的信息进来
                    let currentLader;
                    if (grouponRecordInfo.minGroupNum) {
                        currentLader = currentGrouponSku.laders.find((x) => x.grouponNum === grouponRecordInfo.minGroupNum);
                    } else {
                        // 默认选中价格最低的阶梯
                        currentLader = currentGrouponSku.laders.reduce((minLader: GrouponLaderItem | null, item: GrouponLaderItem) => {
                            const itemPrice = Number(item?.price);
                            if (Number.isNaN(itemPrice)) {
                                return minLader;
                            }
                            if (!minLader) {
                                return item;
                            }
                            const minPrice = Number(minLader.price);
                            if (Number.isNaN(minPrice) || itemPrice < minPrice) {
                                return item;
                            }
                            return minLader;
                        }, null);
                    }
                    // 有拿到阶梯信息
                    if (currentLader) {
                        s.current.isGroupon = 1;
                        s.current.currentGroupNumKey = currentLader.grouponNumKey;
                        s.current.productPrice = currentLader.price as string;
                        s.current.grouponInfo.grouponPrice = currentLader.price as string;
                        s.current.grouponBuyData.groupNumKey = s.current.currentGroupNumKey;
                        s.current.grouponBuyData.price = currentLader.price as number;
                        s.current.grouponBuyData.grouponDetailId = currentGrouponSku.grouponDetailId;
                        s.current.grouponInfo.currentGroupNum = currentLader.grouponNum;
                        // 如果当前传了拼团的值
                        if (grouponRecordInfo.grouponPromotionRecordId) {
                            s.current.grouponBuyData.grouponPromotionRecordId = grouponRecordInfo.grouponPromotionRecordId;
                        }
                        // 如果有设置限购
                        if (s.current.grouponInfo.orderLimitNum && s.current.grouponInfo.orderLimitNum > 0) {
                            s.current.maxProductNumber =
                                s.current.grouponInfo.orderLimitNum > s.current.productStock ? s.current.productStock : s.current.grouponInfo.orderLimitNum;
                        }
                        if (s.current.checkedValue.length > 0) {
                            s.current.skuStr = s.current.checkedValue.map((item: any) => item.split(":")[1]).join(" ");
                        }
                    } else {
                        // 没有参加拼团，则走默认的sku价格
                        s.current.isGroupon = 0;
                        loadSkuPrice();
                    }
                } else {
                    // 没有参加拼团，则走默认的sku价格
                    s.current.isGroupon = 0;
                    loadSkuPrice();
                }
                if (s.current.firstLoad) {
                    sendValue();
                }
            } else {
                // 没有参加拼团，则走默认的sku价格
                s.current.isGroupon = 0;
                loadSkuPrice();
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            s.current.firstLoad = false;
            onLoadEnd?.();
            rerender();
        }
    };

    // 处理拼团阶梯变更事件
    const handleSkuLaderChange = (lader: GrouponLaderItem) => {
        s.current.currentGroupNumKey = lader.grouponNumKey;
        s.current.productPrice = lader.price as string;
        // 设置拼团下单信息
        s.current.grouponBuyData.groupNumKey = s.current.currentGroupNumKey;
        s.current.grouponBuyData.price = lader.price as number;
        s.current.grouponInfo.currentGroupNum = lader.grouponNum;
        rerender();
        sendValue();
    };

    const refresh = () => {
        if (typeof productId === "number" && productId > -1) {
            reset();
            s.current.firstLoad = true;
            __getProductDetail();
        }
    };

    // 对应旧 watch(() => props.modelValue, { immediate: true })
    useEffect(() => {
        if (!productId) return;
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId]);

    // 对应旧 watch(() => props.grouponEnable)
    useEffect(() => {
        if (!skipGrouponEnableWatchRef.current) {
            skipGrouponEnableWatchRef.current = true;
            return;
        }
        setDefaultValue();
        rerender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouponEnable]);

    // 对应旧 watch(() => props.grouponRecordInfo.grouponPromotionRecordId)
    useEffect(() => {
        if (!skipRecordIdWatchRef.current) {
            skipRecordIdWatchRef.current = true;
            return;
        }
        setDefaultValue();
        rerender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grouponRecordInfo?.grouponPromotionRecordId]);

    const setDefaultValue = () => {
        if (s.current.specificationList.length > 0) {
            if (skuId > 0) {
                const skuItem = s.current.skuList.find((item: SkuList) => item.skuId === skuId);
                if (skuItem) {
                    applyDefaultSkuSelection(skuItem);
                } else {
                    // 历史订单中的 SKU 可能已不在当前可用规格列表中，回退到默认可用规格。
                    s.current.checkedValue = [];
                    s.current.checkedAttrIds = s.current.specificationList.map(() => null);
                }
            }
            if (s.current.checkedValue.length === 0) {
                // 优先按拼团最低价 SKU 选中（无论是否处于拼团入口，只要存在可参团活动）
                let defaultSkuItem: SkuList | undefined;
                if (hasJoinableGroupon()) {
                    const cheapestJoinableSkuId = getCheapestJoinableSkuId();
                    if (cheapestJoinableSkuId != null) {
                        defaultSkuItem = s.current.skuList.find((item: SkuList) => item.skuId === cheapestJoinableSkuId);
                    }
                    if (!defaultSkuItem) {
                        defaultSkuItem = s.current.skuList.find((item: SkuList) => getJoinableSkuIds().has(item.skuId));
                    }
                }
                // 普通多规格默认选中「有库存 SKU 中 skuPrice 最低的」，让详情页首屏显示规格最低价
                if (!defaultSkuItem) {
                    const inStockSkus = s.current.skuList.filter((item: SkuList) => Number(item.skuStock ?? 0) > 0);
                    if (inStockSkus.length > 0) {
                        defaultSkuItem = inStockSkus.reduce((min, item) => {
                            const itemPrice = Number(item.skuPrice);
                            const minPrice = Number(min.skuPrice);
                            if (!Number.isFinite(itemPrice)) return min;
                            if (!Number.isFinite(minPrice)) return item;
                            return itemPrice < minPrice ? item : min;
                        });
                    }
                }
                let index = defaultSkuItem
                    ? s.current.skuList.findIndex((item: any) => item.skuId === defaultSkuItem!.skuId)
                    : s.current.skuList.findIndex((item: any) => item.skuStock > 0);
                index = index === -1 ? 0 : index;
                applyDefaultSkuSelection(s.current.skuList[index]);
            }
            // 防御性纠正：即便 props.skuId 指向一个未参团 SKU，也强制切到最便宜的可参团 SKU
            if (hasJoinableGroupon()) {
                const currentSkuItem = findSkuByCheckedAttrIds(s.current.checkedAttrIds, s.current.checkedValue);
                const currentIsJoinable = currentSkuItem && getJoinableSkuIds().has(currentSkuItem.skuId);
                const cheapestJoinableSkuId = getCheapestJoinableSkuId();
                if (!currentIsJoinable && cheapestJoinableSkuId != null) {
                    const target = s.current.skuList.find((sku: SkuList) => sku.skuId === cheapestJoinableSkuId);
                    if (target) applyDefaultSkuSelection(target);
                }
            }
            updateValue();
        } else if (s.current.skuList.length > 0) {
            s.current.currentSku = s.current.skuList[0];
        }
        // 启用了拼团且有拼团活动
        if ((grouponEnable || s.current.firstLoad) && s.current.grouponInfo && s.current.grouponInfo.grouponPromotionItemId) {
            loadGrouponInfo();
        } else {
            loadSkuPrice();
        }
    };

    const handleChecked = async (index: number, subIdx: number) => {
        const checkedItem = s.current.specificationList[index].attrList[subIdx];
        if (!checkedItem || Number(checkedItem.skuStock) === 0 || checkedItem.subCardDisabled) {
            return;
        }
        if (checkedItem.notInGroupon) {
            Taro.showToast({ title: t("该规格暂不参与本次拼团"), icon: "none" });
            return;
        }
        if (checkedItem.attrPic) {
            s.current.productImage = checkedItem.attrPic;
        } else if (index === 0) {
            s.current.productImage = s.current.picUrl;
        }
        s.current.checkedValue[index] = checkedItem.attrName + ":" + checkedItem.attrValue;
        s.current.checkedAttrIds[index] = checkedItem.attributesId != null ? Number(checkedItem.attributesId) : null;
        updateValue();
        rerender();
        // 回写详情页 skuId：切换门店重拉详情时按用户当前选中的规格预选，而不是回到入口带的 skuId
        const selectedSku = findSkuByCheckedAttrIds(s.current.checkedAttrIds, s.current.checkedValue);
        if (selectedSku?.skuId) onSkuIdChange?.(Number(selectedSku.skuId));
        // 切换 SKU 时先清理营销态，避免旧状态造成价格标签闪烁
        clearMarketingState();

        // 不启用拼团走默认逻辑
        if (!grouponEnable) {
            loadSkuPrice();
        } else {
            loadGrouponInfo();
        }
    };

    const updateValue = () => {
        const grouponActive = isGrouponActive();
        const joinSet = getJoinableSkuIds();
        s.current.specificationList.forEach((item: any, index: number) => {
            const checkedAttrId = s.current.checkedAttrIds[index];
            item.attrList.forEach((value: any) => {
                const attrNameValue = `${value.attrName}:${value.attrValue}`;
                const attrId = value.attributesId != null ? Number(value.attributesId) : null;

                // 优先按 attributesId 判断选中，避免同名规格值同时高亮
                value.checked = attrId != null && checkedAttrId != null ? checkedAttrId === attrId : s.current.checkedValue[index] === attrNameValue;

                const trialAttrIds = [...s.current.checkedAttrIds];
                const trialValues = [...s.current.checkedValue];
                trialAttrIds[index] = attrId;
                trialValues[index] = attrNameValue;
                const result = findSkuByCheckedAttrIds(trialAttrIds, trialValues);

                value.skuStock = result ? result.skuStock : 0;
                value.subCardDisabled = false;
                // 拼团模式下，该规格组合不在可参团 SKU 集合中即视为不可选
                value.notInGroupon = grouponActive && (!result || !joinSet.has(result.skuId));
            });
        });

        const selectedItem: any = findSkuByCheckedAttrIds(s.current.checkedAttrIds, s.current.checkedValue);
        if (selectedItem) {
            s.current.productOriginPrice = selectedItem.marketPrice || selectedItem.skuPrice;
            s.current.currentSku = selectedItem;
            // 预约商品先用规格库存；普通商品等可用性接口返回后再更新
            if (s.current.productType === 5 || s.current.productType === 6) {
                s.current.productStock = Number(selectedItem.skuStock ?? 0);
            }
        }
    };

    const clearMarketingState = () => {
        s.current.isSeckill = 0;
        s.current.isDiscount = 0;
        s.current.maxProductNumber = 0;
        s.current.seckillValue = {
            seckillEndTime: "",
            seckillSales: 0,
            seckillStock: 0,
            canJoin: true,
            restrictTip: ""
        };
        s.current.discountValue = {
            discountEndTime: "",
            discountPrice: 0,
            canJoin: true,
            restrictTip: ""
        };
        s.current.promotionList = [];
    };

    const loadSkuPrice = async () => {
        if (type) {
            s.current.firstLoad = false;
            onLoadEnd?.();
            return;
        }

        if (!productId) {
            return;
        }

        s.current.filterParams.id = productId;
        s.current.filterParams.skuId = s.current.currentSku.skuId || null;
        s.current.filterParams.extraAttrIds = s.current.checkedAttrs.length > 0 ? s.current.checkedAttrs.filter((item) => !!item).join(",") : "";
        if (s.current.productShopId > -1) {
            s.current.filterParams.shopId = s.current.productShopId;
        }

        try {
            const result: any = await getProductSkuDetail(s.current.filterParams);
            s.current.productPrice = result.price;
            const skuMarketPrice = result?.sku?.marketPrice ?? result?.marketPrice;
            if (skuMarketPrice !== undefined && skuMarketPrice !== null && skuMarketPrice !== "") {
                s.current.productOriginPrice = String(skuMarketPrice);
            } else if (result.originPrice) {
                s.current.productOriginPrice = String(result.originPrice);
            }
            const apiStock = Number(result.stock);
            const selectedSkuStock = Number(s.current.currentSku?.skuStock);
            // 可售库存以可用性接口的 stock 为准；预约商品使用规格库存
            if (s.current.productType === 5 || s.current.productType === 6) {
                if (Number.isFinite(selectedSkuStock)) {
                    s.current.productStock = selectedSkuStock;
                } else if (Number.isFinite(apiStock)) {
                    s.current.productStock = apiStock;
                } else {
                    s.current.productStock = 0;
                }
            } else {
                s.current.productStock = Number.isFinite(apiStock) ? apiStock : 0;
                if (s.current.currentSku) {
                    s.current.currentSku.skuStock = s.current.productStock;
                }
                const matchedSku = s.current.skuList.find((item: SkuList) => Number(item.skuId) === Number(s.current.currentSku?.skuId));
                if (matchedSku) {
                    matchedSku.skuStock = s.current.productStock;
                }
            }
            // SKU 联动定金（仅定金预售场景后端返回）
            if (result?.depositAmount !== undefined && result?.depositAmount !== null) {
                s.current.presaleInfo.depositAmount = Number(result.depositAmount);
            }
            if (result?.saleMode && Number(result.saleMode) > 0) {
                s.current.presaleInfo.saleMode = Number(result.saleMode);
            }
            if (s.current.checkedValue.length > 0) {
                s.current.skuStr = s.current.checkedValue.map((item: any) => item.split(":")[1]).join(" ");
            }

            // 是否存在营销活动
            promotionManage(result?.promotion || []);

            if (s.current.isSeckill && s.current.maxProductNumber > 0) {
                s.current.productNumber = s.current.productNumber > s.current.maxProductNumber ? s.current.maxProductNumber : s.current.productNumber;
            } else if (s.current.productStock === 0) {
                s.current.productNumber = 1;
            } else {
                s.current.productNumber = s.current.productNumber > s.current.productStock ? s.current.productStock : s.current.productNumber;
            }

            if (s.current.firstLoad) {
                sendValue();
            }
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        } finally {
            s.current.firstLoad = false;
            onLoadEnd?.();
            rerender();
        }
    };

    // 营销活动管理
    const promotionManage = (promotion: SkuPromotion[]) => {
        // 排除秒杀 & 限时折扣 & 拼团
        // 商品详情优惠入口只展示可参与的商品促销；抽奖活动(type=8)不属于优惠券/促销标签。
        s.current.promotionList = promotion.filter((item: any) => ![1, 6, 7, 8].includes(Number(item.type)));

        const seckillData: any = promotion.find((item: any) => item.type === 1);
        const discountData: any = promotion.find((item: any) => item.type === 6);

        // 判断限时折扣存在
        if (discountData) {
            const canUseDiscount = discountData.canJoin !== false;
            s.current.isDiscount = canUseDiscount ? 1 : 0;
            s.current.discountValue.discountEndTime = discountData.data.item.endTime!;
            s.current.discountValue.discountPrice = discountData.data.item.discountPrice!;
            s.current.discountValue.canJoin = canUseDiscount;
            s.current.discountValue.restrictTip = discountData.restrictTip || "";

            // 商详接口为展示活动仍会返回折扣价；无参与资格时还原为该会员的普通成交价
            if (!canUseDiscount && !seckillData) {
                const currentPrice = Number(s.current.productPrice);
                const discountAmount = Number(discountData.data?.item?.discountPrice ?? 0);
                if (Number.isFinite(currentPrice) && Number.isFinite(discountAmount)) {
                    s.current.productPrice = (currentPrice + discountAmount).toFixed(2);
                }
            }
        } else {
            s.current.isDiscount = 0;
            s.current.discountValue = {
                discountEndTime: "",
                discountPrice: 0,
                canJoin: true,
                restrictTip: ""
            };
        }
        // 判断秒杀存在
        if (seckillData) {
            s.current.isSeckill = 1;
            s.current.seckillValue.seckillEndTime = seckillData.data.seckillEndTime!;
            s.current.seckillValue.seckillSales = seckillData.data.item.seckillSales!;
            s.current.seckillValue.seckillStock = seckillData.data.item.seckillStock!;
            s.current.seckillValue.canJoin = seckillData.canJoin !== false;
            s.current.seckillValue.restrictTip = seckillData.restrictTip || "";
            s.current.maxProductNumber = seckillData.data.seckillLimitNum!;
            s.current.productStock = seckillData.data.item.seckillStock;
        } else {
            s.current.isSeckill = 0;
            s.current.seckillValue = {
                seckillEndTime: "",
                seckillSales: 0,
                seckillStock: 0,
                canJoin: true,
                restrictTip: ""
            };
        }
    };

    const sendValue = () => {
        onSendValue?.({
            marketPrice: s.current.productOriginPrice,
            productOriginPrice: s.current.productOriginPrice,
            productPrice: s.current.productPrice,
            productStock: s.current.productStock,
            productNumber: s.current.productNumber,
            productSkuId: s.current.currentSku.skuId,
            skuStr: s.current.skuStr,
            isSeckill: s.current.isSeckill,
            seckillValue: s.current.seckillValue,
            promotionList: s.current.promotionList,
            isDiscount: s.current.isDiscount,
            discountValue: s.current.discountValue,
            grouponValue: s.current.grouponInfo,
            isGroupon: s.current.isGroupon,
            depositAmount: s.current.presaleInfo?.depositAmount
        });
    };

    const handlePopupClose = () => {
        // NutUI Popup 在 visible 变为 false 的过渡里也会回调 onClose，
        // 这里用 showPopup 幂等守卫，保证与旧 up-popup 的 close 事件一样只触发一次
        if (!s.current.showPopup) return;
        popupClose();
    };

    const addCard = () => {
        popupClose();
        setTimeout(() => {
            onAddCardSucceed?.(true);
        }, 500);
    };

    const handleOverlimit = (event: string) => {
        if (event === "minus") {
            Taro.showToast({ title: t("商品数量不能小于1"), icon: "none" });
        }
        if (event === "plus") {
            if (s.current.limitNumber > 0) {
                Taro.showToast({ title: `${t("限购")}${s.current.limitNumber}${t("件，已达限购数")}`, icon: "none" });
            } else {
                Taro.showToast({ title: t("库存不足"), icon: "none" });
            }
        }
    };

    // b2b
    const getBatchProductAvailabilityList = async () => {
        const skuIds = s.current.skuList.map((item: SkuList) => item.skuId).join(",");
        if (!skuIds || s.current.batchAvailabilityLoading || s.current.loadedBatchSkuIds === skuIds) {
            return;
        }
        try {
            s.current.batchAvailabilityLoading = true;
            const result: any = await getBatchProductAvailability({ skuIds });
            s.current.b2bSkuList = s.current.skuList.map((sku: SkuList) => {
                const newSku = {
                    ...sku,
                    num: 0,
                    title: String(sku.skuValue || "").replace(/\|/g, ",")
                };

                const skuId = sku.skuId.toString();
                if (result[skuId]) {
                    Object.assign(newSku, {
                        price: result[skuId].price,
                        stock: result[skuId].stock
                    });
                }

                return newSku;
            });
            s.current.loadedBatchSkuIds = skuIds;
        } catch (error) {
            console.error(error);
        } finally {
            s.current.batchAvailabilityLoading = false;
            rerender();
        }
    };

    /** 旧 watch([showBulkPurchaseTab, batchSkuIds]) 的监听体 */
    const handleBulkPurchaseWatch = () => {
        if (!computeShowBulkPurchaseTab()) {
            s.current.tabIndex = 0;
            s.current.b2bSkuList = [];
            s.current.skuItem = [];
            s.current.productAmount = { count: 0, total: "0" } as ProductAmountItem;
            s.current.loadedBatchSkuIds = "";
            s.current.batchAvailabilityLoading = false;
            rerender();
            return;
        }
        if (s.current.skuList.map((item: SkuList) => item.skuId).join(",")) {
            void getBatchProductAvailabilityList();
        }
    };

    // 预售、周期购、预约到店/上门不参与批量采购
    const computeShowBulkPurchaseTab = () => {
        return (
            s.current.skuList.length > 1 &&
            bulkPurchase === 1 &&
            s.current.productType !== 4 &&
            type !== "exchange" &&
            !(Number(s.current.presaleInfo?.saleMode) > 0) &&
            !isCycleBuy &&
            !isSubCard &&
            s.current.productType !== 5 &&
            s.current.productType !== 6
        );
    };

    // 对应旧 watch 对 type / isCycleBuy / isSubCard / bulkPurchase 变化的响应
    // （skuList/presaleInfo/productType 的变化已在 __getProductDetail / reset 中显式触发）
    useEffect(() => {
        handleBulkPurchaseWatch();
        rerender();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, isCycleBuy, isSubCard, bulkPurchase]);

    const handleTabChange = (index: number) => {
        s.current.tabIndex = index;
        rerender();
    };

    const handleNumberChange = () => {
        if (delayTimerRef.current) {
            clearTimeout(delayTimerRef.current);
        }
        delayTimerRef.current = setTimeout(() => {
            const skus = s.current.b2bSkuList.filter((item: any) => item.num);
            s.current.skuItem = skus.map((item: any) => {
                return {
                    skuId: item.skuId,
                    num: item.num
                };
            });
            __getProductAmount();
        }, 300);
    };

    const __getProductAmount = async () => {
        try {
            const result = await getProductAmount({
                id: productId,
                skuItem: s.current.skuItem
            });
            s.current.productAmount = result as unknown as ProductAmountItem;
        } catch (error) {
            console.error(error);
        }
        rerender();
    };

    useImperativeHandle(ref, () => ({
        handleShowPopup,
        refresh
    }));

    // ---------- 渲染期派生值（对应旧 computed） ----------

    const isA1Style = layoutStyle === "A1";
    const isA2Style = layoutStyle === "A2";
    const isA3Style = layoutStyle === "A3";
    // 三种装修风格统一使用新版规格弹窗骨架；A2 不再保留旧的小图头部和独立数量行。
    const isDecoratedHeaderStyle = isA1Style || isA2Style || isA3Style;
    const isA1SimpleStyle = isA1Style && decorateConfig.buyBarStyle !== 2;
    const isA1ClassicStyle = isA1Style && decorateConfig.buyBarStyle === 2;
    const isA3ClassicStyle = isA3Style && decorateConfig.buyBarStyle === 1;
    const isA3SimpleStyle = isA3Style && !isA3ClassicStyle;
    const configuredButtonRadius = (() => {
        const radius = Number(decorateConfig.buttonRadius);
        return Number.isFinite(radius) && radius >= 0 ? radius : undefined;
    })();
    const specificationButtonRadius = (() => {
        if (isA1SimpleStyle) return (configuredButtonRadius ?? 5) * 2;
        if (isA2Style) return configuredButtonRadius ?? 10;
        if (isA3SimpleStyle) return configuredButtonRadius ?? 6;
        return 100;
    })();
    const specificationFooterStyle = { "--spec-button-radius": `${specificationButtonRadius}rpx` } as any;

    const showBulkPurchaseTab = computeShowBulkPurchaseTab();
    // 预约到店/上门商品，以及未配置头部数量控件的风格，不显示数量选择器。
    const showQuantitySelector = isDecoratedHeaderStyle && s.current.productType !== 5 && s.current.productType !== 6;
    const batchSkuIds = s.current.skuList.map((item: SkuList) => item.skuId).join(",");
    const isBatch = showBulkPurchaseTab && s.current.tabIndex === 1;

    // 拼团阶梯（旧 computed 带副作用：读取时会联动库存/价格，按旧模板的读取条件求值）
    const currentSkuGrouponLaders = grouponEnable && s.current.grouponInfo?.groupType === 2 ? getCurrentSkuGrouponLaders() : [];

    const showOriginPrice = (() => {
        // 预约商品不展示划线价，避免 SKU 切换时出现多余闪烁
        if (s.current.productType === 5 || s.current.productType === 6) return false;
        if (Number(showMarketprice) !== 1) return false;
        if (isShowB2bPriceText()) return false;
        return !!s.current.productOriginPrice && Number(s.current.productOriginPrice) > Number(s.current.productPrice);
    })();
    const reservationSkuStock = Number(s.current.currentSku?.skuStock ?? s.current.productStock ?? 0);

    // 是否是次卡商品，并且是预约商品
    const isSubCardReservationProduct = checkIsSubCardReservationProduct({ productType: s.current.productType }, isSubCard);

    const showOutsaleMask = shouldShowSoldOut(
        {
            productType: s.current.productType,
            productStock: s.current.productStock,
            reservationSkuStock: reservationSkuStock
        },
        {
            stockField: isReservationProductType(s.current.productType) ? "reservationSkuStock" : "productStock",
            isSubCard: isSubCard
        }
    );

    // 秒杀属于活动资格购买；限时折扣不满足资格时仍可按普通价格购买
    const memberRestricted = (() => {
        if (s.current.isSeckill === 1) return s.current.seckillValue.canJoin === false;
        return false;
    })();

    // 弹层高度（旧 v-bind(height) 改为内联 style）
    const popupHeight = isB2B() ? "75vh" : "65vh";
    const footerOffset = isB2B() && s.current.tabIndex === 1 ? "170rpx" : "100rpx";
    const specificationHeight = `calc(${popupHeight} - ${footerOffset} - 15px - var(--safe-bottom))`;
    const specificationPaddingBottom = "20rpx";

    // ---------- 底部按钮区（对应旧 footer 模板的 v-if/v-else 分支） ----------
    const {
        tabIndex,
        showPopup,
        specificationList,
        skuList,
        b2bSkuList,
        currentSku,
        productPrice,
        productOriginPrice,
        productImage,
        productStock,
        productName,
        productNumber,
        maxProductNumber,
        checkedAttrs,
        exchangeDetail,
        productType,
        productIsBuy,
        additionAttribute,
        productShopId,
        isGroupon,
        currentGroupNumKey,
        isPresale,
        presaleInfo,
        filterParams,
        isSeckill,
        isDiscount,
        grouponBuyData,
        grouponInfo,
        skuItem,
        productAmount
    } = s.current;

    let footerInner: ReactNode = null;
    if (isBatch) {
        footerInner = (
            <View className="b2b-btn">
                <View className="desc">
                    <View>
                        {t("已选")}
                        <Text className="num">{productAmount.count}</Text>
                        {t("件")}
                    </View>
                    <View className="price">
                        <View>{t("商品金额：")}</View>
                        <FormatPrice
                            fontStyle={{ fontSize: "32rpx", color: "var(--general)" }}
                            currencyStyle={{ fontSize: "22rpx", color: "var(--general)" }}
                            decimalsStyle={{ fontSize: "25rpx", color: "var(--general)" }}
                            priceData={productAmount.total}
                        />
                    </View>
                </View>
                <View className="add_cart">
                    <View className="buy-cell">
                        <Buy id={Number(productId)} disabled={skuItem.length === 0} skuItem={skuItem} extraAttrIds={filterParams.extraAttrIds} shopId={productShopId} onCallback={addCard}>
                            <View className={`btn cart ${skuItem.length === 0 ? "disabled-div" : ""}`}>{t("批量加入购物车")}</View>
                        </Buy>
                    </View>
                    <View className="buy-cell">
                        <Buy
                            id={Number(productId)}
                            skuItem={skuItem}
                            disabled={skuItem.length === 0}
                            extraAttrIds={filterParams.extraAttrIds}
                            isQuick={true}
                            shopId={productShopId}
                            checkQueryExtra={checkQueryExtra}
                            onCallback={popupClose}
                        >
                            <View className={`btn buy-right ${skuItem.length === 0 ? "disabled-div" : ""}`}>{t("立即购买")}</View>
                        </Buy>
                    </View>
                </View>
            </View>
        );
    } else if (type === "exchange") {
        footerInner = (
            <View className="exchange-btn">
                <Buy id={exchangeDetail.id} skuId={currentSku.skuId} disabled={productStock == 0} extraAttrIds={filterParams.extraAttrIds} number={productNumber} isQuick={true} type={type} shopId={productShopId} onCallback={popupClose}>
                    <View className={`btn ${productStock === 0 ? "disabled-div" : ""}`}>{t("立即兑换")}</View>
                </Buy>
            </View>
        );
    } else if (productType === 1 || (grouponEnable && isGroupon)) {
        if (grouponEnable && isGroupon) {
            footerInner = (
                <View className="groupon-btn">
                    <Buy
                        id={Number(productId)}
                        skuId={currentSku.skuId}
                        disabled={productStock == 0}
                        extraAttrIds={filterParams.extraAttrIds}
                        number={productNumber}
                        grouponData={grouponBuyData}
                        isQuick={true}
                        shopId={productShopId}
                        checkQueryExtra={checkQueryExtra}
                        onCallback={popupClose}
                    >
                        <View className={`btn ${productStock === 0 ? "disabled-div" : ""}`}>{t("确定")}</View>
                    </Buy>
                </View>
            );
        } else if (isPresale) {
            footerInner = (
                <View className="exchange-btn">
                    <Buy
                        id={Number(productId)}
                        skuId={currentSku.skuId}
                        disabled={productStock == 0}
                        extraAttrIds={filterParams.extraAttrIds}
                        number={productNumber}
                        isQuick={true}
                        shopId={productShopId}
                        cycleSpecId={s.current.selectedCycleSpecId}
                        checkQueryExtra={checkQueryExtra}
                        onCallback={popupClose}
                    >
                        <View className={`btn buy-right ${productStock === 0 ? "disabled-div" : ""}`}>
                            {presaleInfo?.saleMode === 2 ? (
                                <>
                                    <FormatPrice
                                        fontStyle={{ fontWeight: "bold" }}
                                        decimalsStyle={{
                                            fontSize: "24rpx",
                                            fontWeight: "bold"
                                        }}
                                        currencyStyle={{
                                            fontSize: "24rpx",
                                            fontWeight: "bold"
                                        }}
                                        priceData={presaleInfo?.depositAmount || 0}
                                    />
                                    {t("立即预定")}
                                </>
                            ) : (
                                t("立即预购")
                            )}
                        </View>
                    </Buy>
                </View>
            );
        } else if (memberRestricted) {
            // 二期会员标签：不在人群范围，弹层内加购+购买同样置灰，避免绕过底部限制下单
            footerInner = (
                <View className={`add_cart ${isCycleBuy || isSubCard ? "single" : ""}`}>
                    {!isCycleBuy && !isSubCard && <View className="btn cart disabled-div">{t("加入购物车")}</View>}
                    <View className="btn buy-right disabled-div">{t("立即购买")}</View>
                </View>
            );
        } else {
            footerInner = (
                <View className={`add_cart ${isCycleBuy || isSubCard ? "single" : ""}`}>
                    {!isCycleBuy && !isSubCard && (
                        <View className="buy-cell">
                            <Buy
                                id={Number(productId)}
                                skuId={currentSku.skuId}
                                disabled={productStock == 0}
                                extraAttrIds={filterParams.extraAttrIds}
                                number={productNumber}
                                shopId={productShopId}
                                cycleSpecId={s.current.selectedCycleSpecId}
                                onCallback={addCard}
                            >
                                <View className={`btn cart ${productStock === 0 ? "disabled-div" : ""}`}>{t("加入购物车")}</View>
                            </Buy>
                        </View>
                    )}
                    <View className="buy-cell">
                        <Buy
                            id={Number(productId)}
                            skuId={currentSku.skuId}
                            disabled={productStock == 0}
                            extraAttrIds={filterParams.extraAttrIds}
                            number={productNumber}
                            isQuick={true}
                            shopId={productShopId}
                            cycleSpecId={s.current.selectedCycleSpecId}
                            checkQueryExtra={checkQueryExtra}
                            onCallback={popupClose}
                        >
                            <View className={`btn buy-right ${productStock === 0 ? "disabled-div" : ""}`}>{t("立即购买")}</View>
                        </Buy>
                    </View>
                </View>
            );
        }
    } else if (productType === 5 || productType === 6) {
        footerInner = (
            <View className="exchange-btn">
                <Buy
                    id={productId}
                    skuId={currentSku.skuId}
                    disabled={reservationSkuStock === 0 && !isSubCardReservationProduct}
                    stock={currentSku.skuStock}
                    extraAttrIds={filterParams.extraAttrIds}
                    number={productNumber}
                    isQuick={true}
                    type={type}
                    shopId={productShopId}
                    cycleSpecId={s.current.selectedCycleSpecId}
                    checkQueryExtra={checkQueryExtra}
                    onCallback={popupClose}
                >
                    <View className={`btn ${reservationSkuStock === 0 && !isSubCardReservationProduct ? "disabled-div" : ""}`}>
                        {isSubCardReservationProduct ? t("立即购买") : t("立即预约")}
                    </View>
                </Buy>
            </View>
        );
    } else {
        footerInner = (
            <View className="exchange-btn">
                <Buy
                    id={productId}
                    skuId={currentSku.skuId}
                    disabled={productStock == 0}
                    extraAttrIds={filterParams.extraAttrIds}
                    number={productNumber}
                    isQuick={true}
                    type={type}
                    shopId={productShopId}
                    cycleSpecId={s.current.selectedCycleSpecId}
                    checkQueryExtra={checkQueryExtra}
                    onCallback={popupClose}
                >
                    <View className={`btn ${productStock === 0 ? "disabled-div" : ""}`}>{t("立即购买")}</View>
                </Buy>
            </View>
        );
    }

    return (
        <>
            <View onClick={handleShowPopup}>{children}</View>
            <Popup
                visible={showPopup}
                position="bottom"
                zIndex={9999}
                closeable={false}
                style={{ borderRadius: "10rpx 10rpx 0 0" }}
                onClose={handlePopupClose}
            >
                <ScrollView
                    scrollY
                    className={`specification ${isA1Style || isA2Style ? "specification--a1" : ""} ${isA3Style ? "specification--overseas" : ""}`}
                    style={{ height: specificationHeight, paddingBottom: specificationPaddingBottom }}
                >
                    <View className={`product-sku-box flex justify-between ${!showQuantitySelector ? "product-sku-box--without-quantity" : ""}`}>
                        <View className="product-info">
                            <View className="product-info-img" onClick={() => handlePreviewImg(productImage)}>
                                <TigImage src={productImage} />
                                {showOutsaleMask && (
                                    <View className="product-status-box">
                                        <View className="outsale">{t("已售罄")}</View>
                                    </View>
                                )}
                            </View>
                            <View className="info">
                                <View className="price">
                                    {type === "exchange" ? (
                                        <View className="exchange-box">
                                            <FormatPrice
                                                fontStyle={{ fontSize: isDecoratedHeaderStyle ? "36rpx" : "32rpx" }}
                                                currencyStyle={{
                                                    fontSize: "22rpx"
                                                }}
                                                decimalsStyle={{
                                                    fontSize: "25rpx"
                                                }}
                                                priceData={productPrice}
                                            />
                                            <Text className="exchange-icon">+</Text>
                                            <Image className="exchange-img" src={staticResource("exchange/exchange.png")} />
                                            <Text className="exchange-text">{exchangeDetail.exchangeIntegral}</Text>
                                        </View>
                                    ) : (
                                        <FormatPrice
                                            fontStyle={{ fontSize: isDecoratedHeaderStyle ? "36rpx" : "32rpx" }}
                                            currencyStyle={{
                                                fontSize: "22rpx"
                                            }}
                                            decimalsStyle={{ fontSize: isDecoratedHeaderStyle ? "26rpx" : "24rpx" }}
                                            priceData={productPrice}
                                        />
                                    )}
                                </View>
                                {isDiscount || isSeckill || isPresale ? (
                                    <View className="ticket">
                                        <View className="ticket-content">{isSeckill ? t("秒杀价") : isPresale ? t("预售") : t("限时折扣")}</View>
                                    </View>
                                ) : null}
                                {showOriginPrice ? (
                                    <View className="del-box">
                                        <FormatPrice isBottom={false} priceData={productOriginPrice} fontStyle={{ textDecoration: "line-through" }} />
                                    </View>
                                ) : null}
                                <View className="name line2">{productName}</View>
                                {isDecoratedHeaderStyle && showQuantitySelector && (
                                    <View className="sku-num flex align-center">
                                        {isSeckill && maxProductNumber > 0 ? (
                                            <>
                                                <TigNumberBox
                                                    value={productNumber}
                                                    min={1}
                                                    max={maxProductNumber}
                                                    inputWidth={20}
                                                    buttonWidth={20}
                                                    onChange={(val) => {
                                                        s.current.productNumber = val;
                                                        rerender();
                                                    }}
                                                />
                                                <View className="stock">
                                                    {t("限购")}：
                                                    <Text style={{ color: "var(--general)" }}>
                                                        {maxProductNumber}
                                                        {t("件")}
                                                    </Text>
                                                </View>
                                            </>
                                        ) : isGroupon && grouponEnable && maxProductNumber > 0 ? (
                                            <>
                                                <TigNumberBox
                                                    value={productNumber}
                                                    min={1}
                                                    max={maxProductNumber}
                                                    onOverlimit={handleOverlimit}
                                                    onChange={(val) => {
                                                        s.current.productNumber = val;
                                                        rerender();
                                                    }}
                                                />
                                                <View className="stock">
                                                    {t("限购")}：
                                                    <Text style={{ color: "var(--general)" }}>
                                                        {maxProductNumber}
                                                        {t("件")}
                                                    </Text>
                                                </View>
                                            </>
                                        ) : (
                                            <>
                                                <TigNumberBox
                                                    value={productNumber}
                                                    min={1}
                                                    max={s.current.limitNumber || productStock}
                                                    onOverlimit={handleOverlimit}
                                                    onChange={(val) => {
                                                        s.current.productNumber = val;
                                                        rerender();
                                                    }}
                                                />
                                                <View className="stock">
                                                    {t("库存")}：
                                                    {productStock > 50 ? (
                                                        <Text style={{ color: "var(--general)" }}>{t("充足")}</Text>
                                                    ) : productStock === 0 ? (
                                                        <Text style={{ color: "var(--general)" }}>{t("缺货")}</Text>
                                                    ) : (
                                                        <Text style={{ color: "var(--general)" }}>
                                                            {t("仅剩")}
                                                            {productStock}
                                                            {t("件")}
                                                        </Text>
                                                    )}
                                                </View>
                                            </>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                        <View className="popup-close" onClick={popupClose}>
                            {isDecoratedHeaderStyle ? (
                                <Image className="close-img" src={staticResource("order/close.png")} />
                            ) : (
                                <Text className="iconfont-h5 icon-chacha" style={{ color: "#c8c9cc", fontSize: "42rpx" }} />
                            )}
                        </View>
                    </View>
                    {showBulkPurchaseTab && (
                        <>
                            <View className="placeholder" />
                            <View className="tab">
                                <View className={`tab-item ${tabIndex === 0 ? "active" : ""}`} onClick={() => handleTabChange(0)}>
                                    {t("单品采购")}
                                    {tabIndex === 1 && <Image className="image" style={{ right: 0 }} src={staticResource("product/shadow-right.png")} />}
                                </View>
                                <View className={`tab-item ${tabIndex === 1 ? "active" : ""}`} onClick={() => handleTabChange(1)}>
                                    {t("批量采购")}
                                    {tabIndex === 0 && <Image className="image" style={{ left: 0 }} src={staticResource("product/shadow-left.png")} />}
                                </View>
                                <View className="line" style={tabIndex === 0 ? "left: 0" : "right: 0"} />
                                <View className="subline" style={tabIndex === 0 ? "right: 0" : "left: 0"} />
                            </View>
                        </>
                    )}

                    {tabIndex !== 1 && (
                        <View>
                            {specificationList.length > 0 && (
                                <View className="product-sku-info">
                                    {specificationList.map((item, index) => (
                                        <View key={index} className="sku-item">
                                            <View className="tit">{item.attrName}</View>
                                            <View className="sku-tag flex">
                                                {item.attrList.map((value: any, subIdx: number) => (
                                                    <View
                                                        key={String(value.attributesId ?? subIdx)}
                                                        className={`tag ${value.checked ? "checked" : ""} ${
                                                            !value.checked && (Number(value.skuStock) === 0 || value.subCardDisabled || value.notInGroupon) ? "disabled" : ""
                                                        } ${Boolean(value.attrPicThumb) ? "tag--image" : ""}`}
                                                        onClick={() => handleChecked(index, Number(subIdx))}
                                                    >
                                                        {value.attrPicThumb && (
                                                            <View className="tag-img">
                                                                <TigImage src={value.attrPicThumb} />
                                                            </View>
                                                        )}
                                                        <View className="tag-text">{value.attrValue}</View>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {isBatch && (
                        <View>
                            {skuList.length > 1 && (
                                <View className="allskulist">
                                    {b2bSkuList.map((item: any) => (
                                        <View key={item.skuId} className="allskulist-item">
                                            <View className="left">
                                                <View className="title line2">{item.title}</View>
                                                <View className="desc">
                                                    <View className="price">
                                                        <FormatPrice priceData={item.price} />
                                                    </View>
                                                    <View className="line" />
                                                    <View className="stock">
                                                        {t("库存：")}
                                                        {item.stock}
                                                    </View>
                                                </View>
                                            </View>
                                            <View className="right">
                                                <TigNumberBox
                                                    value={item.num}
                                                    buttonWidth={30}
                                                    min={0}
                                                    max={item.skuStock}
                                                    onChange={(val) => {
                                                        item.num = val;
                                                        rerender();
                                                        handleNumberChange();
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {additionAttribute.length > 0 && (
                        <View className="product-sku-info attribute">
                            {additionAttribute.map((item, index) => (
                                <View key={index} className="attribute-item">
                                    <View className="item-title">{item.attrName}</View>
                                    <View className="item-content">
                                        {item.attrList.map((subItem: any) => (
                                            <View
                                                key={subItem.attributesId}
                                                className={`item-attr ${checkedAttrs[index] === subItem.attributesId ? "checked" : ""}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAttrClick(index, subItem.attributesId);
                                                }}
                                            >
                                                <View className="label">{subItem.attrValue}</View>
                                                <View className="value">
                                                    <FormatPrice priceData={subItem.attrPrice} />
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                    {/* 开团阶梯 如果是阶梯团渲染出来 */}
                    {isGroupon && grouponEnable && grouponInfo?.groupType === 2 && currentSkuGrouponLaders.length > 0 && (
                        <View className="product-sku-info">
                            <View className="sku-item">
                                <View className="tit">{t("阶梯")}</View>
                                <View className="sku-tag flex">
                                    {currentSkuGrouponLaders.map((lader, index) => (
                                        <View key={index} className={`tag ${currentGroupNumKey === lader.grouponNumKey ? "checked" : ""}`} onClick={() => handleSkuLaderChange(lader)}>
                                            <Text className="tag-text">
                                                {lader.grouponNum}
                                                {t("人团")}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {productType === 4 && productIsBuy === 1 ? (
                    <View className="footer">
                        <View className="exchange-btn">
                            <View className="btn disabled-div">{t("商品已购买")}</View>
                        </View>
                    </View>
                ) : (
                    <View
                        className={`footer ${isBatch ? "shadow" : ""} ${isA1SimpleStyle || isA2Style ? "footer--a1-simple" : ""} ${
                            isA1ClassicStyle ? "footer--a1-classic" : ""
                        } ${isA3SimpleStyle ? "footer--a3-simple" : ""} ${isA3ClassicStyle ? "footer--a3-classic" : ""}`}
                        style={specificationFooterStyle as any}
                    >
                        {footerInner}
                    </View>
                )}
            </Popup>
        </>
    );
});

export default Specification;
