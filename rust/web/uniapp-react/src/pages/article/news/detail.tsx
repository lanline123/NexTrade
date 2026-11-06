import { useMemo, useState } from "react";
import { Navigator, RichText, View } from "@tarojs/components";
import Taro, { useLoad, useRouter, useUnload } from "@tarojs/taro";

import EmptyBox from "@/components/empty-box/EmptyBox";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getArticle } from "@/api/article/article";
import type { ArticleFormState, prevAndNext } from "@/types/article/article";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import { clearJsonLd, extractDescription, setJsonLd, setPageMeta } from "@/utils/seo";

import ProductItem from "../src/ProductItem";

import "./detail.scss";

/**
 * 新闻详情页（自旧 pages/article/news/detail.vue 移植）
 * - 展示新闻文章详细内容
 * - 富文本渲染文章内容
 */
export default function ArticleNewsDetail() {
    usePageGuards();

    const router = useRouter();
    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);

    const [loading, setLoading] = useState(false);
    const [formArticleState, setFormArticleState] = useState<ArticleFormState>({});
    const [productIds, setProductIds] = useState<any[]>([]);
    const [notBottom, setNotBottom] = useState(false);

    // 处理富文本内容，给 img 标签添加内联样式，防止小程序端图片溢出
    const processedContent = useMemo(() => {
        const content = formArticleState.content;
        if (!content) return "";
        return content.replace(/<img([^>]*)>/gi, (match: string, attrs: string) => {
            if (/style\s*=/i.test(attrs)) {
                return match.replace(/style\s*=\s*["']([^"']*)["']/i, 'style="$1;max-width:100%;height:auto;display:block;"');
            }
            return `<img style="max-width:100%;height:auto;display:block;"${attrs}>`;
        });
    }, [formArticleState.content]);

    const _getArticle = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            setLoading(true);
            // TODO(MIGRATION)：旧页面用 defineProps({ id }) 取文章 id，uni-app 页面层不会把路由 query
            // 注入 props（旧行为下 id 恒为空串）；此处按 onLoad 的可达语义取路由 query.id，待业务确认。
            const result: any = await getArticle({ id: (router.params as any)?.id ?? "" }, "newsInfo");
            // 旧代码直接读 result.item.productIds（类型里未声明，接口实际返回），此处保留 any 语义
            const item: any = result.item || {};
            setProductIds(item.productIds || []);
            setFormArticleState((prev) => ({
                ...prev,
                ...item,
                prev: result.prev as prevAndNext,
                next: result.next as prevAndNext
            }));
            if (process.env.TARO_ENV === "h5") {
                setPageMeta({
                    title: `${item.articleTitle} - ${shopTitle}`,
                    description: extractDescription(item.content || ""),
                    type: "article"
                });

                setJsonLd({
                    "@context": "https://schema.org",
                    "@type": "Article",
                    headline: item.articleTitle,
                    description: extractDescription(item.content || ""),
                    datePublished: item.addTime,
                    publisher: {
                        "@type": "Organization",
                        name: shopTitle
                    }
                });
            }
        } catch (error: any) {
            console.error(error.message);
        } finally {
            setLoading(false);
            Taro.hideLoading();
        }
    };

    // 对应旧 onUnload
    useUnload(() => {
        if (process.env.TARO_ENV === "h5") {
            clearJsonLd();
        }
    });

    // 对应旧 onLoad
    useLoad((option: any) => {
        if (option && option.notBottom) {
            setNotBottom(true);
        }
        void _getArticle();
    });

    return (
        <TigLayout title={t("资讯中心")}>
            {!loading && (
                <View className="article-center">
                    <View className="title">{formArticleState.articleTitle}</View>
                    {formArticleState.addTime && (
                        <View className="time">
                            {t("时间")}：{formArticleState.addTime}
                        </View>
                    )}
                    {formArticleState.content ? (
                        <View className="content">
                            {formArticleState.articleThumb && <TigImage src={formArticleState.articleThumb} />}
                            <RichText className="v-html" nodes={processedContent} />
                            {productIds && productIds.length ? <ProductItem productIds={productIds} /> : null}
                        </View>
                    ) : (
                        <EmptyBox mode="news" text={t("暂无内容")} />
                    )}
                    {!notBottom && (
                        <FixedPlaceholder height="70rpx" backgroundColor="#fff">
                            <View className="navigation">
                                <View className="navigation-btn navigation-btn-left">
                                    {formArticleState.prev && (
                                        <Navigator
                                            url={`/pages/article/news/detail?id=${formArticleState.prev?.articleId}`}
                                            hoverClass="navigator-hover"
                                            openType="navigate"
                                        >
                                            «{t("上一篇")}：{formArticleState.prev?.articleTitle}
                                        </Navigator>
                                    )}
                                </View>
                                <View className="navigation-btn navigation-btn-right">
                                    {formArticleState.next?.articleId && (
                                        <Navigator
                                            url={`/pages/article/news/detail?id=${formArticleState.next?.articleId}`}
                                            hoverClass="navigator-hover"
                                            openType="navigate"
                                        >
                                            {t("下一篇")}：{formArticleState.next?.articleTitle}»
                                        </Navigator>
                                    )}
                                </View>
                            </View>
                        </FixedPlaceholder>
                    )}
                </View>
            )}
        </TigLayout>
    );
}
