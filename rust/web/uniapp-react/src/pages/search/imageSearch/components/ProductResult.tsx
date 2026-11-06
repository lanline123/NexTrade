import { useEffect } from "react";
import { Text, View } from "@tarojs/components";

import EmptyBox from "@/components/empty-box/EmptyBox";
import LoadingBox from "@/components/loading-box";
import SearchProductList from "@/pages/search/components/search-result/List";
import { useSearchDecorateStore } from "@/store/searchDecorate";
import { t } from "@/utils/i18n";

import "./ProductResult.scss";

interface Props {
    productList: any[];
    promotionList: Record<string, any>;
    page: number;
    isLoading: boolean;
    isLoadMore: boolean;
    error: Error | null;
    /** 空结果文案，不传时用普通商品搜索的说法 */
    emptyText?: string;
    onRetry: () => void;
}

/**
 * 图搜商品区的各个状态：加载中、首屏失败、空、列表、加载更多（自旧 productResult.vue 移植）
 * 复用搜索结果页的单列商品列表，样式跟随搜索页装修配置
 */
export default function ProductResult({
    productList = [],
    promotionList = {},
    page,
    isLoading,
    isLoadMore,
    error,
    emptyText = "",
    onRetry
}: Props) {
    const config = useSearchDecorateStore((s) => s.config);
    const fetchConfig = useSearchDecorateStore((s) => s.fetchConfig);

    useEffect(() => {
        void fetchConfig();
    }, [fetchConfig]);

    // 加载中商品区留空，顶部搜索和筛选不被遮挡，与普通商品搜索结果页一致
    if (isLoading) return <View className="product-result" />;

    if (error && !productList.length) {
        return (
            <View className="product-result">
                <View className="product-result__state">
                    {/* 优先显示后端给的原因，例如功能关闭、限流 */}
                    <Text className="product-result__text">{error.message || t("加载失败，请重试")}</Text>
                    <View className="product-result__actions">
                        <View className="product-result__btn" onClick={onRetry}>
                            {t("重试")}
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    if (!productList.length) {
        return (
            <View className="product-result">
                <View className="product-result__state">
                    <EmptyBox text={emptyText || t("没有找到相关的商品")} height="auto" />
                </View>
            </View>
        );
    }

    return (
        <View className="product-result">
            <SearchProductList productList={productList} promotionList={promotionList} config={config} />
            <LoadingBox modelValue={isLoadMore} page={page} length={productList.length} />
            {/* 加载更多失败：已加载的商品保留，原因和恢复方式放在底部 */}
            {error && !isLoadMore && (
                <View className="product-result__more-failed">
                    <Text className="product-result__text">{error.message || t("加载失败，请重试")}</Text>
                    <View className="product-result__actions product-result__actions--more">
                        <View className="product-result__btn" onClick={onRetry}>
                            {t("重试")}
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}