import { useEffect, useRef, useState } from "react";
import { View } from "@tarojs/components";

import Specification, { type SpecificationRef } from "@/components/product/specification";
import ProductItem from "@/components/masonry/ProductItem";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks";
import { getGuessLikeIds, getProductsList } from "@/api/common";
import { useConfigStore } from "@/store/config";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./Recommend.scss";

interface Props {
    /** 对应旧 @emit("callback")：规格弹窗加购成功后通知父级刷新购物车 */
    onCallback?: () => void;
}

/**
 * 猜你喜欢推荐（自旧 components/recommend/index.vue 移植）。
 * TODO(MIGRATION)：目标工程尚无共享 recommend 组件，先随购物车页落地；
 * 旧 masonry 瀑布流为「测量高度均衡分列」，此处沿用搜索页移植先例（奇偶分列 +
 * 网格两列），高度均衡可后补；规格弹窗（Specification）接线与旧 masonry 一致。
 */
export default function Recommend({ onCallback }: Props) {
    const configStoreIsGuestLikeGoods = useConfigStore((s) => s.isGuestLikeGoods);
    const configStoreGuestLikeGoodsName = useConfigStore((s) => s.guestLikeGoodsName);

    const [ids, setIds] = useState("");

    const {
        data: guessLike,
        promotionList,
        getList
    } = useList(getProductsList, {
        params: {
            ids
        },
        path: {
            dataKey: "records"
        },
        immediate: false,
        needPromotionList: true,
        needReachBottom: true
    });

    const { styleMap: productStyleMap } = useProductStyle(guessLike);

    const getGuessLikeIdsData = async () => {
        try {
            const result = await getGuessLikeIds({ page: 1, size: 10 });
            setIds(result);
            getList({
                ids: result
            });
        } catch (error) {
            console.error("获取猜你喜欢商品ID失败", error);
        }
    };

    // 对应旧 setup 顶层立即执行
    useEffect(() => {
        void getGuessLikeIdsData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ========== 规格弹窗接线（对应旧 masonry.vue 内的 specification） ==========
    const specificationRef = useRef<SpecificationRef | null>(null);
    const [productId, setProductId] = useState(0);
    const [shopId, setShopId] = useState<number | null>(null);
    const currentItemRef = useRef<any>({});
    const isCycleBuy = currentItemRef.current.deliveryMode === 2 && currentItemRef.current.deliveryType === 1;
    const isSubCard = currentItemRef.current.deliveryMode === 2 && currentItemRef.current.deliveryType === 2;

    const handleClickItem = (item: any) => {
        const promotionItem = promotionList[item.productId];
        let skuId;
        if (promotionItem && promotionItem.activityInfo && promotionItem.activityInfo.length > 0 && promotionItem.activityInfo[0].skuIds) {
            skuId = promotionItem.activityInfo[0].skuIds[0];
        }
        let params = `id=${item.productId}`;
        params = skuId ? `${params}&skuId=${skuId}` : params;
        redirect({ url: "/pages/product/index?" + params });
    };

    const handleBuy = (item: any) => {
        if (item.isCheck) return;
        item.isCheck = true;
        currentItemRef.current = item;
        setShopId(null);
        setProductId(item.productId);
    };

    const loadEnd = () => {
        specificationRef.current?.handleShowPopup();
        currentItemRef.current.isCheck = false;
    };

    const handleClose = () => {
        setProductId(0);
    };

    // 奇偶分列（旧 masonry 为测量均衡分列，此处沿用搜索页移植先例）
    const evenColumn = guessLike.filter((_: any, index: number) => index % 2 === 0);
    const oddColumn = guessLike.filter((_: any, index: number) => index % 2 === 1);

    const renderItem = (item: any) => (
        <ProductItem
            key={item.productId}
            item={item}
            promotionList={promotionList}
            styleMap={productStyleMap}
            isCycleBuy={item.deliveryMode === 2 && item.deliveryType === 1}
            isSubCard={item.deliveryMode === 2 && item.deliveryType === 2}
            onClickItem={handleClickItem}
            onClickBuy={handleBuy}
        />
    );

    return (
        <>
            {guessLike.length > 0 && !!Number(configStoreIsGuestLikeGoods) && (
                <View className="recommend_wrapper">
                    <View className="title" style={{ background: "" } as any}>
                        <View className="text">
                            {/* 后台保存的是语言包 key（如“猜你喜欢”），展示时需经过本地翻译。 */}
                            <View className="name">{t(configStoreGuestLikeGoodsName || "")}</View>
                            <View className="desc">{t("您还可以逛一逛")}</View>
                        </View>
                    </View>
                    <View className="masonry-content">
                        <View className="recommend-masonry">
                            <View className="recommend-masonry-col">{evenColumn.map(renderItem)}</View>
                            <View className="recommend-masonry-col">{oddColumn.map(renderItem)}</View>
                        </View>
                    </View>
                </View>
            )}
            <Specification
                ref={specificationRef}
                productId={productId}
                shopId={shopId}
                isCycleBuy={isCycleBuy}
                isSubCard={isSubCard}
                onAddCardSucceed={() => onCallback?.()}
                onLoadEnd={loadEnd}
                onClose={handleClose}
            />
        </>
    );
}
