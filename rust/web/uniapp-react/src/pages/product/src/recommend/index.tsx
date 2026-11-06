import { useEffect } from "react";
import { View } from "@tarojs/components";

import ProductItem from "@/components/masonry/ProductItem";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks";
import { getGuessLikeIds, getProductsList } from "@/api/common";
import { useConfigStore } from "@/store/config";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    // 标题背景色（对应旧 title-bg）
    titleBg?: string;
}

/**
 * 猜你喜欢推荐（自旧 components/recommend/index.vue 移植）
 * - 商品异常页下方的猜你喜欢商品流
 * - 旧 masonry.vue 组件未随批次移植，双列瀑布流按搜索结果页同款奇偶分列渲染
 */
export default function Recommend({ titleBg = "" }: Props) {
    const configStoreIsGuestLikeGoods = useConfigStore((s) => s.isGuestLikeGoods);
    const configStoreGuestLikeGoodsName = useConfigStore((s) => s.guestLikeGoodsName);

    const {
        data: guessLike,
        promotionList,
        getList
    } = useList(getProductsList, {
        params: {
            ids: ""
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
            getList({
                ids: result
            });
        } catch (error) {
            console.error("获取猜你喜欢商品ID失败", error);
        }
    };

    // 旧版在 setup 阶段执行一次；React 下等价于挂载后执行一次
    useEffect(() => {
        void getGuessLikeIdsData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toProductPage = (item: any) => {
        const promotionItem = (promotionList as any)[item.productId];
        const skuId = promotionItem?.activityInfo?.[0]?.skuIds?.[0];
        let params = `id=${item.productId}`;
        if (skuId) params += `&skuId=${skuId}`;
        if (item.shop?.shopId) params += `&shopId=${item.shop.shopId}`;
        redirect({ url: "/pages/product/index?" + params });
    };

    if (!(guessLike.length && configStoreIsGuestLikeGoods)) return null;

    /** 双列瀑布流：奇偶分列（与搜索结果页同口径） */
    const evenColumn = guessLike.filter((_: any, index: number) => index % 2 === 0);
    const oddColumn = guessLike.filter((_: any, index: number) => index % 2 === 1);

    const renderColumn = (list: any[]) =>
        list.map((item: any) => (
            <ProductItem
                key={item.productId}
                item={item}
                promotionList={promotionList}
                styleMap={productStyleMap}
                onClickItem={toProductPage}
                onClickBuy={toProductPage}
            />
        ));

    return (
        <View className="recommend_wrapper">
            <View className="title" style={{ background: titleBg }}>
                <View className="text">
                    {/* 后台保存的是语言包 key（如“猜你喜欢”），展示时需经过本地翻译。 */}
                    <View className="name">{t(configStoreGuestLikeGoodsName || "")}</View>
                    <View className="desc">{t("您还可以逛一逛")}</View>
                </View>
            </View>
            <View className="masonry-content">
                {/* TODO(MIGRATION)：旧 masonry.vue 为等高均衡分列，此处按奇偶分列（与搜索结果页一致） */}
                <View className="masonry-two-col">
                    <View className="masonry-col">{renderColumn(evenColumn)}</View>
                    <View className="masonry-col">{renderColumn(oddColumn)}</View>
                </View>
            </View>
        </View>
    );
}
