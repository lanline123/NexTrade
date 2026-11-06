import { useEffect, useMemo } from "react";
import { View } from "@tarojs/components";

import Masonry from "@/components/masonry/Masonry";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks/useProductStyle";
import { getGuessLikeIds, getProductsList } from "@/api/common";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    /** 标题背景 */
    titleBg?: string;
    /** 旧 @callback */
    onCallback?: () => void;
}

/**
 * 猜你喜欢推荐组件（自旧 components/recommend/index.vue 移植）
 * - 先取推荐商品 ID 串，再按 ids 拉商品列表
 * - 旧 setup 顶层 getGuessLikeIdsData() → useEffect 挂载时请求
 */
export default function Recommend({ titleBg = "", onCallback }: Props) {
    const isGuestLikeGoods = useConfigStore((s) => s.isGuestLikeGoods);
    const guestLikeGoodsName = useConfigStore((s) => s.guestLikeGoodsName);

    const initialParams = useMemo(() => ({ ids: "" }), []);

    const { data: guessLike, promotionList, getList } = useList<any[]>(getProductsList, {
        params: initialParams,
        path: { dataKey: "records" },
        immediate: false,
        needPromotionList: true,
        needReachBottom: true
    });

    const { styleMap: productStyleMap } = useProductStyle(guessLike);

    useEffect(() => {
        const getGuessLikeIdsData = async () => {
            try {
                const result = await getGuessLikeIds({ page: 1, size: 10 });
                getList({ ids: result } as any);
            } catch (error) {
                console.error("获取猜你喜欢商品ID失败", error);
            }
        };
        void getGuessLikeIdsData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!guessLike.length || !isGuestLikeGoods) return null;

    return (
        <View className="recommend_wrapper">
            <View className="title" style={{ background: titleBg }}>
                <View className="text">
                    {/* 后台保存的是语言包 key（如"猜你喜欢"），展示时需经过本地翻译。 */}
                    <View className="name">{t(guestLikeGoodsName || "")}</View>
                    <View className="desc">{t("您还可以逛一逛")}</View>
                </View>
            </View>
            <View className="masonry-content">
                <Masonry commodityList={guessLike} promotionList={promotionList} styleMap={productStyleMap} onCallback={onCallback} />
            </View>
        </View>
    );
}